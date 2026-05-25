/**
 * Runs on katinamagazine.org (via bookmarklet). Loads print CSS and downloads PDF.
 */
(function () {
  var root =
    document.querySelector("article") ||
    document.querySelector("[class*='article-body']") ||
    document.querySelector("[class*='article-content']") ||
    document.querySelector("main") ||
    document.body;

  var cssUrl = window.__KATINA_PRINT_CSS__;
  if (cssUrl) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    document.head.appendChild(link);
  }

  var remove =
    "script,style,noscript,nav,header.site-header,footer.site-footer,aside,iframe,button,#disqus_thread,.disqus,[id*='disqus'],[class*='disqus'],#hypothesis-sidebar,[class*='hypothesis'],[class*='share'],[class*='tag'],[class*='ymal'],[class*='newsletter'],[class*='comment'],[class*='promo'],[class*='advert'],[class*='layout-menu'],[role='navigation']";
  remove.split(",").forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      if (!el.closest(".copyright") && !el.classList.contains("copyright")) {
        el.remove();
      }
    });
  });

  var slug = location.pathname.split("/").filter(Boolean).pop() || "katina-article";
  var filename = slug + ".pdf";

  function runPdf() {
    html2pdf()
      .set({
        margin: [15, 15, 15, 15],
        filename: filename,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, width: 800 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(root)
      .save();
  }

  if (window.html2pdf) {
    runPdf();
    return;
  }

  var s = document.createElement("script");
  s.src =
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
  s.onload = runPdf;
  document.head.appendChild(s);
})();
