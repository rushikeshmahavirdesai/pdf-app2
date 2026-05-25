const fs = require("fs");
const path = require("path");

const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "header.site-header",
  "footer.site-footer",
  "aside",
  "iframe",
  "button",
  "#disqus_thread",
  ".disqus",
  "[id*='disqus']",
  "[class*='disqus']",
  "#hypothesis-sidebar",
  "[class*='hypothesis']",
  "[class*='share']",
  "[class*='sharing']",
  "[class*='tag-list']",
  "[class*='article-tag']",
  ".tags",
  ".tag-list",
  "[class*='ymal']",
  "[class*='you-may']",
  "[class*='related-article']",
  "[class*='comment']",
  "[class*='newsletter']",
  "[class*='community-form']",
  "[class*='advert']",
  "[class*='layout-menu']",
  "#layout-menu",
  ".sidebar",
  "[class*='promo']",
  "[role='navigation']",
];

function getPrintCss() {
  const candidates = [
    path.join(__dirname, "../../public/katina-print.css"),
    path.join(__dirname, "katina-print.css"),
    path.join(process.cwd(), "public/katina-print.css"),
  ];
  for (const cssPath of candidates) {
    if (fs.existsSync(cssPath)) {
      return fs.readFileSync(cssPath, "utf8");
    }
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
    });

    await page.goto(articleUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    await page
      .waitForSelector(
        "article, main, [class*='article-body'], [class*='article-content']",
        { timeout: 45000 }
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 4000));

    const title = await page.title();
    if (title.includes("Just a moment") || title.includes("Attention Required")) {
      throw new Error(
        "Site security check blocked automated access. Try again or use Download CSS on the live article."
      );
    }

    await page.addStyleTag({ content: getPrintCss() });

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

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf, ARTICLE_URL_RE };
