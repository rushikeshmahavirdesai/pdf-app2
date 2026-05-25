const fs = require("fs");
const path = require("path");

const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

const REMOVE = [
  "script",
  "noscript",
  "iframe",
  "nav",
  "aside",
  ".sidebar",
  "button",
  "#disqus_thread",
  ".disqus",
  "#hypothesis-sidebar",
  "[class*='hypothesis']",
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
];

function loadCss() {
  var p = path.join(__dirname, "../../public/katina-print.css");
  return fs.readFileSync(p, "utf8");
}

function isServerless() {
  return !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_VERSION);
}

async function launch() {
  var args = ["--disable-blink-features=AutomationControlled"];
  if (isServerless()) {
    var chromiumPkg = require("@sparticuz/chromium");
    var { chromium } = require("playwright-core");
    return chromium.launch({
      args: chromiumPkg.args.concat(args),
      executablePath: await chromiumPkg.executablePath(),
      headless: chromiumPkg.headless,
    });
  }
  var { chromium } = require("playwright");
  return chromium.launch({ headless: true, args: args });
}

async function waitForArticle(page) {
  for (var i = 0; i < 40; i++) {
    var s = await page.evaluate(function () {
      return {
        title: document.title,
        len: document.body.innerText.replace(/\s+/g, " ").trim().length,
        h1: (document.querySelector("h1") || {}).innerText || "",
      };
    });
    var blocked =
      s.title.indexOf("Just a moment") >= 0 ||
      s.title.indexOf("security verification") >= 0 ||
      s.h1 === "katinamagazine.org";
    if (!blocked && s.len > 2000 && s.h1.length > 10) return;
    await new Promise(function (r) {
      setTimeout(r, 2000);
    });
  }
  throw new Error("Article did not load. Try again.");
}

async function generatePdf(url) {
  var browser = await launch();
  try {
    var context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(function () {
      Object.defineProperty(navigator, "webdriver", {
        get: function () {
          return undefined;
        },
      });
    });
    var page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitForArticle(page);

    await page.evaluate(function (selectors) {
      selectors.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          if (
            !el.closest(".copyright") &&
            !el.classList.contains("copyright")
          ) {
            el.remove();
          }
        });
      });
    }, REMOVE);

    await page.addStyleTag({ content: loadCss() });
    await page.emulateMedia({ media: "print" });

    var pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });

    if (pdf.length < 10000) {
      throw new Error("PDF is empty. Try again.");
    }
    return pdf;
  } finally {
    await browser.close();
  }
}

var cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", ...cors },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  var url = event.queryStringParameters && event.queryStringParameters.url;
  if (!url || !ARTICLE_URL_RE.test(url)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", ...cors },
      body: JSON.stringify({
        error: "Invalid Katina article URL.",
      }),
    };
  }

  try {
    var pdf = await generatePdf(url);
    var slug = url.split("/").filter(Boolean).pop() || "katina-article";
    return {
      statusCode: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="' + slug + '.pdf"',
      },
      body: pdf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", ...cors },
      body: JSON.stringify({ error: err.message || "PDF failed" }),
    };
  }
};
