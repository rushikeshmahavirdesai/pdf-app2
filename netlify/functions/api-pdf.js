const {
  ARTICLE_URL_RE,
  printArticleBuffer,
  slugFromUrl,
} = require("../../lib/print-article");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const url = (body.url || "").trim();
  if (!ARTICLE_URL_RE.test(url)) {
    return json(400, {
      error:
        "URL must be https://katinamagazine.org/content/article/...",
    });
  }

  try {
    const { buffer } = await printArticleBuffer(url);
    const slug = slugFromUrl(url);

    return {
      statusCode: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return json(502, {
      error: err.message || "PDF generation failed",
    });
  }
};

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...cors },
    body: JSON.stringify(data),
  };
}
