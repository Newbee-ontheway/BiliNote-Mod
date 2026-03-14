@echo off
chcp 65001 >nul
echo ================================================
echo   BiliNote - 一键安装脚本 (首次使用请运行此脚本)
echo ================================================
echo.

:: ─── 检查 Python ───
echo [0/4] 检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python！请先安装 Python 3.10+ 
    echo        下载地址: https://www.python.org/downloads/
    echo        安装时请勾选 "Add Python to PATH"
    pause
    exit /b 1
)
python --version
echo.

:: ─── 检查 Node.js ───
echo [0/4] 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js！请先安装 Node.js 18+
    echo        下载地址: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo.

:: ─── 后端安装 ───
echo [1/4] 创建 Python 虚拟环境...
cd /d "%~dp0backend"
if not exist ".venv" (
    python -m venv .venv
    echo       虚拟环境已创建
) else (
    echo       虚拟环境已存在，跳过
)
echo.

echo [2/4] 安装后端依赖 (首次约需 5-10 分钟，取决于网速)...
.venv\Scripts\pip.exe install -r requirements.txt
if %errorlevel% neq 0 (
    echo [错误] 后端依赖安装失败！请检查网络连接后重试
    pause
    exit /b 1
)
echo.

:: ─── 配置 .env ───
echo [3/4] 检查后端配置...
if not exist ".env" (
    copy .env.example .env >nul
    echo       已从 .env.example 创建 .env（默认配置）
    echo       如需自定义 API Key 等，请编辑 backend\.env
) else (
    echo       .env 已存在，跳过
)
echo.

:: ─── 前端安装 ───
echo [4/4] 安装前端依赖...
cd /d "%~dp0BillNote_frontend"
if not exist "node_modules\vite\bin\vite.js" (
    echo       正在通过淘宝镜像源安装...
    call npm install --registry=https://registry.npmmirror.com
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败！网络出错或被中断。
        pause
        exit /b 1
    )
) else (
    echo       node_modules 下 vite 已完成安装，跳过
)
echo.

:: ─── 完成 ───
echo ================================================
echo   安装完成！
echo   运行 start.bat 启动 BiliNote
echo ================================================
pause
