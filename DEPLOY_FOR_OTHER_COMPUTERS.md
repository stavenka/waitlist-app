# Make the waitlist app work from any computer

Right now the app only works on your computer because the server runs locally. To let **anyone** (or you from another device) use it, you need to put the app on the internet. This guide uses **Render** (free) and does not use Convex.

---

## What you’ll get

- A public URL like `https://waitlist-app-xxxx.onrender.com`
- Anyone can open that URL and join the waitlist; emails still go to your Google Sheet
- You can use the same URL on your phone, another laptop, etc.

---

## Part 1: Push your code to GitHub (if not already)

1. Open [github.com](https://github.com) and sign in.
2. Your repo is: **https://github.com/stavenka/waitlist-app**
3. Make sure the latest code is pushed:
   - On your computer, in the project folder, run:
   - `git add .`
   - `git commit -m "Ready for deployment"`
   - `git push`

---

## Part 2: Create a Render account and connect the app

1. Go to **[render.com](https://render.com)**.
2. Click **Get Started** and sign up (e.g. with GitHub).
3. In the dashboard, click **New +** → **Web Service**.
4. If asked to connect a repository:
   - Click **Connect account** and choose **GitHub**.
   - Authorize Render to see your repos.
5. In the list, select **stavenka/waitlist-app** (or your repo name).
6. Click **Connect**.

---

## Part 3: Configure the web service

1. **Name:** e.g. `waitlist-app` (or any name; it will appear in the URL).
2. **Region:** choose one close to you.
3. **Branch:** `main` (or your default branch).
4. **Runtime:** **Node**.
5. **Build Command:** leave default or set to:
   ```bash
   npm install
   ```
6. **Start Command:** leave default or set to:
   ```bash
   npm start
   ```
7. **Instance type:** **Free** (so you don’t pay).

Scroll down to **Environment Variables** and add these (click **Add Environment Variable** for each):

| Key | Value |
|-----|--------|
| `SPREADSHEET_ID` | Your Google Sheet ID (from the sheet URL: the part between `/d/` and `/edit`). Example: `1QpfuBX8M-ImmEvO_QuAo1UtaddurCYIEEsRL0DtbLk8` |
| `SHEET_NAME` | `Waitlist` (or the exact name of the tab where you want emails) |
| `GOOGLE_CREDENTIALS_JSON` | The **entire contents** of your `google-credentials.json` file (see below) |

**How to get the value for GOOGLE_CREDENTIALS_JSON:**

1. On your computer, open the file **google-credentials.json** in your Waitlist-app folder.
2. Select **all** the text (Cmd+A) and copy (Cmd+C).
3. In Render, for **GOOGLE_CREDENTIALS_JSON**, paste that whole text as the value.
   - It must be **one line** (no line breaks). If Render complains, paste it into a text editor, remove all line breaks so it’s a single line, then paste that into Render.

Then click **Create Web Service**.

---

## Part 4: Wait for the first deploy

1. Render will build and start your app (usually 2–5 minutes).
2. Watch the **Logs** tab; wait until you see something like:
   - `Server running at http://localhost:XXXX`
   - `Google Sheet OK. Tabs: Waitlist`
3. At the top of the page you’ll see your app’s URL, e.g.:
   - **https://waitlist-app-xxxx.onrender.com**

---

## Part 5: Use the app from any computer

1. Open that URL (e.g. **https://waitlist-app-xxxx.onrender.com**) in a browser on **any** device (another computer, phone, tablet).
2. Enter an email and submit the form.
3. You should see the success message and the new row in your Google Sheet.

No need to change anything in the code: when people open your Render URL, the form sends the request to the same URL, so it works from anywhere.

---

## Part 6 (optional): Use your own URL when opening the file

If someone opens **index.html** as a file (double‑click) instead of visiting your Render URL, the form will try to use a fallback URL that might not be your app. To point that fallback to your Render app:

1. In the project, open **index.html**.
2. Search for: `judicious-ostrich-949.convex.site`
3. Replace it with your Render URL, e.g. `waitlist-app-xxxx.onrender.com` (no `https://` in the middle of the string if the code already adds it; otherwise use the full URL as in the existing pattern).

Most users should use the Render link from Part 5; this step is only for the “open file” case.

---

## Troubleshooting

- **“Waitlist is not configured yet”**  
  Check that **GOOGLE_CREDENTIALS_JSON** is set in Render and is the full JSON (one line), and that **SPREADSHEET_ID** and **SHEET_NAME** are correct.

- **“Waitlist sheet is not set up correctly”**  
  The Google Sheet must be shared with the **client_email** from your credentials (the same one you use locally). Open the sheet → Share → add that email as **Editor**.

- **App is slow or sleeps**  
  On the free plan, the service may sleep after a while; the first visit after that can be slow. Upgrading to a paid plan keeps it always on.

- **Changes not showing**  
  After you change code, run `git add .`, `git commit -m "Your message"`, `git push`. Render will redeploy automatically if it’s connected to the same branch.

---

## Summary

1. Push latest code to GitHub.  
2. Sign up at Render and create a **Web Service** from your repo.  
3. Set **SPREADSHEET_ID**, **SHEET_NAME**, and **GOOGLE_CREDENTIALS_JSON** in Environment Variables.  
4. Deploy and copy your app URL.  
5. Open that URL on any computer (or phone) and use the waitlist; emails go to your Google Sheet.
