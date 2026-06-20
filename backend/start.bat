@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo   Alipro Backend Launcher
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Check Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js was not found. Please install Node.js first.
    pause
    exit /b 1
)
node --version
echo.

echo [2/3] Check dependencies...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo npm install failed.
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)
echo.

echo [3/3] Check environment file...
if not exist ".env" (
    echo .env was not found. Copying from .env.example...
    copy .env.example .env >nul
    echo Please edit backend\.env and fill in your DeepSeek API key.
    pause
    start notepad .env
    echo Save the file, then press any key to continue...
    pause >nul
)
echo Environment file is ready.
echo.

echo Starting backend service...
start "alipro-backend" cmd /k "cd /d %~dp0 && npm start"

timeout /t 3 /nobreak >nul

echo Frontend dev server is now managed in frontend-react.
echo Local development entry with hot reload: http://127.0.0.1:5173/
echo Backend hosted entry without hot reload: http://localhost:3000/
start http://127.0.0.1:5173/

exit
