require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

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

  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) {
    console.error('Credentials file not found. Tried:', credPath);
    return res.status(503).json({ ok: false, error: 'Waitlist is not configured yet. Please try again later.' });
  }

  try {
    const keyContent = fs.readFileSync(credPath, 'utf8');
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(keyContent),
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
    console.error('Credentials path:', credPath);
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

app.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  const credExists = fs.existsSync(CREDENTIALS_PATH);
  if (credExists) {
    console.log('Credentials file found:', CREDENTIALS_PATH);
    try {
      const keyContent = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
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
    console.log('Credentials file NOT FOUND at:', CREDENTIALS_PATH);
    console.log('Put google-credentials.json in:', __dirname);
  }
});
