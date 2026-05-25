(function () {
  const input = document.getElementById("url");
  const btnPdf = document.getElementById("btn-pdf");
  const status = document.getElementById("status");

  const EXAMPLE =
    "https://katinamagazine.org/content/article/open-knowledge/2026/the-commodification-of-sensitive-open-data";
  if (!input.value) input.value = EXAMPLE;

  function setStatus(msg, type) {
    status.textContent = msg;
    status.className = "status" + (type ? " " + type : "");
  }

  btnPdf.addEventListener("click", async function () {
    const url = input.value.trim();
    if (!url) {
      setStatus("Paste a Katina article URL.", "error");
      return;
    }

    btnPdf.disabled = true;
    setStatus("Opening article… this may take 1–2 minutes.");

    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        let msg = "PDF failed.";
        try {
          const err = await res.json();
          if (err.error) msg = err.error;
        } catch (_) {}
        setStatus(msg, "error");
        return;
      }

      const blob = await res.blob();
      const slug =
        url.split("/").filter(Boolean).pop() || "katina-article";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = slug + ".pdf";
      a.click();
      URL.revokeObjectURL(a.href);

      setStatus("Downloaded " + slug + ".pdf", "ok");
    } catch (e) {
      setStatus(e.message || "Network error.", "error");
    } finally {
      btnPdf.disabled = false;
    }
  });
})();
