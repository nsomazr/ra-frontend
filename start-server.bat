@echo off
cd /d "%~dp0"
if "%P10354_API_KEY%"=="" (
  echo Starting P10354 without API key authentication.
  echo For deployment, set P10354_API_KEY before starting.
) else (
  echo Starting P10354 with API key authentication enabled.
)
node server\server.js
pause
