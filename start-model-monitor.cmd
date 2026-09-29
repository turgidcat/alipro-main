@echo off
cd /d "%~dp0"
node apps\model-monitor\server.cjs --open
if errorlevel 1 pause
