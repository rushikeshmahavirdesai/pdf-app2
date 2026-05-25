# Katina Print (Playwright)

Local app — give a Katina article URL, get a styled PDF.

## Setup (once)

```bash
npm install
npm run setup
```

## Run (change the URL)

```bash
node print.js "PASTE-ARTICLE-URL-HERE"
```

PDF saves here as `article-slug.pdf`.

Interactive (paste when asked):

```bash
npm start
```

## Example articles

```bash
node print.js "https://katinamagazine.org/content/article/future-of-work/2026/university-of-arkansas-twenty-first-century-library"

node print.js "https://katinamagazine.org/content/article/open-knowledge/2026/what-are-open-infrastructure-evaluation-frameworks-for"

node print.js "https://katinamagazine.org/content/article/future-of-work/2026/building-a-shared-cultural-behaviors-program"

node print.js "https://katinamagazine.org/content/article/resource-reviews/2026/consortial-coordination-for-advancing-accessibility"

node print.js "https://katinamagazine.org/content/article/open-knowledge/2026/the-commodification-of-sensitive-open-data"
```

## Print all examples

```bash
npm run examples
```

## Print CSS

`katina-print.css` hides sharing, tags, YMAL, Disqus, Hypothesis, comments, newsletter. Keeps copyright. Images don’t split across pages.
