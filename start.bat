@echo off
title Deal or No Deal - Local Test
echo.
echo ========================================
echo   Deal or No Deal - Local Server
echo ========================================
echo.
echo Starting server...
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Node.js detected
    echo.
    start http://localhost:3000
    node server.js
    goto :end
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Python detected
    echo.
    start http://localhost:3000
    python -m http.server 3000
    goto :end
)

echo [ERROR] Node.js or Python not found
echo Please install Node.js or Python
echo.
pause

:end
