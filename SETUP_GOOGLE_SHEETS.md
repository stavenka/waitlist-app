# Google Sheets setup for waitlist emails

Follow these steps so every email users submit is stored in a Google Sheet. When you’re done, give me the three things listed at the end and I’ll wire the app to use them.

---

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and sign in.
2. Click **Blank** to create a new spreadsheet.
3. **(Optional)** Rename the first tab (e.g. to **Waitlist**) or leave it as **Sheet1**.
4. In the first row, add headers so you know what each column is, for example:
   - **A1:** `Email`
   - **B1:** `Date joined`
   - **C1:** `Status`
5. Copy the **Spreadsheet ID** from the URL:
   - URL looks like: `https://docs.google.com/spreadsheets/d/XXXXXXXXXX/edit`
   - The **Spreadsheet ID** is the part between `/d/` and `/edit`: `XXXXXXXXXX`

---

## Step 2: Create a Google Cloud service account

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a project (or pick an existing one):
   - Top bar: click the project name → **New Project** → name it (e.g. “Waitlist”) → **Create**.
3. Enable the Sheets API:
   - Left menu: **APIs & Services** → **Library** → search for **Google Sheets API** → open it → **Enable**.
4. Create a service account:
   - Left menu: **APIs & Services** → **Credentials**.
   - **Create Credentials** → **Service account**.
   - Name it (e.g. “waitlist-app”) → **Create and Continue** → **Done**.
5. Create a key for that service account:
   - In **Credentials**, open the service account you just created.
   - **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**.
   - A JSON file will download. Keep it safe.

---

## Step 3: Share the Google Sheet with the service account

1. Open the JSON file you downloaded. Find the **`client_email`** field. It looks like:
   `something@your-project.iam.gserviceaccount.com`
2. Open your Google Sheet.
3. Click **Share**.
4. Paste that **client_email** address as a new viewer/editor.
5. Give it **Editor** access.
6. Uncheck “Notify people” if you want, then click **Share** or **Send**.

---

## Step 4: Put the key file in the project

1. Move or copy the downloaded JSON file into your project folder (same folder as `server.js`).
2. Rename it to something simple, e.g. **`google-credentials.json`** (or keep the original name).
3. Make sure this file is in `.gitignore` so it’s never committed. For example in `.gitignore`:
   ```
   google-credentials.json
   ```
   (or the exact filename you use).

---

## What to give me

Reply with these three things (you can redact the full key contents; I only need to know the path and that it’s the service account key):

1. **Spreadsheet ID**  
   The ID from the sheet URL (the part between `/d/` and `/edit`).

2. **Sheet tab name**  
   The exact name of the tab where you want emails (e.g. `Sheet1` or `Waitlist`).

3. **Credentials filename**  
   The exact name of the JSON file you put in the project folder (e.g. `google-credentials.json`).

Example:

- Spreadsheet ID: `1abc2def3ghi4jkl5mno`
- Sheet tab name: `Waitlist`
- Credentials filename: `google-credentials.json`

Once I have these, I’ll add the code so that every submitted email is appended to that sheet (e.g. Email, Date joined, Status) and the queue-number success message stays as it is.
