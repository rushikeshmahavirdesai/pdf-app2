const { execSync } = require("child_process");
const path = require("path");

const URLS = [
  "https://katinamagazine.org/content/article/future-of-work/2026/university-of-arkansas-twenty-first-century-library",
  "https://katinamagazine.org/content/article/open-knowledge/2026/what-are-open-infrastructure-evaluation-frameworks-for",
  "https://katinamagazine.org/content/article/future-of-work/2026/building-a-shared-cultural-behaviors-program",
  "https://katinamagazine.org/content/article/resource-reviews/2026/consortial-coordination-for-advancing-accessibility",
  "https://katinamagazine.org/content/article/open-knowledge/2026/the-commodification-of-sensitive-open-data",
];

const printJs = path.join(__dirname, "print.js");

for (const url of URLS) {
  console.log("\n---\n");
  execSync(`node "${printJs}" "${url}"`, { stdio: "inherit", cwd: __dirname });
}

console.log("\nDone. PDFs are in this folder.\n");
