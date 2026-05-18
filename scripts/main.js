const { spawn } = require("child_process");
const path = require("path");

async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n[执行] node ${scriptPath}...`);
    const child = spawn("node", [scriptPath], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`脚本 ${scriptPath} 退出，错误码: ${code}`));
    });
  });
}

(async () => {
  try {
    console.log("==========================================");
    console.log("   GitHub Trending 一键更新工具");
    console.log("==========================================");

    await runScript(path.join("scripts", "fetch-trending.js"));
    await runScript(path.join("scripts", "generate-report.js"));
    await runScript(path.join("scripts", "generate-html.js"));

    console.log("\n==========================================");
    console.log(" [成功] 报告已更新！");
    console.log(" 存放位置：reports 文件夹 (含 Markdown 和 HTML 可视化版)");
    console.log("==========================================");
  } catch (err) {
    console.error(`\n[失败] ${err.message}`);
    process.exit(1);
  }
})();
