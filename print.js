const path = require("path");
const readline = require("readline");
const {
  ARTICLE_URL_RE,
  printArticle,
  slugFromUrl,
} = require("./lib/print-article");

async function askUrl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question("Paste Katina article URL: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  let url = process.argv[2];
  if (!url) url = await askUrl();

  if (!ARTICLE_URL_RE.test(url)) {
    console.error("URL must be: https://katinamagazine.org/content/article/...");
    process.exit(1);
  }

  const outPath = path.join(process.cwd(), slugFromUrl(url) + ".pdf");

  try {
    const result = await printArticle(url, outPath);
    console.log(
      "Saved:",
      result.path,
      `(${(result.size / 1024).toFixed(0)} KB)`
    );
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
