require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

const CREDENTIALS_PATH = path.join(__dirname, 'waitlist-488419-8c1b2d483d29.json');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Waitlist';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

if (!SPREADSHEET_ID) {
  console.warn('Warning: SPREADSHEET_ID not set. Set it in .env to save emails to Google Sheets.');
}

app.post('/api/waitlist', async (req, res) => {
  const email = req.body && req.body.email && String(req.body.email).trim();
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email is required' });
  }

  if (!SPREADSHEET_ID) {
    return res.status(503).json({ ok: false, error: 'Server is not configured for the waitlist. Missing SPREADSHEET_ID.' });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const dateJoined = new Date().toISOString();
    const status = 'New';

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'!A:C`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[email, dateJoined, status]],
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Sheets API error:', err.message);
    const message = err.message || 'Failed to save to waitlist';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!SPREADSHEET_ID) console.log('Set SPREADSHEET_ID in .env to enable Google Sheets.');
});
