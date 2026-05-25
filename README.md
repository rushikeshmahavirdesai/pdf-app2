# Katina Print (Playwright)

Local app — paste a Katina article URL, get a PDF. No web server.

## Setup (once)

```bash
npm install
npm run setup
```

## Run

```bash
npm start
```

Paste the article URL when asked.

Or pass the URL directly:

```bash
node print.js "https://katinamagazine.org/content/article/open-knowledge/2026/the-commodification-of-sensitive-open-data"
```

PDF saves in this folder as `article-name.pdf`.

## Print CSS

`katina-print.css` hides sharing, tags, YMAL, Disqus, Hypothesis, comments, newsletter. Keeps copyright. Images don’t split across pages.
