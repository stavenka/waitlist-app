require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const colourTest = require('./colour-test.js');
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
  } else if (req.path === '/chat-widget.js') {
    // Always revalidate the widget so edits go live immediately for everyone
    // (it's tiny, so the conditional GET is cheap).
    res.set('Cache-Control', 'no-cache');
  } else if (/\.(css|js)$/i.test(req.path)) {
    res.set('Cache-Control', 'public, max-age=86400');
  }
  next();
});

// ── First-touch attribution (31-10-2026) ──
// The first time a visitor opens any page, remember where they came from (the referring site, e.g.
// chatgpt.com, perplexity.ai, google.com) and the page they landed on, in a 90-day cookie. The sign-up
// sends both to the sheet (columns L and M), so a visitor who reads a blog page first and signs up
// later is no longer a blank row. Internal clicks (referrer arbitrica.com) never overwrite it.
const FT_COOKIE = 'arb_ft';
function readFirstTouch(req) {
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)arb_ft=([^;]+)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
}
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (!(req.path === '/' || req.path.endsWith('/') || /\.html?$/i.test(req.path))) return next();
  if (readFirstTouch(req)) return next();
  let refHost = '';
  try { refHost = req.get('referer') ? new URL(req.get('referer')).hostname.replace(/^www\./, '') : ''; } catch (e) {}
  if (refHost === 'arbitrica.com') return next();
  const val = encodeURIComponent(JSON.stringify({ r: refHost || 'direct', l: req.originalUrl.slice(0, 300), t: new Date().toISOString() }));
  res.append('Set-Cookie', `${FT_COOKIE}=${val}; Max-Age=7776000; Path=/; SameSite=Lax; Secure`);
  next();
});
// Medium for a referring site when the landing URL carried no UTM.
function mediumFor(host) {
  if (/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|copilot\.microsoft\.com|copilot\.com|gemini\.google\.com|claude\.ai|you\.com|meta\.ai|grok\.com|deepseek\.com)$/.test(host)) return 'ai';
  if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|brave\.com|yandex\.[a-z]+|baidu\.com)$/.test(host)) return 'organic';
  return host === 'direct' ? 'none' : 'referral';
}

// ── robots.txt ──
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nAllow: /\nSitemap: https://arbitrica.com/sitemap.xml\n');
});

// ── SEO: redirect /index.html → / to avoid duplicate content ──
app.get("/index.html", (req, res) => res.redirect(301, "/"));
// ── GA4 on every page (added 2026-10-24) ──
// 1) Pages without the GA4 tag (about, how-it-works, faq, blog, compare, hotels...)
//    get the standard gtag snippet injected into <head> when served.
// 2) Pages that already carry the deferred loader (/, amazon, events) now load
//    tracking straight away instead of waiting for a scroll/tap or 15 seconds,
//    so visitors who glance and leave are counted too.
const GA_ID = 'G-ZMMXH83411';
const GA_SNIPPET =
  '<script async src="https://www.googletagmanager.com/gtag/js?id=' + GA_ID + '"></script>' +
  '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}' +
  "gtag('js',new Date());gtag('config','" + GA_ID + "');</script>";
