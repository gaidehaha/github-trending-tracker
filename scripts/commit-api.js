const https = require("https");
const fs = require("fs");
const path = require("path");

const T = process.env.GITHUB_TOKEN;
const R = process.env.GITHUB_REPOSITORY;

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : "";
    const req = https.request({
      hostname: "api.github.com",
      path: path,
      method: method,
      headers: {
        "User-Agent": "bot",
        "Authorization": "token " + T,
        "Content-Type": "application/json"
      },
      rejectUnauthorized: false
    }, res => {
      let responseBody = "";
      res.on("data", chunk => responseBody += chunk);
      res.on("end", () => {
        console.log(method, path, res.statusCode);
        resolve({ s: res.statusCode, d: responseBody });
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });

    if (data) req.write(data);
    req.end();
  });
}

async function uploadFile(relPath) {
  if (!fs.existsSync(relPath)) {
    console.log("no file:", relPath);
    return;
  }
  const content = fs.readFileSync(relPath).toString("base64");
  const ex = await api("GET", "/repos/" + R + "/contents/" + relPath);
  const body = {
    message: "update " + relPath,
    content: content,
    branch: "main"
  };
  if (ex.s === 200) {
    body.sha = JSON.parse(ex.d).sha;
  }
  const r = await api("PUT", "/repos/" + R + "/contents/" + relPath, body);
  console.log("  " + relPath + ":" + r.s);
}

async function upload(dir) {
  if (!fs.existsSync(dir)) {
    console.log("no dir:", dir);
    return;
  }
  const files = [];
  function walk(d, base) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      const r = base ? base + "/" + e.name : e.name;
      if (e.isDirectory()) {
        walk(f, r);
      } else {
        files.push({ full: f, rel: dir + "/" + r });
      }
    }
  }
  walk(dir, "");
  console.log(dir + ":", files.length, "files");
  for (const f of files) {
    const c = fs.readFileSync(f.full).toString("base64");
    const ex = await api("GET", "/repos/" + R + "/contents/" + f.rel);
    const b = { message: "update " + f.rel, content: c, branch: "main" };
    if (ex.s === 200) {
      b.sha = JSON.parse(ex.d).sha;
    }
    const r = await api("PUT", "/repos/" + R + "/contents/" + f.rel, b);
    console.log("  " + f.rel + ":" + r.s);
  }
}

(async () => {
  console.log("REPO:", R, "TOKEN:", T ? "ok" : "MISSING");
  await upload("data");
  await upload("reports");
  await uploadFile("index.html");
  console.log("done");
})().catch(e => {
  console.error(e);
  process.exit(1);
});