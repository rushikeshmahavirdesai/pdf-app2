const fs = require("fs");
const { chromium } = require("playwright");

const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

/** Remove these nodes from the live page (keeps Katina CSS intact) */
const REMOVE = [
  "script",
  "noscript",
  "iframe",
  "#disqus_thread",
  ".disqus",
  "#hypothesis-sidebar",
  ".share-tools",
  ".social-share",
  "[class*='share-bar']",
  "[class*='sharing']",
  ".tags",
  ".tag-list",
  ".article-tags",
  "[class*='tag-list']",
  ".ymal",
  ".you-may-also-like",
  "[class*='you-may-also-like']",
  "[class*='related-article']",
  ".comments",
  ".comment-section",
  "[class*='comment-section']",
  ".newsletter",
  "[class*='newsletter']",
  "[class*='join-our-community']",
  "[class*='community-form']",
  "[class*='layout-menu']",
  "#layout-menu",
  "[class*='advert']",
  "[class*='advertisement']",
  "button",
];

const HELPER_CSS = `
  body { background: #fff !important; }
  nav, aside, .sidebar, [role="navigation"] { display: none !important; }
  #main-content-container {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    float: none !important;
  }
  #main-content-container img,
  #main-content-container figure,
  #main-content-container picture {
    break-inside: avoid;
    page-break-inside: avoid;
    max-width: 100%;
  }
  .copyright, [class*="copyright"] {
    display: block !important;
  }
`;

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

async function cleanPage(page) {
  await page.evaluate((removeSels) => {
    const main = document.querySelector("#main-content-container");

    removeSels.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (main && (el === main || el.contains(main))) return;
        if (
          !el.closest(".copyright") &&
          !el.classList.contains("copyright")
        ) {
          el.remove();
        }
      });
    });

    document.querySelectorAll("nav").forEach((el) => el.remove());

    document.querySelectorAll("aside").forEach((el) => {
      if (!main || !main.contains(el)) el.remove();
    });

    document.querySelectorAll("header").forEach((el) => {
      if (main && !el.contains(main) && !el.closest("#main-content-container")) {
        el.remove();
      }
    });

    document.querySelectorAll("footer").forEach((el) => {
      const hasCopyright =
        el.querySelector(".copyright, [class*='copyright']") ||
        el.classList.contains("copyright") ||
        (el.className && String(el.className).includes("copyright"));
      if (!hasCopyright) el.remove();
    });
  }, REMOVE);
}

async function getClipRect(page) {
  return page.evaluate(() => {
    const main = document.querySelector("#main-content-container");
    if (!main) return null;

    const rects = [main.getBoundingClientRect()];
    const copy = document.querySelector(
      ".copyright, [class*='copyright'], footer [class*='copyright']"
    );
    if (copy) rects.push(copy.getBoundingClientRect());

    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  });
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

/**
 * @param {string} url - Katina article URL
 * @param {string} outPath - Output PDF path
 * @param {{ log?: (msg: string) => void }} [opts]
 * @returns {Promise<{ title: string, size: number, path: string }>}
 */
async function printArticle(url, outPath, opts = {}) {
  const log = opts.log || console.log;

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    const page = await context.newPage();
    log("Opening article…");
    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });

    const title = await waitForArticle(page);
    log("Loaded: " + title);

    log("Removing ads, sidebar, comments…");
    await cleanPage(page);
    await page.addStyleTag({ content: HELPER_CSS });
    await waitForImages(page);
    await page.waitForTimeout(1500);

    const clip = await getClipRect(page);
    if (!clip || clip.height < 200) {
      throw new Error("Could not find article area on page.");
    }

    log("Saving PDF…");
    await page.emulateMedia({ media: "screen" });

    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      clip,
      scale: 0.95,
    });

    const size = fs.statSync(outPath).size;
    if (size < 80000) {
      throw new Error("PDF too small — article may not have rendered.");
    }

    return { title, size, path: outPath };
  } finally {
    await browser.close();
  }
}

function slugFromUrl(url) {
  return url.split("/").filter(Boolean).pop() || "katina-article";
}

module.exports = {
  ARTICLE_URL_RE,
  printArticle,
  slugFromUrl,
};
