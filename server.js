/**
 * Local dev server on port 8888 — serves public/ and Netlify functions.
 * PDF uses Playwright (run npm run setup once).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 8888;
const PUBLIC = path.join(__dirname, "public");

const functions = {
  "fetch-article": require("./netlify/functions/fetch-article"),
  "generate-pdf": require("./netlify/functions/generate-pdf"),
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const fnMatch = url.pathname.match(/^\/\.netlify\/functions\/([^/]+)$/);

  if (fnMatch && functions[fnMatch[1]]) {
    return handleFunction(functions[fnMatch[1]], req, res, url);
  }

  return serveStatic(url.pathname, res);
});

async function handleFunction(handler, req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  const event = {
    httpMethod: req.method,
    queryStringParameters: Object.fromEntries(url.searchParams),
  };

  try {
    const result = await handler.handler(event);
    const headers = { ...corsHeaders(), ...result.headers };
    res.writeHead(result.statusCode, headers);
    const body = result.isBase64Encoded
      ? Buffer.from(result.body, "base64")
      : result.body;
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json", ...corsHeaders() });
    res.end(JSON.stringify({ error: err.message }));
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

function serveStatic(pathname, res) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
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
    const ext = path.extname(full);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`Katina Print dev server: http://localhost:${PORT}`);
  console.log(`PDF: http://localhost:${PORT}/.netlify/functions/generate-pdf`);
  console.log("First time: npm run setup");
});
