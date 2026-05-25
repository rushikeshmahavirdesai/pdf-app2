const ARTICLE_URL_RE =
  /^https:\/\/(www\.)?katinamagazine\.org\/content\/article\/.+/i;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" }, cors);
  }

  const url = event.queryStringParameters?.url;
  if (!url || !ARTICLE_URL_RE.test(url)) {
    return json(400, {
      error:
        "Invalid URL. Use a Katina article link: https://katinamagazine.org/content/article/...",
    }, cors);
  }

  try {
    const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
    if (!res.ok) {
      return json(502, {
        error: `Could not fetch article (HTTP ${res.status}). Try again later or use Download CSS on the live article page.`,
      }, cors);
    }

    const html = await res.text();
    if (
      html.includes("Just a moment") &&
      html.includes("challenges.cloudflare.com")
    ) {
      return json(502, {
        error:
          "Could not fetch article (site protection). Try again later or use Download CSS on the live article page.",
      }, cors);
    }

    return json(200, { html }, cors);
  } catch (err) {
    return json(502, {
      error:
        "Could not fetch article. Try again later or use Download CSS on the live article page.",
      detail: err.message,
    }, cors);
  }
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}
