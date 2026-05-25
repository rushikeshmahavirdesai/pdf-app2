(function () {
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
    ".hypothesis",
    "[class*='hypothesis']",
    ".share",
    ".share-tools",
    ".social-share",
    "[class*='share']",
    "[class*='sharing']",
    ".tags",
    ".tag-list",
    ".article-tags",
    "[class*='tag-list']",
    "[class*='article-tag']",
    ".ymal",
    "[class*='ymal']",
    ".you-may-also-like",
    "[class*='you-may']",
    "[class*='related-article']",
    ".comments",
    ".comment-section",
    "[class*='comment']",
    ".newsletter",
    "[class*='newsletter']",
    "[class*='community-form']",
    "[class*='join-our-community']",
    "[class*='advert']",
    "[class*='advertisement']",
    "[class*='layout-menu']",
    "#layout-menu",
    ".sidebar",
    ".promo",
    "[class*='promo']",
    "[role='navigation']",
  ].join(",");

  const ORIGIN = window.location.origin;
  const CSS_URL = ORIGIN + "/katina-print.css";
  const HELPER_URL = ORIGIN + "/pdf-helper.js";

  const urlInput = document.getElementById("url");
  const btnCss = document.getElementById("btn-css");
  const btnPdf = document.getElementById("btn-pdf");
  const statusEl = document.getElementById("status");

  btnCss.addEventListener("click", downloadCss);
  btnPdf.addEventListener("click", downloadPdf);

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("error", !!isError);
  }

  function getUrl() {
    return (urlInput.value || "").trim();
  }

  function validateUrl(url) {
    if (!url) {
      setStatus("Paste a Katina article URL first.", true);
      return false;
    }
    if (!ARTICLE_URL_RE.test(url)) {
      setStatus(
        "URL must be a Katina article: https://katinamagazine.org/content/article/...",
        true
      );
      return false;
    }
    return true;
  }

  function downloadCss() {
    const a = document.createElement("a");
    a.href = "/katina-print.css";
    a.download = "katina-print.css";
    a.click();
    setStatus("CSS downloaded.");
  }

  function buildBookmarklet() {
    const code = [
      "window.__KATINA_PRINT_CSS__=" + JSON.stringify(CSS_URL) + ";",
      "var s=document.createElement('script');",
      "s.src=" + JSON.stringify(HELPER_URL) + ";",
      "document.head.appendChild(s);",
    ].join("");
    return "javascript:" + encodeURI(code);
  }

  async function copyBookmarklet() {
    const href = buildBookmarklet();
    try {
      await navigator.clipboard.writeText(href);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function downloadPdf() {
    const url = getUrl();
    if (!validateUrl(url)) return;

    btnPdf.disabled = true;
    btnCss.disabled = true;
    setStatus("Preparing PDF…");

    try {
      const html = await tryFetchArticle(url);
      if (html) {
        await generatePdfFromHtml(html, url);
        setStatus("PDF downloaded.");
        return;
      }
    } catch (_) {
      /* server blocked — use browser flow */
    }

    const copied = await copyBookmarklet();
    window.open(url, "_blank", "noopener");

    if (copied) {
      setStatus(
        "Article opened. On that tab: click the address bar (Ctrl+L), paste (Ctrl+V), press Enter. PDF will download."
      );
    } else {
      setStatus(
        "Article opened. Drag the “PDF bookmark” link below to your bookmarks, then click it on the article tab.",
        true
      );
      showBookmarkletLink();
    }

    btnPdf.disabled = false;
    btnCss.disabled = false;
  }

  async function tryFetchArticle(url) {
    const res = await fetch(
      `/.netlify/functions/fetch-article?url=${encodeURIComponent(url)}`
    );
    const data = await res.json();
    if (!res.ok || data.error || !data.html) return null;
    return data.html;
  }

  function showBookmarkletLink() {
    let link = document.getElementById("bookmarklet-link");
    if (!link) {
      link = document.createElement("a");
      link.id = "bookmarklet-link";
      link.textContent = "PDF bookmark (drag to bookmarks bar)";
      link.href = buildBookmarklet();
      link.style.display = "block";
      link.style.marginTop = "0.75rem";
      statusEl.after(link);
    }
  }

  async function generatePdfFromHtml(html, url) {
    const container = buildPrintContainer(html, url);
    document.body.appendChild(container);
    await waitForImages(container);

    const slug = url.split("/").filter(Boolean).pop() || "katina-article";
    await html2pdf()
      .set({
        margin: [15, 15, 15, 15],
        filename: slug + ".pdf",
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 800,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(container)
      .save();

    document.body.removeChild(container);
  }

  function buildPrintContainer(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const copyright = doc.querySelector(
      ".copyright, [class*='copyright'], [class*='copyright-notice']"
    );

    doc.querySelectorAll(REMOVE_SELECTORS).forEach((el) => {
      if (copyright && el.contains(copyright)) return;
      el.remove();
    });

    const article =
      doc.querySelector("article") ||
      doc.querySelector("[class*='article-body']") ||
      doc.querySelector("[class*='article-content']") ||
      doc.querySelector("main") ||
      doc.querySelector(".content") ||
      doc.body;

    const container = document.createElement("div");
    container.id = "pdf-preview";
    container.style.cssText =
      "position:fixed;left:-9999px;top:0;width:800px;background:#fff;padding:2rem;";

    const styleLink = document.createElement("link");
    styleLink.rel = "stylesheet";
    styleLink.href = CSS_URL;
    container.appendChild(styleLink);

    const inner = document.createElement("div");
    inner.className = "katina-print-root";
    inner.innerHTML = article.innerHTML;

    if (copyright && !inner.querySelector("[class*='copyright'], .copyright")) {
      const copy = copyright.cloneNode(true);
      copy.classList.add("copyright");
      inner.appendChild(copy);
    }

    fixRelativeUrls(inner, baseUrl);
    container.appendChild(inner);

    return container;
  }

  function fixRelativeUrls(root, baseUrl) {
    root.querySelectorAll("img[src], a[href]").forEach((el) => {
      const attr = el.hasAttribute("src") ? "src" : "href";
      const val = el.getAttribute(attr);
      if (val && !val.startsWith("http") && !val.startsWith("data:")) {
        try {
          el.setAttribute(attr, new URL(val, baseUrl).href);
        } catch (_) {}
      }
    });
  }

  function waitForImages(container) {
    const imgs = [...container.querySelectorAll("img")];
    if (!imgs.length) return Promise.resolve();

    return Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 8000);
          })
      )
    );
  }
})();
