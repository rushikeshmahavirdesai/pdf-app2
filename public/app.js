(function () {
  var ARTICLE =
    /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

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
    if (!ARTICLE.test(url))
      return setMsg("URL must be a Katina article link.", true);

    btnPdf.disabled = true;
    btnCss.disabled = true;
    setMsg("Generating PDF…");

    try {
      var res = await fetch(
        "/.netlify/functions/generate-pdf?url=" + encodeURIComponent(url)
      );
      if (!res.ok) {
        var err = await res.json().catch(function () {
          return {};
        });
        throw new Error(err.error || "PDF failed");
      }
      var blob = await res.blob();
      var slug = url.split("/").pop() || "article";
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = slug + ".pdf";
      link.click();
      URL.revokeObjectURL(link.href);
      setMsg("PDF downloaded.");
    } catch (e) {
      setMsg(e.message, true);
    } finally {
      btnPdf.disabled = false;
      btnCss.disabled = false;
    }
  };

  function setMsg(text, isError) {
    status.textContent = text;
    status.className = isError ? "error" : "";
  }
})();
