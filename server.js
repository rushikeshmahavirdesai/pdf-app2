const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const pdfFn = require("./netlify/functions/generate-pdf");

const PORT = process.env.PORT || 8888;
const PUBLIC = path.join(__dirname, "public");

http
  .createServer(async function (req, res) {
    var url = new URL(req.url, "http://localhost:" + PORT);

    if (url.pathname === "/.netlify/functions/generate-pdf") {
      var result = await pdfFn.handler({
        httpMethod: req.method,
        queryStringParameters: Object.fromEntries(url.searchParams),
      });
      res.writeHead(result.statusCode, result.headers);
      return res.end(
        result.isBase64Encoded
          ? Buffer.from(result.body, "base64")
          : result.body
      );
    }

    var file = path.join(
      PUBLIC,
      url.pathname === "/" ? "index.html" : url.pathname
    );
    if (!file.startsWith(PUBLIC)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, function (err, data) {
      if (err) {
        res.writeHead(404);
        return res.end();
      }
      var ext = path.extname(file);
      var types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
      };
      res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
      res.end(data);
    });
  })
  .listen(PORT, function () {
    console.log("http://localhost:" + PORT);
  });
