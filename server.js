/**
 * Local dev server on port 8888 — serves public/ and the fetch-article function.
 * Use: npm run dev
 * (Netlify production uses netlify/functions automatically.)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 8888;
const PUBLIC = path.join(__dirname, "public");
const { handler } = require("./netlify/functions/fetch-article");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/.netlify/functions/fetch-article") {
    return handleFunction(req, res, url);
  }

  return serveStatic(url.pathname, res);
});

async function handleFunction(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  const event = {
    httpMethod: req.method,
    queryStringParameters: Object.fromEntries(url.searchParams),
  };

  try {
    const result = await handler(event);
    const headers = { ...corsHeaders(), ...result.headers };
    res.writeHead(result.statusCode, headers);
    res.end(result.body);
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
  console.log(`Function: http://localhost:${PORT}/.netlify/functions/fetch-article`);
});
