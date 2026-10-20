@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Deal or No Deal - Legacy H5

where node >nul 2>nul
if errorlevel 1 (
    echo 未检测到 Node.js，无法启动旧版 H5 预览。
    pause
    exit /b 1
)

start "" http://127.0.0.1:3002/
node server.js
