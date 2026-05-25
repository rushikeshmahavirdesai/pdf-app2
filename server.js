const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 8888;
const PUBLIC = path.join(__dirname, "public");
const generatePdf = require("./netlify/functions/generate-pdf");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/.netlify/functions/generate-pdf") {
    return handlePdf(req, res, url);
  }

  return serveStatic(url.pathname, res);
});

async function handlePdf(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors());
    return res.end();
  }

  const event = {
    httpMethod: req.method,
    queryStringParameters: Object.fromEntries(url.searchParams),
  };

  try {
    const result = await generatePdf.handler(event);
    const headers = { ...cors(), ...result.headers };
    res.writeHead(result.statusCode, headers);
    res.end(
      result.isBase64Encoded
        ? Buffer.from(result.body, "base64")
        : result.body
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json", ...cors() });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function cors() {
  return { "Access-Control-Allow-Origin": "*" };
}

function serveStatic(pathname, res) {
  const filePath = path.normalize(
    pathname === "/" ? "/index.html" : pathname
  ).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(PUBLIC, filePath);

  if (!full.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(full)] || "application/octet-stream",
    });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  console.log("Run once: npm run setup");
});
