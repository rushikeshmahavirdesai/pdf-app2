const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { URL } = require("url");
const {
  ARTICLE_URL_RE,
  printArticle,
  slugFromUrl,
} = require("./lib/print-article");

const PORT = Number(process.env.PORT) || 3456;
const PUBLIC = path.join(__dirname, "public");
const ROOT_CSS = path.join(__dirname, "katina-print.css");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

async function handlePdf(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { error: e.message });
    return;
  }

  const url = (body.url || "").trim();
  if (!ARTICLE_URL_RE.test(url)) {
    sendJson(res, 400, {
      error: "URL must be https://katinamagazine.org/content/article/...",
    });
    return;
  }

  const slug = slugFromUrl(url);
  const tmpPath = path.join(os.tmpdir(), `katina-${slug}-${Date.now()}.pdf`);

  try {
    await printArticle(url, tmpPath, { log: () => {} });
    const pdf = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}.pdf"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    sendJson(res, 500, { error: err.message || "PDF generation failed" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  if (req.method === "POST" && pathname === "/api/pdf") {
    await handlePdf(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/katina-print.css") {
    serveFile(res, ROOT_CSS, "text/css; charset=utf-8");
    return;
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    serveFile(res, path.join(PUBLIC, "index.html"), MIME[".html"]);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/")) {
    const rel = pathname.replace(/^\//, "");
    const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(PUBLIC, safe);
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const ext = path.extname(filePath);
    if (MIME[ext] && fs.existsSync(filePath)) {
      serveFile(res, filePath, MIME[ext]);
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Katina Print: http://localhost:${PORT}`);
});
