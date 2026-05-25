const fs = require("fs");
const path = require("path");

const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

/** Only remove known widgets — avoid [class*="…"] that can match article body */
const REMOVE_SELECTORS = [
  "script",
  "noscript",
  "iframe",
  "#disqus_thread",
  ".disqus",
  "#hypothesis-sidebar",
  ".share-tools",
  ".social-share",
  ".you-may-also-like",
  ".ymal",
  ".tags",
  ".tag-list",
  ".article-tags",
  ".comments",
  ".comment-section",
  ".newsletter",
  "#layout-menu",
  ".sidebar",
  "[class*='layout-menu']",
  "[class*='newsletter']",
  "[class*='join-our-community']",
  "[class*='you-may-also-like']",
  "[class*='related-article']",
];

const PDF_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  h1, h2, h3, h4 {
    font-family: "Helvetica Neue", Arial, sans-serif;
    line-height: 1.25;
    page-break-after: avoid;
  }
  h1 { font-size: 1.75rem; margin: 0 0 0.75rem; }
  h2 { font-size: 1.35rem; margin: 1.25rem 0 0.5rem; }
  h3 { font-size: 1.15rem; margin: 1rem 0 0.4rem; }
  p { margin: 0 0 0.75rem; orphans: 3; widows: 3; }
  a { color: #000; text-decoration: underline; }
  img, figure, picture {
    break-inside: avoid;
    page-break-inside: avoid;
    max-width: 100%;
    height: auto;
  }
  .copyright, [class*="copyright"] {
    display: block !important;
    margin-top: 1.5rem;
    font-size: 0.85rem;
    color: #333;
  }
`;

function isServerless() {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
    process.env.NETLIFY ||
    process.env.AWS_EXECUTION_ENV
  );
}

async function launchBrowser() {
  if (isServerless()) {
    const chromiumPkg = require("@sparticuz/chromium");
    const { chromium } = require("playwright-core");
    return chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: chromiumPkg.headless,
    });
  }

  const { chromium } = require("playwright");
  return chromium.launch({ headless: true });
}

async function waitForArticleContent(page) {
  await page.waitForFunction(
    () => {
      const paragraphs = [...document.querySelectorAll("p")];
      const longText = paragraphs.some((p) => p.innerText.trim().length > 100);
      const title = document.querySelector("h1");
      return longText && title && title.innerText.trim().length > 5;
    },
    { timeout: 90000 }
  );
}

async function extractArticleHtml(page) {
  return page.evaluate((selectors) => {
    const root =
      document.querySelector("article") ||
      document.querySelector("[class*='article-body']") ||
      document.querySelector("[class*='article-content']") ||
      document.querySelector("main .content") ||
      document.querySelector("main") ||
      document.querySelector(".content");

    if (!root) return null;

    const clone = root.cloneNode(true);
    selectors.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => {
        if (
          !el.closest(".copyright") &&
          !el.classList.contains("copyright")
        ) {
          el.remove();
        }
      });
    });

    clone.querySelectorAll("nav, aside, button").forEach((el) => el.remove());

    const text = clone.innerText.replace(/\s+/g, " ").trim();
    if (text.length < 200) return null;

    return clone.innerHTML;
  }, REMOVE_SELECTORS);
}

async function generatePdf(articleUrl) {
  if (!ARTICLE_URL_RE.test(articleUrl)) {
    throw new Error(
      "Invalid URL. Use a Katina article link: https://katinamagazine.org/content/article/..."
    );
  }

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });

    await page.goto(articleUrl, {
      waitUntil: "networkidle",
      timeout: 120000,
    });

    const title = await page.title();
    if (
      title.includes("Just a moment") ||
      title.includes("Attention Required") ||
      title.includes("security verification")
    ) {
      throw new Error(
        "Site security check blocked access. Try again or use Download CSS on the live article."
      );
    }

    await waitForArticleContent(page);

    const articleHtml = await extractArticleHtml(page);
    if (!articleHtml) {
      throw new Error(
        "Article content did not load. Try again in a moment."
      );
    }

    const printPage = await browser.newPage();
    const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${articleUrl}">
  <style>${PDF_CSS}</style>
</head>
<body class="katina-print-root">${articleHtml}</body>
</html>`;

    await printPage.setContent(doc, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await printPage.emulateMedia({ media: "print" });

    const pdf = await printPage.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });

    await printPage.close();

    if (pdf.length < 5000) {
      throw new Error(
        "PDF appears empty. Article may not have loaded fully — try again."
      );
    }

    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf, ARTICLE_URL_RE };
