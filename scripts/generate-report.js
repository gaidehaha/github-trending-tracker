#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const REPORT_DIR = process.env.REPORT_DIR || path.join(__dirname, "..", "reports");
const TIMEFRAMES = ["daily", "weekly", "monthly"];
const TF_LABELS = { daily: "今日趋势", weekly: "本周趋势", monthly: "本月趋势" };
const SEEN_FILE = path.join(DATA_DIR, "seen_repos.json");

// 关键词权重配置
const KEYWORDS = {
  // 第一优先级：自媒体、视频制作、效率提升
  HIGH: ["video", "audio", "edit", "subtitle", "creator", "automation", "efficiency", "workflow", "media", "youtube", "tiktok", "short-video", "自媒体", "视频", "剪辑", "效率", "自动化", "录屏", "直播"],
  // 第二优先级：AI 工具与模型
  MID: ["ai", "llm", "gpt", "agent", "stable-diffusion", "deepseek", "openai", "model", "llama", "artificial-intelligence", "人工智能", "大模型", "机器人"]
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isChinese(text) {
  return /[\u4e00-\u9fff]/.test(text) && !/[a-zA-Z]{4,}/.test(text);
}

function translateText(text, sl = "en", tl = "zh-CN") {
  if (!text || isChinese(text)) return Promise.resolve(text);
  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encoded}`;
  return new Promise((resolve) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json[0].map((s) => s[0]).join(""));
          } catch { resolve(text); }
        });
      })
      .on("error", () => resolve(text));
  });
}

async function translateBatch(texts) {
  const results = [];
  for (const text of texts) {
    results.push(await translateText(text));
    await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}

async function translateRepos(repos) {
  if (!repos.length) return repos;
  
  // 加载已见过的项目
  let seen = {};
  if (fs.existsSync(SEEN_FILE)) seen = JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"));
  
  const descriptions = repos.map((r) => r.description || "");
  console.log(`    Translating ${descriptions.filter((d) => d && !isChinese(d)).length} descriptions...`);
  const translated = await translateBatch(descriptions);
  
  const updatedRepos = repos.map((r, i) => {
    const descZh = translated[i] || r.description || "";
    const nameDesc = (r.name + " " + descZh + " " + (r.description || "")).toLowerCase();
    
    // 计算权重
    let score = 0;
    if (KEYWORDS.HIGH.some(k => nameDesc.includes(k.toLowerCase()))) score = 100;
    else if (KEYWORDS.MID.some(k => nameDesc.includes(k.toLowerCase()))) score = 50;

    // 检查是否是全新发现（增量逻辑）
    const isNewDiscovery = !seen[r.name];
    if (isNewDiscovery) seen[r.name] = { firstSeen: new Date().toISOString(), description: descZh };

    return { ...r, descriptionZh: descZh, score, isNewDiscovery };
  });

  // 保存更新后的已见列表
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
  return updatedRepos;
}

function loadData(timeframe, date) {
  const filepath = path.join(DATA_DIR, `${timeframe}-${date}.json`);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, "utf8"));
}

function findPreviousDate(timeframe, currentDate) {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith(`${timeframe}-`) && f.endsWith(".json"))
    .sort()
    .reverse();
  for (const file of files) {
    const dateMatch = file.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch && dateMatch[0] < currentDate) return dateMatch[0];
  }
  return null;
}

function compareData(current, previous) {
  if (!current || !current.repos) return { repos: [], newEntries: [], dropped: [], rising: [] };
  const currentRepos = current.repos;
  const prevMap = new Map();
  if (previous && previous.repos) previous.repos.forEach((r) => prevMap.set(r.name, r));

  const repos = currentRepos.map((repo) => {
    const prev = prevMap.get(repo.name);
    let change = "NEW";
    if (prev) {
      const diff = prev.rank - repo.rank;
      change = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "=";
    }
    return { ...repo, change };
  });

  const currentNames = new Set(currentRepos.map((r) => r.name));
  const newEntries = repos.filter((r) => r.change === "NEW");
  const dropped = previous && previous.repos ? previous.repos.filter((r) => !currentNames.has(r.name)) : [];
  const rising = repos
    .filter((r) => r.change !== "NEW" && r.change !== "=" && r.change.startsWith("+"))
    .sort((a, b) => parseInt(b.change) - parseInt(a.change))
    .slice(0, 5);

  return { repos, newEntries, dropped, rising };
}

function formatChangeLabel(change) {
  if (change === "NEW") return "🆕 新上榜";
  if (change === "=") return "➖ 不变";
  if (change.startsWith("+")) return `🔼 上升${change.slice(1)}`;
  if (change.startsWith("-")) return `🔽 下降${change.slice(1).replace("-", "")}`;
  return change;
}

function formatTable(repos) {
  if (!repos.length) return "_暂无数据_\n";
  
  // 按权重排序，权重相同按原排名
  const sorted = [...repos].sort((a, b) => (b.score - a.score) || (a.rank - b.rank));
  
  let table = "| 状态 | 优先级 | 仓库 | Stars | 简介 |\n| :--- | :--- | :--- | :--- | :--- |\n";
  for (const r of sorted.slice(0, 20)) {
    const desc = (r.descriptionZh || r.description || "").slice(0, 100).replace(/\|/g, "/");
    const icon = r.score >= 100 ? "⭐ **核心**" : r.score >= 50 ? "🤖 AI" : "🔹 常规";
    const status = r.isNewDiscovery ? "✨ **全新**" : "⏳ 已见";
    table += `| ${status} | ${icon} | [${r.name}](https://github.com/${r.name}) | ${r.totalStars || r.starsGained || ""} | ${desc} |\n`;
  }
  return table;
}

async function generateReport(date) {
  ensureDir(REPORT_DIR);
  let report = `# 🚀 GitHub 效率与 AI 追踪报告 - ${date}\n\n> 专注于自媒体创作、视频生产力与 AI 前沿工具。生成时间：${new Date().toLocaleString("zh-CN")}\n\n---\n\n`;

  const localSeen = new Set();
  for (const tf of TIMEFRAMES) {
    const current = loadData(tf, date);
    if (!current) continue;

    const prevDate = findPreviousDate(tf, date);
    const previous = prevDate ? loadData(tf, prevDate) : null;
    const comparison = compareData(current, previous);

    console.log(`  [${TF_LABELS[tf]}] ${comparison.repos.length} repos`);
    comparison.repos = await translateRepos(comparison.repos);
    
    // 将翻译后的数据存回 JSON
    fs.writeFileSync(path.join(DATA_DIR, `${tf}-${date}.json`), JSON.stringify({ ...current, repos: comparison.repos }, null, 2));

    // 跨维度去重
    const filteredRepos = comparison.repos.filter(r => {
      if (localSeen.has(r.name)) return false;
      localSeen.add(r.name);
      return true;
    });

    if (filteredRepos.length === 0) continue;

    report += `## 📌 ${TF_LABELS[tf]}\n\n`;
    report += formatTable(filteredRepos);
    report += "\n---\n\n";
  }

  const reportPath = path.join(REPORT_DIR, `report-${date}.md`);
  fs.writeFileSync(reportPath, report);
  console.log(`\n报告已保存：${reportPath}`);
  return reportPath;
}


const today = process.argv[2] || new Date().toISOString().slice(0, 10);
console.log(`Generating report for ${today}...`);
generateReport(today).catch(console.error);
