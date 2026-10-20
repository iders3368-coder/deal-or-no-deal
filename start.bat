@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo 未检测到 Node.js，请先安装 Node.js 18 或更高版本。
    pause
    exit /b 1
)

echo 正在构建浏览器预览...
node tools\build-preview.js
if errorlevel 1 (
    echo 预览构建失败。
    pause
    exit /b 1
)

echo 正在启动本地预览服务器...
start "deal-or-no-deal preview" /D "%~dp0" cmd /k "node server.js"
timeout /t 1 >nul
start "" http://127.0.0.1:3000/preview/
exit /b 0
