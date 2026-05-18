const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const REPORT_DIR = path.join(__dirname, "..", "reports");

const KEYWORDS = {
  HIGH: ["video", "audio", "edit", "subtitle", "creator", "automation", "efficiency", "workflow", "media", "youtube", "tiktok", "short-video", "自媒体", "视频", "剪辑", "效率", "自动化", "录屏", "直播"],
  MID: ["ai", "llm", "gpt", "agent", "stable-diffusion", "deepseek", "openai", "model", "llama", "artificial-intelligence", "人工智能", "大模型", "机器人"]
};

function getScore(repo) {
  const nameDesc = (repo.name + " " + (repo.descriptionZh || repo.description || "")).toLowerCase();
  if (KEYWORDS.HIGH.some(k => nameDesc.includes(k.toLowerCase()))) return 100;
  if (KEYWORDS.MID.some(k => nameDesc.includes(k.toLowerCase()))) return 50;
  return 0;
}

function generateHTML(date, daily, weekly, monthly) {
  const sections = [
    { label: "🔥 今日趋势", data: daily },
    { label: "📅 本周趋势", data: weekly },
    { label: "🏆 本月趋势", data: monthly }
  ];

  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub 趋势内参 - ${date}</title>
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --primary: #38bdf8;
            --accent: #818cf8;
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --warning: #eab308;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: var(--bg);
            background-image: radial-gradient(circle at 0% 0%, #1e1b4b 0%, transparent 50%),
                              radial-gradient(circle at 100% 100%, #1e3a8a 0%, transparent 50%);
            color: var(--text);
            line-height: 1.6;
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container { max-width: 1000px; margin: 0 auto; }
        header { text-align: center; margin-bottom: 40px; }
        h1 { font-size: 3rem; font-weight: 700; margin-bottom: 10px; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { color: var(--text-muted); font-size: 1.1rem; }
        
        /* 控制器样式 */
        .controls {
            position: sticky;
            top: 20px;
            z-index: 1000;
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 40px;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(20px);
            padding: 12px;
            border-radius: 99px;
            border: 1px solid rgba(255,255,255,0.1);
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
        }
        .btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 8px 20px;
            border-radius: 99px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 600;
            transition: all 0.3s;
        }
        .btn.active {
            background: var(--primary);
            color: var(--bg);
        }
        .btn:hover:not(.active) {
            background: rgba(255,255,255,0.05);
            color: var(--text);
        }

        .section-title { font-size: 1.8rem; margin: 40px 0 20px; display: flex; align-items: center; gap: 10px; }
        .section-title::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1); }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        
        .card {
            background: var(--card-bg);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 24px;
            transition: all 0.3s ease;
            position: relative;
            display: flex;
            flex-direction: column;
        }
        .card:hover { transform: translateY(-5px); border-color: var(--primary); box-shadow: 0 10px 30px -10px rgba(56, 189, 248, 0.3); }
        
        /* 隐藏逻辑 */
        body.hide-seen .card:not(.has-new-badge) { display: none; }
        .card.is-dismissed .badge-new { display: none; }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 99px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .badge-core { background: rgba(56, 189, 248, 0.2); color: var(--primary); border: 1px solid var(--primary); }
        .badge-ai { background: rgba(129, 140, 248, 0.2); color: var(--accent); border: 1px solid var(--accent); }
        .badge-normal { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); }
        .badge-new { 
            background: rgba(234, 179, 8, 0.2); 
            color: var(--warning); 
            border: 1px solid var(--warning);
            cursor: pointer;
            transition: all 0.2s;
        }
        .badge-new:hover { background: var(--warning); color: var(--bg); }

        .repo-name { font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; color: var(--text); text-decoration: none; display: block; }
        .repo-name:hover { color: var(--primary); }
        
        .desc { font-size: 0.95rem; color: var(--text-muted); flex-grow: 1; margin-bottom: 20px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        
        .footer-meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); margin-top: auto; padding-top: 15px;}
        .stars { display: flex; align-items: center; gap: 4px; color: #fbbf24; }
        
        .tag { background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>GitHub 趋势内参</h1>
            <p class="subtitle">专注于自媒体创作与 AI 生产力 · ${date}</p>
        </header>

        <div class="controls">
            <button class="btn active" onclick="setView('all')" id="btn-all">显示全部</button>
            <button class="btn" onclick="setView('new')" id="btn-new">只看新发现</button>
        </div>

        ${(() => {
          const localSeen = new Set();
          return sections.map(sec => {
            if (!sec.data || !sec.data.repos) return '';
            const sorted = [...sec.data.repos].sort((a, b) => (getScore(b) - getScore(a)) || (a.rank - b.rank));
            
            const filtered = sorted.filter(r => {
              if (localSeen.has(r.name)) return false;
              localSeen.add(r.name);
              return true;
            });

            if (filtered.length === 0) return '';

            return `
              <div class="section-group">
                <div class="section-title">${sec.label}</div>
                <div class="grid">
                    ${filtered.slice(0, 15).map(r => {
                      const score = getScore(r);
                      const badgeClass = score >= 100 ? 'badge-core' : score >= 50 ? 'badge-ai' : 'badge-normal';
                      const badgeText = score >= 100 ? '⭐ 核心推荐' : score >= 50 ? '🤖 AI 工具' : '🔹 热门项目';
                      const cardClass = r.isNewDiscovery ? 'has-new-badge' : '';
                      return `
                        <div class="card ${cardClass}" data-repo="${r.name}">
                            <div style="display: flex; gap: 8px;">
                                <span class="badge ${badgeClass}">${badgeText}</span>
                                ${r.isNewDiscovery ? `<span class="badge badge-new" onclick="dismissNew(this, '${r.name}', event)" title="点击标记为已看">✨ 全新发现</span>` : ''}
                            </div>
                            <a href="https://github.com/${r.name}" class="repo-name" target="_blank">${r.name}</a>
                            <p class="desc">${r.descriptionZh || r.description || '暂无简介'}</p>
                            <div class="footer-meta">
                                <span class="stars">★ ${r.totalStars || r.starsGained}</span>
                                <span class="tag">${r.language || 'Code'}</span>
                            </div>
                        </div>
                      `;
                    }).join('')}
                </div>
              </div>
            `;
          }).join('');
        })()}
        
        <footer style="margin-top: 80px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            生成于 ${new Date().toLocaleString('zh-CN')} · 自动化驱动
        </footer>
    </div>

    <script>
        const dismissedKey = 'gh-trending-dismissed';
        let dismissed = [];
        try {
            dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
        } catch (e) {
            console.warn("LocalStorage not available:", e);
        }

        function setView(mode) {
            document.body.classList.toggle('hide-seen', mode === 'new');
            document.getElementById('btn-all').classList.toggle('active', mode === 'all');
            document.getElementById('btn-new').classList.toggle('active', mode === 'new');
            try { localStorage.setItem('gh-view-mode', mode); } catch (e) {}
        }

        function dismissNew(btnElem, repo, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const card = btnElem.closest('.card');
            if (card) {
                // 强制隐藏标签
                btnElem.style.display = 'none';
                card.classList.add('is-dismissed');
                card.classList.remove('has-new-badge');
                
                if (!dismissed.includes(repo)) {
                    dismissed.push(repo);
                    try { localStorage.setItem(dismissedKey, JSON.stringify(dismissed)); } catch (e) {}
                }
                
                if (document.body.classList.contains('hide-seen')) {
                    card.style.display = 'none';
                }
            }
        }

        window.onload = () => {
            // 恢复记忆
            dismissed.forEach(repo => {
                const cards = document.querySelectorAll('.card');
                cards.forEach(card => {
                    if (card.getAttribute('data-repo') === repo) {
                        card.classList.add('is-dismissed');
                        card.classList.remove('has-new-badge');
                        const badge = card.querySelector('.badge-new');
                        if (badge) badge.style.display = 'none';
                    }
                });
            });

            let savedMode = 'new';
            try { savedMode = localStorage.getItem('gh-view-mode') || 'new'; } catch (e) {}
            setView(savedMode);
        };
    </script>
</body>
</html>
  `;
  return html;
}

function loadData(tf, date) {
  const p = path.join(DATA_DIR, `${tf}-${date}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

const today = process.argv[2] || new Date().toISOString().slice(0, 10);
const daily = loadData('daily', today);
const weekly = loadData('weekly', today);
const monthly = loadData('monthly', today);

if (daily || weekly || monthly) {
  const html = generateHTML(today, daily, weekly, monthly);
  const outPath = path.join(REPORT_DIR, `report-${today}.html`);
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`\n可视化报告已保存：${outPath}`);
  
  // 额外在根目录生成 index.html，作为永远指向最新报告的“免改日期”首页入口
  const indexPath = path.join(__dirname, "..", "index.html");
  fs.writeFileSync(indexPath, html);
  console.log(`首页入口 index.html 已更新：${indexPath}`);
} else {
  console.log("没有找到今日数据，无法生成可视化报告。");
}
