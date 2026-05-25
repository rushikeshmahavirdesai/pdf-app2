(function () {
  const ARTICLE_URL_RE =
    /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

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

  async function downloadPdf() {
    const url = getUrl();
    if (!validateUrl(url)) return;

    btnPdf.disabled = true;
    btnCss.disabled = true;
    setStatus("Generating PDF with Playwright… (may take up to a minute)");

    try {
      const res = await fetch(
        `/.netlify/functions/generate-pdf?url=${encodeURIComponent(url)}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `PDF failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const slug = url.split("/").filter(Boolean).pop() || "katina-article";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = slug + ".pdf";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("PDF downloaded.");
    } catch (err) {
      setStatus(err.message || "PDF generation failed.", true);
    } finally {
      btnPdf.disabled = false;
      btnCss.disabled = false;
    }
  }
})();
