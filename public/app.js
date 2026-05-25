(function () {
  var ARTICLE =
    /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

  var REMOVE =
    "script,noscript,iframe,nav,aside,.sidebar,button," +
    "#disqus_thread,.disqus,#hypothesis-sidebar," +
    ".share-tools,.social-share,.tags,.tag-list,.article-tags," +
    ".ymal,.you-may-also-like,.comments,.comment-section,.newsletter," +
    "[class*='newsletter'],[class*='join-our-community']," +
    "[class*='you-may-also-like'],[class*='related-article']," +
    "[class*='layout-menu'],#layout-menu";

  var urlInput = document.getElementById("url");
  var btnCss = document.getElementById("btn-css");
  var btnPdf = document.getElementById("btn-pdf");
  var status = document.getElementById("status");

  btnCss.onclick = function () {
    var a = document.createElement("a");
    a.href = "/katina-print.css";
    a.download = "katina-print.css";
    a.click();
    setMsg("CSS downloaded.");
  };

  btnPdf.onclick = async function () {
    var url = urlInput.value.trim();
    if (!url) return setMsg("Paste a Katina article URL.", true);
    if (!ARTICLE.test(url)) return setMsg("Must be a Katina article URL.", true);

    btnPdf.disabled = true;
    btnCss.disabled = true;
    setMsg("Preparing PDF…");

    try {
      var html = await fetchArticleHtml(url);
      await makePdf(html, url);
      setMsg("PDF downloaded.");
    } catch (e) {
      openForManualPrint(url);
      setMsg(e.message || "Could not build PDF. Article opened — use Ctrl+P to save as PDF.", true);
    } finally {
      btnPdf.disabled = false;
      btnCss.disabled = false;
    }
  };

  async function fetchArticleHtml(url) {
    var proxy =
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
    var res = await fetch(proxy);
    if (!res.ok) throw new Error("Could not load article.");
    var html = await res.text();
    if (html.indexOf("Just a moment") >= 0) {
      throw new Error("Article blocked. Use manual print.");
    }
    return html;
  }

  function extractArticle(html, baseUrl) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var root =
      doc.querySelector("#main-content-container") ||
      doc.querySelector("main") ||
      doc.querySelector("article");

    if (!root) throw new Error("Article content not found.");

    var copyright = doc.querySelector(
      ".copyright, [class*='copyright']"
    );

    doc.querySelectorAll(REMOVE).forEach(function (el) {
      if (copyright && copyright.contains(el)) return;
      el.remove();
    });

    var inner = document.createElement("div");
    inner.className = "katina-print-root";
    inner.innerHTML = root.innerHTML;

    if (copyright && !inner.querySelector("[class*='copyright'], .copyright")) {
      var copy = copyright.cloneNode(true);
      copy.classList.add("copyright");
      inner.appendChild(copy);
    }

    inner.querySelectorAll("img[src], a[href]").forEach(function (el) {
      var attr = el.hasAttribute("src") ? "src" : "href";
      var val = el.getAttribute(attr);
      if (val && val.indexOf("http") !== 0 && val.indexOf("data:") !== 0) {
        try {
          el.setAttribute(attr, new URL(val, baseUrl).href);
        } catch (err) {}
      }
    });

    var text = inner.innerText.replace(/\s+/g, " ").trim();
    if (text.length < 400) throw new Error("Article text too short.");

    return inner;
  }

  async function makePdf(html, url) {
    var article = extractArticle(html, url);
    var box = document.createElement("div");
    box.style.cssText =
      "position:fixed;left:-9999px;top:0;width:800px;padding:2rem;background:#fff;";

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = location.origin + "/katina-print.css";
    box.appendChild(link);
    box.appendChild(article);
    document.body.appendChild(box);

    await waitImages(box);

    var slug = url.split("/").filter(Boolean).pop() || "article";
    await html2pdf()
      .set({
        margin: 15,
        filename: slug + ".pdf",
        html2canvas: { scale: 2, useCORS: true, width: 800 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(box)
      .save();

    document.body.removeChild(box);
  }

  function waitImages(root) {
    var imgs = Array.from(root.querySelectorAll("img"));
    if (!imgs.length) return Promise.resolve();
    return Promise.all(
      imgs.map(function (img) {
        return new Promise(function (done) {
          if (img.complete) return done();
          img.onload = done;
          img.onerror = done;
          setTimeout(done, 6000);
        });
      })
    );
  }

  function openForManualPrint(url) {
    window.open(url, "_blank", "noopener");
  }

  function setMsg(text, isError) {
    status.textContent = text;
    status.className = isError ? "error" : "";
  }
})();
