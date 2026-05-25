const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

const REMOVE = [
  "script",
  "noscript",
  "iframe",
  "#disqus_thread",
  ".disqus",
  "#hypothesis-sidebar",
  ".share-tools",
  ".social-share",
  ".tags",
  ".tag-list",
  ".article-tags",
  ".ymal",
  ".you-may-also-like",
  ".comments",
  ".comment-section",
  ".newsletter",
  "[class*='newsletter']",
  "[class*='join-our-community']",
  "[class*='you-may-also-like']",
  "[class*='related-article']",
  "[class*='layout-menu']",
  "#layout-menu",
  "nav",
  "aside",
  "button",
];

const PDF_CSS = fs.readFileSync(
  path.join(__dirname, "katina-print.css"),
  "utf8"
);

async function askUrl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question("Paste Katina article URL: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function waitForArticle(page) {
  for (let i = 0; i < 45; i++) {
    const s = await page.evaluate(() => ({
      title: document.title,
      len: document.body.innerText.replace(/\s+/g, " ").trim().length,
      h1: document.querySelector("h1")?.innerText?.trim() || "",
    }));
    const blocked =
      s.title.includes("Just a moment") ||
      s.title.includes("security verification") ||
      s.h1 === "katinamagazine.org";
    if (!blocked && s.len > 2000 && s.h1.length > 10) return s.h1;
    await page.waitForTimeout(2000);
  }
  throw new Error("Article did not load (Cloudflare). Try again.");
}

async function extractHtml(page) {
  return page.evaluate((removeSels) => {
    const root =
      document.querySelector("#main-content-container") ||
      document.querySelector("main") ||
      document.querySelector("article");
    if (!root) return null;

    const clone = root.cloneNode(true);
    removeSels.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => {
        if (
          !el.closest(".copyright") &&
          !el.classList.contains("copyright")
        ) {
          el.remove();
        }
      });
    });

    const len = clone.innerText.replace(/\s+/g, " ").trim().length;
    if (len < 400) return null;
    return clone.innerHTML;
  }, REMOVE);
}

async function printArticle(url, outPath) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    const page = await context.newPage();
    console.log("Opening article…");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });

    const title = await waitForArticle(page);
    console.log("Loaded:", title);

    const html = await extractHtml(page);
    if (!html) throw new Error("Could not extract article.");

    const printPage = await context.newPage();
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${url}"><style>${PDF_CSS}</style></head><body class="katina-print-root">${html}</body></html>`;

    await printPage.setContent(doc, { waitUntil: "load", timeout: 60000 });
    await printPage.waitForTimeout(2000);

    await printPage.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });

    const size = fs.statSync(outPath).size;
    if (size < 10000) throw new Error("PDF looks empty.");
    console.log("Saved:", outPath, `(${(size / 1024).toFixed(0)} KB)`);
  } finally {
    await browser.close();
  }
}

async function main() {
  let url = process.argv[2];
  if (!url) url = await askUrl();

  if (!ARTICLE_URL_RE.test(url)) {
    console.error("URL must be: https://katinamagazine.org/content/article/...");
    process.exit(1);
  }

  const slug = url.split("/").filter(Boolean).pop() || "katina-article";
  const outPath = path.join(process.cwd(), slug + ".pdf");

  try {
    await printArticle(url, outPath);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
