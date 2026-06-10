# KNS College website

Repo for the KNS College site — programmes, admissions, online courses, scholarships, contact forms, and fee payments.

**Abdul Salim Gani** — lead developer

## What this is

Static pages (HTML, CSS, JS) plus a Node API in `server.js`. Supabase holds the data. SendGrid sends mail. Monime handles online course payments (USSD / Orange Money / Afrimoney).

## Stack

- Frontend: HTML, CSS, vanilla JS  
- Backend: Node, Express  
- Database: Supabase  
- Email: SendGrid  
- Payments: Monime  

## Production setup

We run split hosting:

- **https://kns.edu.sl** — static files on Sector Link (IIS). No iisnode, no Node on that server.  
- **kns-college-website.onrender.com** — API on Render.

`config.js` sends API calls from the live site to Render. CORS on the server already allows `kns.edu.sl`.

### Render (API)

1. Connect the repo or use `render.yaml`.  
2. Set env vars in the dashboard. Do not commit `.env.local`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `SENDGRID_*` if you need email
   - `MONIME_ACCESS_TOKEN`, `MONIME_SPACE_ID`, `MONIME_REQUIRE_LIVE_TOKEN=true`
   - `MONIME_ALLOWED_CHECKOUT_ORIGINS=https://kns.edu.sl,https://www.kns.edu.sl`
3. After deploy, check `https://kns-college-website.onrender.com/api/health`.

On the free tier the service sleeps after about 15 minutes idle. Ping `/api/health` every 10–14 minutes (UptimeRobot is fine) or upgrade if you need it always on.

### Sector Link (static site)

Upload HTML, CSS, JS, `images/`, and `web.config`. Skip `server.js`, `node_modules`, and any `.env` files.

### iisnode (optional)

You can run the API on the same IIS box instead of Render, but we are not doing that right now. You would need Node, iisnode, URL Rewrite, and a change in `config.js` to use same-origin for `kns.edu.sl`.

## Local development

```bash
npm install
```

Create `.env.local`:

```env
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=your_verified_sender
SENDGRID_TO_EMAIL=admin_notification_receiver
```

```bash
npm run dev
```

Open the site on localhost. Run `npm start` for the API locally, or point at Render if you prefer.

## If you pick this up later

Read `config.js` first — that is how the frontend finds the API. Most backend logic is in `server.js`. Use a branch per feature. Do not commit `.env`. Test forms locally before you push. Document any new env vars here.

---

Abdul Salim Gani & KNS dev team