app.get(/^\/(?:.*\.html|.*\/)?$/i, (req, res, next) => {
  let rel;
  try { rel = decodeURIComponent(req.path); } catch (e) { return next(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(__dirname, rel);
  if (!file.startsWith(__dirname + path.sep)) return next();
  fs.readFile(file, 'utf8', (err, html) => {
    if (err) return next();
    let out = html;
    const colour = colourTest.themeFor(req);
    if (out.includes(GA_ID)) {
      if (!out.includes('setTimeout(loadAll, 15000);') && !colour) return next();
      out = out.replace('setTimeout(loadAll, 15000);', "document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', function () { setTimeout(loadAll, 0); }) : setTimeout(loadAll, 0);");
    } else if (/<head(\s[^>]*)?>/i.test(out)) {
      out = out.replace(/<head(\s[^>]*)?>/i, (m) => m + GA_SNIPPET);
    } else if (!colour) {
      return next();
    }
    if (colour) {
      try { out = colourTest.themeHtml(out, path.relative(__dirname, file), colour); } catch (e) { console.error('Colour test:', e.message); }
    }
    res.type('html').send(out);
  });
});

// Colour test (the user, 28-10-2026): the chat widget takes the colours of the version on test.
app.get('/chat-widget.js', (req, res, next) => {
  const colour = colourTest.themeFor(req);
  if (!colour) return next();
  fs.readFile(path.join(__dirname, 'chat-widget.js'), 'utf8', (err, js) => {
    if (err) return next();
    let out = js;
    try { out = colourTest.themeJs(js, colour); } catch (e) { console.error('Colour test:', e.message); }
    res.type('application/javascript').send(out);
  });
});

app.use(express.static(__dirname));

// The country's English name from a two-letter code ("GB" -> "United Kingdom"); '' for none, unknown (XX) or Tor (T1).
function countryName(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || c === 'XX' || c === 'T1') return '';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch (e) { return c; }
}

function waitlistCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) return null;
  return JSON.parse(fs.readFileSync(credPath, 'utf8'));
}

// Headers of the two columns added on 28-10-2026, written once per server start if the cells are empty.
let extraHeadersChecked = false;
async function ensureExtraHeaders(sheets, sheetName) {
  if (extraHeadersChecked) return;
  extraHeadersChecked = true;
  try {
    const got = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${sheetName}'!I1:M1` });
    const cells = (got.data.values && got.data.values[0]) || [];
    if (!cells[0] || !cells[1] || !cells[2] || !cells[3] || !cells[4]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: `'${sheetName}'!I1:M1`, valueInputOption: 'RAW',
        requestBody: { values: [[cells[0] || 'Country', cells[1] || 'Booking hotel within a month', cells[2] || 'Colour version',
                                 cells[3] || 'First referrer', cells[4] || 'Landing page']] },
      });
    }
  } catch (e) {
    console.error('Waitlist headers not set:', e.message);
  }
}

// "Are you planning to book a hotel within one month?" (the user, 28-10-2026): asked after the sign-up, before
// "You're in!". The answer goes in column J of the sign-up's own row, only when that row holds the same email.
app.post('/api/waitlist/answer', async (req, res) => {
  const email = req.body && req.body.email != null ? String(req.body.email).trim() : '';
  const row = parseInt(req.body && req.body.row, 10);
  const answer = req.body && req.body.answer === 'Yes' ? 'Yes' : req.body && req.body.answer === 'No' ? 'No' : '';
  if (!email || !answer || !(row >= 2 && row < 1000000)) return res.status(400).json({ ok: false });
  try {
    const credentials = waitlistCredentials();
    if (!credentials) return res.status(503).json({ ok: false });
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const titles = (meta.data.sheets || []).map(s => s.properties && s.properties.title).filter(Boolean);
    const sheetName = [SHEET_NAME, 'Waitlist', 'Sheet1'].filter(Boolean).find(t => titles.includes(t)) || titles[0];
    const got = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${sheetName}'!A${row}` });
    const onRow = got.data.values && got.data.values[0] && String(got.data.values[0][0] || '').trim();
    if (!onRow || onRow.toLowerCase() !== email.toLowerCase()) return res.status(409).json({ ok: false });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: `'${sheetName}'!J${row}`, valueInputOption: 'RAW', requestBody: { values: [[answer]] },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Waitlist answer not saved:', err.message);
    return res.status(500).json({ ok: false });
  }
});

