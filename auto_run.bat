@echo off
:: 切换到项目所在目录
d:
cd d:\AI_Workspace\99\github-trending-tracker

:: 记录运行日志
echo ========================================== >> auto_run.log
echo 运行时间: %date% %time% >> auto_run.log
echo ========================================== >> auto_run.log

:: 1. 拉取远程可能存在的其他修改，防止冲突
echo [Git Pull]... >> auto_run.log
git pull origin main >> auto_run.log 2>&1

:: 2. 执行数据抓取和可视化页面生成
echo [Running main.js]... >> auto_run.log
node scripts/main.js >> auto_run.log 2>&1
if %errorlevel% neq 0 (
    echo [Error] node main.js 失败，停止执行。 >> auto_run.log
    exit /b %errorlevel%
)

:: 3. 将本地最新生成的 index.html 和数据推送到 GitHub
echo [Git Push]... >> auto_run.log
git add . >> auto_run.log 2>&1
git commit -m "feat: local auto update trending report" >> auto_run.log 2>&1
git push origin main >> auto_run.log 2>&1

echo [Done] 自动更新完毕并推送成功！ >> auto_run.log
exit /b 0
