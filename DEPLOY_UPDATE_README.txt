IMPORTANT: So other people can submit emails from other computers
===============================================================

The code is now fixed so the form always posts to the SAME site people are viewing
(e.g. https://mygambit.ai/api/waitlist when they open https://mygambit.ai).

You MUST deploy this updated code so the live site at mygambit.ai uses it:

1. Push to GitHub:
   git add .
   git commit -m "Fix form for visitors on mygambit.ai"
   git push

2. If mygambit.ai is hosted on Render:
   - Render will auto-redeploy when you push (if connected to GitHub).
   - Wait 2-5 minutes, then test from another device or ask someone to try.

3. If you use another host (e.g. Convex, Netlify):
   - Trigger a redeploy so it pulls the latest code from GitHub.
   - Make sure the HOST that serves mygambit.ai is the one running the Node app
     (server.js with /api/waitlist). If mygambit.ai only serves static HTML/JS
     and the Node app runs elsewhere, the form will keep failing for visitors.
     mygambit.ai must point to the SAME server that runs "npm start" (e.g. Render).

4. Test from another computer:
   - Open https://mygambit.ai in a browser (not localhost, not a file).
   - Enter an email and submit. It should work.
