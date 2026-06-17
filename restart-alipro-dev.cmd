@echo off
setlocal
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\restart-alipro-dev.ps1"
if errorlevel 1 (
  echo.
  echo Script failed. Press any key to close.
  pause >nul
)
endlocal
