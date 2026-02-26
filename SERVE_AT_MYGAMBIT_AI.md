# Serve the app at mygambit.ai so anyone can open it from any computer

Follow these steps in order. You need: (1) the app deployed on the internet, (2) your domain mygambit.ai pointed at that deployment.

---

## Part 1: Deploy the app on Render (if not done yet)

1. Go to **[render.com](https://render.com)** and sign in (or create an account with GitHub).
2. Click **New +** → **Web Service**.
3. Connect your repository **stavenka/waitlist-app** (or your repo). If you haven’t pushed the code, push it from your computer first (`git push`).
4. Configure:
   - **Name:** e.g. `waitlist-app`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free (or paid if you prefer)
5. Under **Environment**, add:
   - **SPREADSHEET_ID** = your Google Sheet ID (from the sheet URL)
   - **SHEET_NAME** = `Waitlist`
   - **GOOGLE_CREDENTIALS_JSON** = the entire contents of your `google-credentials.json` file (paste as one line)
6. Click **Create Web Service** and wait until the deploy finishes (logs show “Google Sheet OK”).
7. Note your Render URL at the top, e.g. **https://waitlist-app-xxxx.onrender.com**. You’ll use it in Part 2.

---

## Part 2: Add your domain mygambit.ai in Render

1. In Render, open your **waitlist** web service.
2. Go to **Settings** (left sidebar).
3. Scroll to **Custom Domains**.
4. Click **Add Custom Domain**.
5. Enter: **mygambit.ai** (or **www.mygambit.ai** if you prefer people to use www).
6. Click **Save**. Render will show you what to set in DNS, for example:
   - **Type:** CNAME  
   - **Name:** `@` (for mygambit.ai) or `www` (for www.mygambit.ai)  
   - **Value:** something like **waitlist-app-xxxx.onrender.com** (your Render hostname, no `https://`)

   If Render asks for an **A record** instead, it will give you an IP address; use that.

---

## Part 3: Point mygambit.ai to Render in your DNS

1. Log in to the place where you **manage the domain mygambit.ai** (e.g. GoDaddy, Namecheap, Google Domains, Cloudflare, etc.).
2. Open **DNS** or **DNS settings** or **Manage DNS** for mygambit.ai.
3. Add (or edit) a record exactly as Render told you in Part 2. Typical cases:

   **Option A – Use the root domain mygambit.ai (recommended)**  
   - Type: **CNAME** (or **ALIAS** / **ANAME** if your provider offers it for the root)  
   - Name/Host: **@** (or leave blank, meaning “root”)  
   - Value/Target: **waitlist-app-xxxx.onrender.com** (your actual Render hostname from Part 1)  
   - TTL: 3600 or “Auto”

   **Option B – Use www.mygambit.ai**  
   - Type: **CNAME**  
   - Name/Host: **www**  
   - Value/Target: **waitlist-app-xxxx.onrender.com**  
   - TTL: 3600 or “Auto”

   If your registrar does not allow CNAME on the root (@), use **www** (Option B) and in Part 2 add **www.mygambit.ai** in Render. Then people open **https://www.mygambit.ai**.

4. Save the DNS changes. It can take from a few minutes up to 24–48 hours to apply (often 5–15 minutes).

---

## Part 4: Turn on HTTPS for mygambit.ai (Render)

1. Back in Render → your service → **Settings** → **Custom Domains**.
2. After DNS has propagated, Render will show the domain as “Verified” and will issue an SSL certificate.
3. Ensure **Enforce HTTPS** (or similar) is on so people always get **https://mygambit.ai**.

---

## Part 5: Use the app from any computer

1. From **any** device (another computer, phone, tablet), open a browser and go to:
   - **https://mygambit.ai**  
   or, if you used www:  
   - **https://www.mygambit.ai**
2. The waitlist page loads. People can enter their email and submit; emails go to your Google Sheet.
3. No need for “localhost” or “npm start” for visitors—only the Render URL (or mygambit.ai) is required.

---

## Checklist

- [ ] App deployed on Render and env vars set (SPREADSHEET_ID, SHEET_NAME, GOOGLE_CREDENTIALS_JSON).
- [ ] Custom domain **mygambit.ai** (or **www.mygambit.ai**) added in Render.
- [ ] DNS record (CNAME or A) for mygambit.ai pointing to your Render service.
- [ ] Wait for DNS to propagate; then HTTPS should work on mygambit.ai.
- [ ] Open **https://mygambit.ai** from another device and test the form.

---

## If something doesn’t work

- **“Site can’t be reached” at mygambit.ai**  
  DNS may not have updated yet. Wait up to 24–48 hours, or double-check the CNAME/A record matches exactly what Render shows.

- **Form says “Couldn’t connect”**  
  Make sure you’re opening **https://mygambit.ai** (or https://www.mygambit.ai), not a file or localhost. The app is already set to use **https://mygambit.ai** in the code.

- **Emails not saving**  
  Check Render logs and that GOOGLE_CREDENTIALS_JSON, SPREADSHEET_ID, and SHEET_NAME are correct, and that the Google Sheet is shared with the service account email from your credentials.
