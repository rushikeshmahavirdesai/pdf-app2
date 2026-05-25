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

  var ORIGIN = location.origin;

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
      runOnArticlePage(url);
    } finally {
      btnPdf.disabled = false;
      btnCss.disabled = false;
    }
  };

  function fetchWithTimeout(url, ms) {
    return Promise.race([
      fetch(url),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("timeout"));
        }, ms);
      }),
    ]);
  }

  async function fetchArticleHtml(url) {
    var proxies = [
      "https://api.allorigins.win/raw?url=",
      "https://corsproxy.io/?",
    ];
    var lastErr;

    for (var i = 0; i < proxies.length; i++) {
      try {
        var res = await fetchWithTimeout(
          proxies[i] + encodeURIComponent(url),
          20000
        );
        if (!res.ok) continue;
        var html = await res.text();
        if (
          html.indexOf("Just a moment") >= 0 ||
          html.indexOf("security verification") >= 0
        ) {
          continue;
        }
        if (html.length < 1000) continue;
        return html;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("blocked");
  }

  function extractArticle(html, baseUrl) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var root =
      doc.querySelector("#main-content-container") ||
      doc.querySelector("main") ||
      doc.querySelector("article");

    if (!root) throw new Error("Article content not found.");

    var copyright = doc.querySelector(".copyright, [class*='copyright']");

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

    if (inner.innerText.replace(/\s+/g, " ").trim().length < 400) {
      throw new Error("Article text too short.");
    }

    return inner;
  }

  async function makePdf(html, url) {
    var article = extractArticle(html, url);
    var box = document.createElement("div");
    box.style.cssText =
      "position:fixed;left:-9999px;top:0;width:800px;padding:2rem;background:#fff;";

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = ORIGIN + "/katina-print.css";
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

  function buildBookmarklet() {
    var css = ORIGIN + "/katina-print.css";
    var h2 =
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
    var code = [
      "(function(){",
      "var r=document.querySelector('#main-content-container')||document.querySelector('main')||document.body;",
      "var l=document.createElement('link');l.rel='stylesheet';l.href='" + css + "';",
      "document.head.appendChild(l);",
      "var rm='" + REMOVE + "'.split(',');",
      "rm.forEach(function(s){document.querySelectorAll(s).forEach(function(e){",
      "if(!e.closest('.copyright')&&!e.classList.contains('copyright'))e.remove();});});",
      "var s=document.createElement('script');s.src='" + h2 + "';",
      "s.onload=function(){html2pdf().set({margin:15,filename:location.pathname.split('/').pop()+'.pdf',",
      "html2canvas:{scale:2,useCORS:true,width:800},jsPDF:{unit:'mm',format:'a4'}}).from(r).save();};",
      "document.head.appendChild(s);",
      "})();",
    ].join("");
    return "javascript:" + encodeURI(code);
  }

  async function runOnArticlePage(url) {
    window.open(url, "_blank", "noopener");
    var bm = buildBookmarklet();
    var copied = false;
    try {
      await navigator.clipboard.writeText(bm);
      copied = true;
    } catch (err) {}

    if (copied) {
      setMsg(
        "Article opened in new tab. On that tab: Ctrl+L → Ctrl+V → Enter to download PDF.",
        false
      );
    } else {
      setMsg(
        "Article opened. Drag the link below to bookmarks, then click it on that tab.",
        false
      );
      showBookmarkletLink(bm);
    }
  }

  function showBookmarkletLink(href) {
    var link = document.getElementById("bm-link");
    if (!link) {
      link = document.createElement("a");
      link.id = "bm-link";
      link.textContent = "Katina PDF (drag to bookmarks)";
      link.style.display = "block";
      link.style.marginTop = "0.75rem";
      status.after(link);
    }
    link.href = href;
  }

  function setMsg(text, isError) {
    status.textContent = text;
    status.className = isError ? "error" : "";
  }
})();
