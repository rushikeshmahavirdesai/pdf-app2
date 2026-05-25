# Katina Print

Minimal tool to download print CSS for Katina Magazine articles and generate cleaned PDFs with **Playwright**.

## Setup (first time)

```bash
npm install
npm run setup
```

`npm run setup` installs Chromium for local Playwright PDF generation.

## Local development

```bash
npm run dev
```

Open **http://localhost:8888**

Or with Netlify CLI:

```bash
npm run dev:netlify
```

## Usage

- **Download CSS** — saves `katina-print.css`
- **Download PDF** — Playwright opens the article in headless Chrome, applies print CSS, strips clutter, returns a PDF (may take up to a minute)

## Deploy to Netlify

1. Connect [pdf-app2](https://github.com/rushikeshmahavirdesai/pdf-app2) to Netlify
2. Settings from `netlify.toml`:
   - Publish: `public`
   - Functions: `netlify/functions`
   - Build command: `npm install`
3. Deploy. The `generate-pdf` function uses serverless Chromium (`@sparticuz/chromium`).

**Note:** Katina may still block automated browsers from some datacenter IPs. If PDF fails on Netlify, use **Download CSS** on the live article page.
