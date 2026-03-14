@echo off
chcp 65001 >nul
echo ================================
echo   EverythingNote - One Click Start
echo ================================
echo.

:: Start backend
echo [1/2] Starting backend (port 8000)...
if not exist "%~dp0backend\.venv\Scripts\python.exe" (
    echo [错误] 后端依赖尚未安装！请先运行 install.bat
    pause
    exit /b 1
)
if not exist "%~dp0BillNote_frontend\node_modules\vite\bin\vite.js" (
    echo [错误] 前端依赖(如 vite)丢失或未安装完全！请重新运行 install.bat 以修复
    pause
    exit /b 1
)
start "EverythingNote-Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start frontend
echo [2/2] Starting frontend (port 3016)...
start "EverythingNote-Frontend" cmd /k "cd /d %~dp0BillNote_frontend && npx vite --port 3016"

echo.
echo Done! Open http://localhost:3016 in your browser.
echo.
pause
