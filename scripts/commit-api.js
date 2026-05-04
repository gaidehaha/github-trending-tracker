const https = require("https");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const BRANCH = "main";

function api(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const req = https.request({
      hostname: "api.github.com", path: p, method,
      headers: { "User-Agent": "bot", "Authorization": "token " + TOKEN, "Content-Type": "application/json" }
    }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ s: res.statusCode, d })); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function commitFiles(dirs) {
  const ref = JSON.parse((await api("GET", "/repos/" + REPO + "/git/refs/heads/" + BRANCH)).d);
  const commitSha = ref.object.sha;
  const commit = JSON.parse((await api("GET", "/repos/" + REPO + "/git/commits/" + commitSha)).d);
  const treeSha = commit.tree.sha;

  const treeItems = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir, { recursive: true });
    for (const f of files) {
      const fp = path.join(dir, f);
      if (!fs.statSync(fp).isFile()) continue;
      const content = fs.readFileSync(fp);
      const blob = JSON.parse((await api("POST", "/repos/" + REPO + "/git/blobs", {
        content: content.toString("base64"), encoding: "base64"
      })).d);
      treeItems.push({ path: fp.replace(/\\/g, "/"), mode: "100644", type: "blob", sha: blob.sha });
    }
  }

  if (!treeItems.length) { console.log("No files to commit"); return; }

  const newTree = JSON.parse((await api("POST", "/repos/" + REPO + "/git/trees", {
    base_tree: treeSha, tree: treeItems
  })).d);
  const newCommit = JSON.parse((await api("POST", "/repos/" + REPO + "/git/commits", {
    message: "trending: " + new Date().toISOString().slice(0, 10),
    tree: newTree.sha, parents: [commitSha]
  })).d);
  await api("PATCH", "/repos/" + REPO + "/git/refs/heads/" + BRANCH, { sha: newCommit.sha });
  console.log("Committed " + treeItems.length + " files");
}

commitFiles(["data", "reports"]).catch(e => { console.error(e.message); process.exit(1); });
