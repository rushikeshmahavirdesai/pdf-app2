# Katina Print

Simple **client-side** app (static files only). Deploy to Netlify — no build, no server functions.

## Files

- `public/index.html` — URL input + Download CSS + Download PDF
- `public/katina-print.css` — print stylesheet for Katina articles
- `public/app.js` — fetches article, builds PDF in the browser

## Local

Open `public/index.html` in a browser, or:

```bash
npx serve public
```

## Netlify

Publish directory: `public`

## Print CSS

Hides: sharing, tags, you-may-also-like, Disqus, Hypothesis, comments, newsletter.  
Keeps: article body and copyright.  
Images do not split across pages.

## PDF note

PDF is generated in your browser. If fetch is blocked, the article opens in a new tab — use **Ctrl+P** → Save as PDF (with Download CSS installed as a user stylesheet).
