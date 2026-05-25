const fs = require("fs");
const path = require("path");

const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

/** Remove only known widgets from the article clone */
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
];

const PDF_STYLES = `
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
    display: block;
    margin-top: 1.5rem;
    font-size: 0.85rem;
  }
`;

function isLambda() {
  return !!process.env.AWS_LAMBDA_FUNCTION_VERSION;
}

async function launch() {
  var args = ["--disable-blink-features=AutomationControlled"];
  if (isLambda()) {
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
  for (var i = 0; i < 45; i++) {
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
    if (!blocked && s.len > 2000 && s.h1.length > 10) return s.h1;
    await new Promise(function (r) {
      setTimeout(r, 2000);
    });
  }
  throw new Error("Article did not load. Try again in a minute.");
}

async function extractArticleHtml(page) {
  return page.evaluate(function (removeSels) {
    function textLen(el) {
      return (el.innerText || "").replace(/\s+/g, " ").trim().length;
    }

    function isJunk(el) {
      var cls = (el.className || "").toString().toLowerCase();
      var id = (el.id || "").toString().toLowerCase();
      return /dialog|modal|newsletter|cookie|overlay|sidebar|popup|promo/.test(
        cls + " " + id
      );
    }

    var root =
      document.querySelector("#main-content-container") ||
      document.querySelector("main") ||
      document.querySelector("article");

    if (!root || textLen(root) < 400) {
      var best = null;
      var bestLen = 0;
      document.querySelectorAll("div, section, article, main").forEach(function (el) {
        if (isJunk(el)) return;
        var len = textLen(el);
        if (len > bestLen && len < textLen(document.body) * 0.95) {
          best = el;
          bestLen = len;
        }
      });
      root = best || document.body;
    }

    var clone = root.cloneNode(true);

    removeSels.forEach(function (sel) {
      clone.querySelectorAll(sel).forEach(function (el) {
        if (
          !el.closest(".copyright") &&
          !el.classList.contains("copyright")
        ) {
          el.remove();
        }
      });
    });

    clone.querySelectorAll("nav, aside, button").forEach(function (el) {
      el.remove();
    });

    var len = textLen(clone);
    if (len < 400) return null;

    return { html: clone.innerHTML, len: len, title: (clone.querySelector("h1") || {}).innerText || "" };
  }, REMOVE);
}

function pdfContainsText(buf, keywords) {
  var raw = buf.toString("latin1");
  if (buf.length < 15000) return false;
  return keywords.some(function (k) {
    return raw.indexOf(k) >= 0;
  });
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
    var h1 = await waitForArticle(page);

    var extracted = await extractArticleHtml(page);
    if (!extracted) {
      throw new Error("Could not extract article content.");
    }

    var printPage = await context.newPage();
    var doc =
      "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
      "<base href='" +
      url.replace(/'/g, "%27") +
      "'>" +
      "<style>" +
      PDF_STYLES +
      "</style></head><body>" +
      extracted.html +
      "</body></html>";

    await printPage.setContent(doc, { waitUntil: "load", timeout: 60000 });
    await new Promise(function (r) {
      setTimeout(r, 2000);
    });

    var checkLen = await printPage.evaluate(function () {
      return document.body.innerText.replace(/\s+/g, " ").trim().length;
    });
    if (checkLen < 400) {
      throw new Error("Print page has no content.");
    }

    var pdf = await printPage.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
    });

    var keyword = (extracted.title || h1 || "article").split(/\s+/)[0];
    if (!pdfContainsText(pdf, [keyword, "Katina", "the", "and"])) {
      throw new Error("PDF is empty. Try again.");
    }

    await printPage.close();
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
      body: JSON.stringify({ error: "Invalid Katina article URL." }),
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
