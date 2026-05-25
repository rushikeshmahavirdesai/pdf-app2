const { generatePdf, ARTICLE_URL_RE } = require("../lib/generate-pdf");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const url = event.queryStringParameters?.url;
  if (!url || !ARTICLE_URL_RE.test(url)) {
    return json(400, {
      error:
        "Invalid URL. Use a Katina article link: https://katinamagazine.org/content/article/...",
    });
  }

  try {
    const pdf = await generatePdf(url);
    const slug = url.split("/").filter(Boolean).pop() || "katina-article";

    return {
      statusCode: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
      },
      body: pdf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return json(502, {
      error: err.message || "PDF generation failed.",
    });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...cors },
    body: JSON.stringify(body),
  };
}
