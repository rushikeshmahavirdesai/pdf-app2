# Katina Print

## Install (once)

```powershell
cd "c:\Print App"
npm install
npx playwright install chromium
```

## Run

**Web** — paste URL, download PDF:

```powershell
node server.js
```

Open http://localhost:3456

**CLI** — change the URL:

```powershell
node print.js "https://katinamagazine.org/content/article/open-knowledge/2026/the-commodification-of-sensitive-open-data"
```
