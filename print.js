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
  "button",
];

const PRINT_CSS = fs.readFileSync(
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

async function grabArticleBundle(page) {
  return page.evaluate((removeSels) => {
    const root =
      document.querySelector("#main-content-container") ||
      document.querySelector("main") ||
      document.querySelector("article");
    if (!root) return null;

    const copyright = document.querySelector(
      ".copyright, [class*='copyright']"
    );

    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((l) => l.outerHTML)
      .join("\n");

    const clone = root.cloneNode(true);
    clone.querySelectorAll("script, noscript, link").forEach((el) => el.remove());

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

    let html = clone.innerHTML;
    const len = clone.innerText.replace(/\s+/g, " ").trim().length;
    if (len < 400) return null;

    if (
      copyright &&
      copyright.innerText.trim().length > 10 &&
      !html.toLowerCase().includes("copyright")
    ) {
      html +=
        '<div class="copyright">' + copyright.innerHTML + "</div>";
    }

    return { html, styles, len };
  }, REMOVE);
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("img")];
    await Promise.all(
      imgs.map((img) => {
        if (img.complete) return;
        return new Promise((r) => {
          img.onload = r;
          img.onerror = r;
          setTimeout(r, 8000);
        });
      })
    );
  });
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
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });

    const title = await waitForArticle(page);
    console.log("Loaded:", title);

    const bundle = await grabArticleBundle(page);
    if (!bundle) throw new Error("Could not extract article.");

    console.log("Building PDF with Katina styles + print CSS…");

    const printPage = await context.newPage();
    const safeUrl = url.replace(/"/g, "&quot;");
    const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${safeUrl}">
  ${bundle.styles}
  <style>${PRINT_CSS}</style>
</head>
<body id="katina-print-body">
  <div id="main-content-container" class="js-main-content-container">
    ${bundle.html}
  </div>
</body>
</html>`;

    await printPage.setContent(doc, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await waitForImages(printPage);
    await printPage.emulateMedia({ media: "print" });

    await printPage.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    const size = fs.statSync(outPath).size;
    if (size < 50000) throw new Error("PDF looks empty or too small.");
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
