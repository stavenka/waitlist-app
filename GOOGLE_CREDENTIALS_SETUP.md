# Add a new Google credentials JSON file

The app needs a **service account key file** (JSON) so it can write to your Google Sheet. Follow these steps to create a new one and add it to the project.

---

## Step 1: Open Google Cloud Console

1. Go to **[Google Cloud Console](https://console.cloud.google.com)** and sign in.
2. Use an **existing project** or create one:
   - Top bar: click the project name → **New Project**.
   - Name it (e.g. `waitlist-app`) → **Create**.

---

## Step 2: Enable Google Sheets API

1. In the left menu: **APIs & Services** → **Library** (or **Enabled APIs & services** → **+ Enable APIs and Services**).
2. Search for **Google Sheets API**.
3. Open it and click **Enable**.

---

## Step 3: Create a service account

1. Left menu: **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **Service account**.
3. **Service account name:** e.g. `waitlist-sheets`.
4. Click **Create and Continue** → **Done** (you can skip optional steps).

---

## Step 4: Create and download the JSON key

1. On the **Credentials** page, under **Service accounts**, click the service account you just created.
2. Open the **Keys** tab.
3. **Add key** → **Create new key**.
4. Choose **JSON** → **Create**.
5. A JSON file will download. **Keep it safe** (it’s like a password).

---

## Step 5: Add the JSON file to your project

1. **Rename** the downloaded file to: **`google-credentials.json`**  
   (or keep the name and set `GOOGLE_CREDENTIALS_FILE=that-name.json` in `.env`).
2. **Move or copy** the file into your **Waitlist-app** folder (the same folder as `server.js`).
3. Confirm the file is there, e.g.:
   ```
   Waitlist-app/
     server.js
     google-credentials.json   ← here
     ...
   ```
4. The file is in `.gitignore`, so it won’t be committed to git.

---

## Step 6: Share your Google Sheet with the service account

1. Open the downloaded JSON file and find the **`client_email`** line. It looks like:
   ```json
   "client_email": "waitlist-sheets@your-project-123456.iam.gserviceaccount.com"
   ```
2. **Copy that full email** (including the part after `@`).
3. Open your Google Sheet:  
   https://docs.google.com/spreadsheets/d/1QpfuBX8M-ImmEvO_QuAo1UtaddurCYIEEsRL0DtbLk8/edit
4. Click **Share** (top right).
5. Paste the **client_email** address.
6. Set permission to **Editor**.
7. Click **Send** (you can uncheck “Notify people”).

---

## Step 7: Restart the server and test

1. Stop the server if it’s running (Ctrl+C in the terminal).
2. Start it again:
   ```bash
   npm start
   ```
3. Open http://localhost:3000 and submit an email. It should save to your sheet and show the queue number.

---

## If you use a different filename

If you don’t rename the file to `google-credentials.json`, create or edit a **`.env`** file in the Waitlist-app folder and add:

```env
GOOGLE_CREDENTIALS_FILE=your-actual-filename.json
```

Then restart the server with `npm start`.
