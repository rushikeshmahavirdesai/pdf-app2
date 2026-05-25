# Katina Print

Minimal tool to download print CSS for Katina Magazine articles and generate cleaned PDFs.

## Local development

**Recommended** (functions work on port 8888):

```bash
npm run dev
```

Open **http://localhost:8888**

Alternative with Netlify CLI:

```bash
npm run dev:netlify
```

Do **not** use Live Server or another static-only server on 8888 — `/.netlify/functions/fetch-article` will return 404 without the function handler.
4. Paste a Katina article URL, e.g.  
   `https://katinamagazine.org/content/article/future-of-work/2025/how-were-thinking-about-the-future-of-work`

## Deploy to Netlify

1. Push this folder to GitHub (or drag-and-drop deploy).
2. In Netlify: **Add new site** → import repo or upload folder.
3. Build settings (auto-detected from `netlify.toml`):
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
   - **Build command:** (leave empty)
4. Deploy. Functions run at `/.netlify/functions/fetch-article`.

## Usage

- **Download CSS** — saves `katina-print.css` for use on Katina pages or in the app.
- **Download PDF** — fetches the article, strips sharing, tags, comments, Disqus, Hypothesis, YMAL, and newsletter blocks; keeps the copyright paragraph; downloads a PDF.

Katina blocks server fetches (HTTP 403). **Download PDF** opens the article in your browser, copies a short script to the clipboard, then you paste it in the address bar on that tab (Ctrl+L → Ctrl+V → Enter) to generate the PDF. **Download CSS** still works anytime.
