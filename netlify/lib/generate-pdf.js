const fs = require("fs");
const path = require("path");

const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

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
  "[class*='newsletter']",
  "[class*='join-our-community']",
  "[class*='you-may-also-like']",
  "[class*='related-article']",
  "[class*='layout-menu']",
  "#layout-menu",
  ".sidebar",
  "aside",
  "nav",
  "button",
];

function getPrintCss() {
  const paths = [
    path.join(__dirname, "../../public/katina-print.css"),
    path.join(__dirname, "katina-print.css"),
    path.join(process.cwd(), "public/katina-print.css"),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  throw new Error("katina-print.css not found");
}

function isServerless() {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
    process.env.NETLIFY ||
    process.env.AWS_EXECUTION_ENV
  );
}

async function launchBrowser() {
  const args = ["--disable-blink-features=AutomationControlled"];

  if (isServerless()) {
    const chromiumPkg = require("@sparticuz/chromium");
    const { chromium } = require("playwright-core");
    return chromium.launch({
      args: [...chromiumPkg.args, ...args],
      executablePath: await chromiumPkg.executablePath(),
      headless: chromiumPkg.headless,
    });
  }

  const { chromium } = require("playwright");
  return chromium.launch({ headless: true, args });
}

async function waitForRealArticle(page) {
  for (let i = 0; i < 40; i++) {
    const state = await page.evaluate(() => ({
      title: document.title,
      bodyLen: document.body.innerText.replace(/\s+/g, " ").trim().length,
      h1: document.querySelector("h1")?.innerText?.trim() || "",
    }));

    const blocked =
      state.title.includes("Just a moment") ||
      state.title.includes("security verification") ||
      state.h1 === "katinamagazine.org";

    if (!blocked && state.bodyLen > 2000 && state.h1.length > 10) {
      return state;
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error(
    "Article did not load (site security check). Try again in a minute."
  );
}

async function generatePdf(articleUrl) {
  if (!ARTICLE_URL_RE.test(articleUrl)) {
    throw new Error(
      "Invalid URL. Use: https://katinamagazine.org/content/article/..."
    );
  }

  const browser = await launchBrowser();

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

    await page.goto(articleUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    await waitForRealArticle(page);

    await page.evaluate((selectors) => {
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (
            !el.closest(".copyright") &&
            !el.classList.contains("copyright")
          ) {
            el.remove();
          }
        });
      });
    }, REMOVE_SELECTORS);

    await page.addStyleTag({ content: getPrintCss() });
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });

    if (pdf.length < 10000) {
      throw new Error(
        "PDF is empty — article may not have loaded. Please try again."
      );
    }

    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf, ARTICLE_URL_RE };
