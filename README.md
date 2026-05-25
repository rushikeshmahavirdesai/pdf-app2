# Katina Print

Paste a Katina article URL → download a cleaned PDF (original site styling). Local CLI or minimal web UI.

## Setup (once)

```powershell
cd "c:\Print App"
npm install
npx playwright install chromium
```

## CLI — change only the quoted URL

```powershell
node print.js "https://katinamagazine.org/content/article/open-knowledge/2026/the-commodification-of-sensitive-open-data"
```

PDF saves in this folder as `article-slug.pdf`.

Interactive (paste when prompted):

```powershell
node print.js
```

## Web UI

```powershell
node server.js
```

Open **http://localhost:3456**, paste URL, click **Download PDF**.

**Download CSS:** click **Download CSS** on the same page, or open http://localhost:3456/katina-print.css.

(Port **3456** avoids conflict with Netlify dev on 8888. Override with `set PORT=8888` if needed.)

> If `npm run dev` fails (PowerShell script policy), use `node server.js` and `node print.js` instead.

## Example articles

```powershell
node print.js "https://katinamagazine.org/content/article/future-of-work/2026/university-of-arkansas-twenty-first-century-library"

node print.js "https://katinamagazine.org/content/article/open-knowledge/2026/the-commodification-of-sensitive-open-data"
```

All examples:

```powershell
node print-examples.js
```

## Print CSS

`katina-print.css` is for browser **Print → Save as PDF** on Katina pages. The app also strips sharing, tags, “You may also like”, Disqus, Hypothesis, comments, and newsletter forms; keeps the copyright paragraph; avoids images splitting across pages.

## Deploy on Netlify

1. Push this repo to GitHub and connect the site on Netlify.
2. Build settings (from `netlify.toml`): **publish** `public`, **functions** `netlify/functions`, build command `npm install`.
3. Redeploy after each push.

`POST /api/pdf` is handled by a serverless function (Playwright + Chromium). PDF generation often takes **20–60 seconds** — use a **Pro** plan if functions hit the 10s free-tier limit (this project sets a **26s** timeout for `api-pdf`).

If PDF fails with Cloudflare or timeout errors, use the local app (`node server.js`) instead.

## Project layout

```
lib/print-article.js   # Playwright PDF engine (shared)
print.js               # CLI
server.js              # Local web + POST /api/pdf
public/                # Web UI
katina-print.css       # Downloadable print stylesheet
```
