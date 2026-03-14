@echo off
echo ================================================
echo   BiliNote - One-Click Setup Script
echo ================================================
echo.

:: --- Check Python ---
echo [0/4] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Please install Python 3.10+
    echo         Download: https://www.python.org/downloads/
    echo         Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)
python --version
echo.

:: --- Check Node.js ---
echo [0/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js 18+
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo.

:: --- Backend Setup ---
echo [1/4] Creating Python virtual environment...
cd /d "%~dp0backend"
if not exist ".venv" (
    python -m venv .venv
    echo       Virtual environment created.
) else (
    echo       Virtual environment already exists, skipping.
)
echo.

echo [2/4] Installing backend dependencies...
"%~dp0backend\.venv\Scripts\python.exe" -m pip install -r "%~dp0backend\requirements.txt"
if %errorlevel% neq 0 (
    echo [ERROR] Backend installation failed! Check network connection.
    pause
    exit /b 1
)
echo.

:: --- Configure .env ---
echo [3/4] Checking backend configuration...
if not exist ".env" (
    copy .env.example .env >nul
    echo       Created .env from .env.example (default config).
) else (
    echo       .env already exists, skipping.
)
echo.

:: --- Frontend Setup ---
echo [4/4] Installing frontend dependencies...
cd /d "%~dp0BillNote_frontend"
if not exist "node_modules\vite\bin\vite.js" (
    echo       Using taobao mirror for faster download...
    call npm install --registry=https://registry.npmmirror.com
    if %errorlevel% neq 0 (
        echo [ERROR] Frontend installation failed! Network error or interrupted.
        pause
        exit /b 1
    )
) else (
    echo       Frontend vite dependencies already installed, skipping.
)
echo.

:: --- Done ---
echo ================================================
echo   Installation Complete!
echo   You can now run start.bat to launch BiliNote.
echo ================================================
pause