app.post('/api/waitlist', async (req, res) => {
  const raw = req.body && req.body.email;
  const email = raw != null ? String(raw).trim() : '';
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Please enter your email address.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  // UTM parameters (optional — stored in columns E–H, after the existing Name column D)
  const utmSource   = req.body.utm_source   ? String(req.body.utm_source).slice(0, 200)   : '';
  const utmMedium   = req.body.utm_medium   ? String(req.body.utm_medium).slice(0, 200)   : '';
  const utmCampaign = req.body.utm_campaign ? String(req.body.utm_campaign).slice(0, 200) : '';
  const utmContent  = req.body.utm_content  ? String(req.body.utm_content).slice(0, 200)  : '';
  // First touch (31-10-2026): where the visitor first came from and the page they first opened.
  const ft = readFirstTouch(req) || {};
  const firstReferrer = ft.r ? String(ft.r).slice(0, 200) : '';
  const landingPage = ft.l ? String(ft.l).slice(0, 300) : '';
  let utm = { utmSource, utmMedium, utmCampaign, utmContent };
  if (!utm.utmSource && landingPage) {
    // UTM tags on the first page (e.g. ?utm_source=chatgpt.com on a blog article) survive the click to the form.
    try {
      const q = new URL(landingPage, 'https://arbitrica.com').searchParams;
      utm = { utmSource: (q.get('utm_source') || '').slice(0, 200), utmMedium: (q.get('utm_medium') || '').slice(0, 200),
              utmCampaign: (q.get('utm_campaign') || '').slice(0, 200), utmContent: (q.get('utm_content') || '').slice(0, 200) };
    } catch (e) {}
  }
  if (!utm.utmSource && firstReferrer) { utm.utmSource = firstReferrer; utm.utmMedium = mediumFor(firstReferrer); }
  // Country of sign-up (the user, 28-10-2026): Cloudflare, in front of the site, sends the visitor's country from their IP
  // as a two-letter code (CF-IPCountry). Only the country is kept, never the IP.
  const country = countryName(req.get('cf-ipcountry'));

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
    // Columns: A=Email, B=Date joined, C=Status, D=(Name – left blank), E–H=UTM fields, I=Country,
    // J=Booking hotel within a month (filled by /api/waitlist/answer), K=Colour version live at sign-up (colour test, 28-10-2026)
    // L=First referrer, M=Landing page (first-touch attribution, 31-10-2026)
    const row = [email, dateJoined, status, '', utm.utmSource, utm.utmMedium, utm.utmCampaign, utm.utmContent, country, '', colourTest.scheduledTheme() || 'normal', firstReferrer, landingPage];

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

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:M`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    // Derive a sequential queue number from the sheet row.
    // QUEUE_OFFSET is set so that row 1539 (the first row after the 28-10-2026 deploy) → #22,500 (the user, 28-10-2026).
    // Each subsequent signup gets the next integer automatically.
    const QUEUE_OFFSET = 20961;
    const updatedRange = appendRes.data.updates && appendRes.data.updates.updatedRange || '';
    const rowMatch = updatedRange.match(/:?[A-Z]+(\d+)$/);
    const appendedRow = rowMatch ? parseInt(rowMatch[1], 10) : 0;
    const position = appendedRow > 0 ? appendedRow + QUEUE_OFFSET : 22500;
    await ensureExtraHeaders(sheets, sheetName);

    return res.json({ ok: true, position, row: appendedRow || null });
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
  // IndexNow (31-10-2026): after each deploy, tell Bing (and Yandex, Seznam, Naver) about every URL in the sitemap,
  // so new and changed pages are crawled within hours instead of weeks. Bing feeds ChatGPT search and Copilot.
  if (process.env.RENDER || process.env.INDEXNOW === 'on') setTimeout(pingIndexNow, 60000);
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

const INDEXNOW_KEY = '40673e15be9d875fb58af388e98ce574';
function pingIndexNow() {
  let xml = '';
  try { xml = fs.readFileSync(path.join(__dirname, 'sitemap.xml'), 'utf8'); } catch (e) { return console.error('IndexNow: no sitemap'); }
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(u => u.startsWith('https://arbitrica.com/'));
  if (!urlList.length) return;
  const body = JSON.stringify({ host: 'arbitrica.com', key: INDEXNOW_KEY, keyLocation: `https://arbitrica.com/${INDEXNOW_KEY}.txt`, urlList: urlList.slice(0, 10000) });
  const r = require('https').request('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } },
    (res) => { console.log('IndexNow:', res.statusCode, urlList.length, 'URLs'); res.resume(); });
  r.on('error', (e) => console.error('IndexNow error:', e.message));
  r.end(body);
}
