require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1QpfuBX8M-ImmEvO_QuAo1UtaddurCYIEEsRL0DtbLk8';
const SHEET_NAME = process.env.SHEET_NAME || 'Waitlist';

function getCredentialsPath() {
  const names = [
    process.env.GOOGLE_CREDENTIALS_FILE,
    'google-credentials.json',
    'credentials.json',
  ].filter(Boolean);
  const dir = path.resolve(__dirname);
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(dir, 'google-credentials.json');
}
const CREDENTIALS_PATH = getCredentialsPath();

function isValidEmail(str) {
  if (typeof str !== 'string' || str.length > 254) return false;
  const at = str.indexOf('@');
  if (at < 1 || at > str.length - 3) return false;
  const dot = str.indexOf('.', at + 1);
  return dot > at + 1 && dot < str.length - 1;
}

app.use(cors());
app.use(express.json());

// ── Security headers (improves Lighthouse Best Practices) ──
app.use((req, res, next) => {
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// ── Cache control: no-cache for HTML, long-cache for assets ──
app.use((req, res, next) => {
  if (req.path === '/' || /\.html?$/i.test(req.path)) {
    // Allow bf-cache: omit no-store; must-revalidate forces freshness check on every navigation.
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');
  } else if (/\.(png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|woff2?|ttf|otf)$/i.test(req.path)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (/\.(css|js)$/i.test(req.path)) {
    res.set('Cache-Control', 'public, max-age=86400');
  }
  next();
});

// ── robots.txt ──
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://arbitrica.com/sitemap.xml\n');
});

app.use(express.static(__dirname));

app.post('/api/waitlist', async (req, res) => {
  const raw = req.body && req.body.email;
  const email = raw != null ? String(raw).trim() : '';
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Please enter your email address.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  let credentials = null;
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } catch (e) {
      console.error('Invalid GOOGLE_CREDENTIALS_JSON');
      return res.status(503).json({ ok: false, error: 'Waitlist is not configured yet. Please try again later.' });
    }
  } else {
    const credPath = getCredentialsPath();
    if (!fs.existsSync(credPath)) {
      console.error('Credentials file not found. Tried:', credPath);
      return res.status(503).json({ ok: false, error: 'Waitlist is not configured yet. Please try again later.' });
    }
    credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const dateJoined = new Date().toISOString();
    const status = 'New';
    const row = [email, dateJoined, status];

    // Fetch spreadsheet to get actual sheet names and verify access
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetTitles = (meta.data.sheets || []).map(s => s.properties && s.properties.title).filter(Boolean);
    if (sheetTitles.length === 0) {
      console.error('Spreadsheet has no sheets');
      return res.status(500).json({ ok: false, error: 'Waitlist sheet is not set up correctly. Please try again later.' });
    }
    console.log('Sheet tabs in spreadsheet:', sheetTitles.join(', '));

    const preferred = [SHEET_NAME, 'Waitlist', 'Sheet1'].filter(Boolean);
    const sheetName = preferred.find(t => sheetTitles.includes(t)) || sheetTitles[0];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:C`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return res.json({ ok: true });
  } catch (err) {
    const code = err.response && err.response.status;
    const msg = err.message || '';
    console.error('Sheets API error:', code, msg);
    console.error('Spreadsheet ID used:', SPREADSHEET_ID);
    const credPath = getCredentialsPath();
    console.error('Credentials path:', process.env.GOOGLE_CREDENTIALS_JSON ? '(from env)' : credPath);
    if (err.response && err.response.data) console.error('Response body:', JSON.stringify(err.response.data));
    let message = 'We couldn’t save your place right now. Please try again in a moment.';
    if (code === 404 || msg.includes('Unable to parse range')) {
      message = 'Waitlist sheet is not set up correctly. Please try again later.';
    } else if (code === 403 || msg.toLowerCase().includes('permission')) {
      message = 'Waitlist is temporarily unavailable. Please try again later.';
    }
    return res.status(500).json({ ok: false, error: message });
  }
});

// ── Chat widget notification endpoint ──────────────────────────────────────
app.post('/api/chat-notify', async (req, res) => {
  const { type, question, userEmail, attachName } = req.body || {};
  if (!type || !question) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }
  if (type !== 'question' && type !== 'email') {
    return res.status(400).json({ ok: false, error: 'Unknown type' });
  }

  // ── Primary: always save to Google Sheets "Chat" tab ─────────────────────
  // This is the guaranteed record — runs whether or not SMTP is configured.
  try {
    let credentials = null;
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } else {
      const credPath = getCredentialsPath();
      if (!fs.existsSync(credPath)) {
        console.error('[chat-notify] No Google credentials. Cannot save chat message.');
        return res.status(503).json({ ok: false, error: 'Chat service not configured' });
      }
      credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const CHAT_SHEET = 'Chat';
    const timestamp = new Date().toISOString();

    // Ensure "Chat" tab exists; create with headers if not
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tabTitles = (meta.data.sheets || []).map(s => s.properties && s.properties.title).filter(Boolean);
    if (!tabTitles.includes(CHAT_SHEET)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: CHAT_SHEET } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${CHAT_SHEET}'!A1:E1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Timestamp', 'Type', 'Question / Message', 'User Email', 'Attachment']] },
      });
    }

    // For type=email rows, update the most recent question row from this session instead of adding a new row,
    // so each conversation is a single clean record. If no recent question row exists, append a new one.
    if (type === 'email' && userEmail) {
      // Read recent rows to find the last question row without an email (same session, last 10 rows)
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${CHAT_SHEET}'!A:E`,
      });
      const rows = readRes.data.values || [];
      // Find last row where Type=question and UserEmail is empty (header row is row index 0)
      let lastQuestionRowIdx = -1;
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][1] === 'question' && (!rows[i][3] || rows[i][3] === '')) {
          lastQuestionRowIdx = i + 1; // 1-based sheet row number
          break;
        }
      }
      if (lastQuestionRowIdx > 0) {
        // Update that row's UserEmail column (D) in place
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${CHAT_SHEET}'!D${lastQuestionRowIdx}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[userEmail]] },
        });
        console.log(`[chat-notify] Updated email on row ${lastQuestionRowIdx}: ${userEmail}`);
        // Fall through to also attempt SMTP below
      } else {
        // No matching question row — append a standalone email row
        const row = [timestamp, type, question, userEmail, attachName || ''];
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${CHAT_SHEET}'!A:E`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [row] },
        });
        console.log(`[chat-notify] Appended email row: ${userEmail}`);
      }
    } else {
      // type=question: always append a new row
      const row = [timestamp, type, question, '', attachName || ''];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${CHAT_SHEET}'!A:E`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });
      console.log(`[chat-notify] Saved question to Sheets: "${question.slice(0, 60)}"`);
    }
  } catch (err) {
    console.error('[chat-notify] Sheets error:', err.message);
    return res.status(500).json({ ok: false, error: 'Failed to save message' });
  }

  // ── Secondary: also send SMTP email notification if credentials are set ───
  // Optional bonus alert — does not affect the response if it fails.
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass },
      });
      if (type === 'question') {
        await transporter.sendMail({
          from: `"Arbitrica Chat" <${smtpUser}>`,
          to: 'team@arbitrica.com',
          subject: 'New question from Arbitrica visitor',
          text: `A visitor asked:\n\n${question}${attachName ? '\n\nAttachment: ' + attachName : ''}`,
          html: `<p><strong>A visitor asked:</strong></p><blockquote style="border-left:3px solid #433BE3;padding-left:12px;color:#333">${question.replace(/\n/g, '<br>')}</blockquote>${attachName ? `<p>📎 Attachment: ${attachName}</p>` : ''}`,
        });
      } else if (type === 'email') {
        await transporter.sendMail({
          from: `"Arbitrica Chat" <${smtpUser}>`,
          to: 'team@arbitrica.com',
          subject: `Arbitrica visitor email: ${userEmail}`,
          text: `Visitor email: ${userEmail}\n\nOriginal question:\n${question}`,
          html: `<p><strong>Visitor email:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p><p><strong>Their question:</strong></p><blockquote style="border-left:3px solid #433BE3;padding-left:12px;color:#333">${question.replace(/\n/g, '<br>')}</blockquote>`,
        });
      }
      console.log(`[chat-notify] Email notification sent for type=${type}`);
    } catch (err) {
      console.error('[chat-notify] Mail error (non-fatal):', err.message);
      // Don't fail the request — data is already saved to Sheets
    }
  }

  return res.json({ ok: true });
});

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  const hasEnvCreds = !!process.env.GOOGLE_CREDENTIALS_JSON;
  const credExists = !hasEnvCreds && fs.existsSync(CREDENTIALS_PATH);
  if (hasEnvCreds || credExists) {
    if (hasEnvCreds) console.log('Credentials: from GOOGLE_CREDENTIALS_JSON env');
    else console.log('Credentials file found:', CREDENTIALS_PATH);
    try {
      const keyContent = hasEnvCreds ? process.env.GOOGLE_CREDENTIALS_JSON : fs.readFileSync(CREDENTIALS_PATH, 'utf8');
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(keyContent),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const tabs = (meta.data.sheets || []).map(s => s.properties && s.properties.title).filter(Boolean);
      console.log('Google Sheet OK. Tabs:', tabs.join(', ') || '(none)');
    } catch (e) {
      console.error('Startup sheet check failed:', e.response && e.response.status, e.message);
    }
  } else {
    console.log('Credentials NOT FOUND. Set GOOGLE_CREDENTIALS_JSON (env) or put google-credentials.json in:', __dirname);
  }
});
