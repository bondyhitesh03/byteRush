@echo off
rem Windows: double-click this file to start ByteRush.
title ByteRush
cd /d "%~dp0"
echo.
echo   ByteRush
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ByteRush needs Node.js ^(a free helper program^) to run.
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo Installing it now...
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    echo.
    echo Done. Please close this window and double-click "Start ByteRush" again.
  ) else (
    echo Opening the download page. Install the LTS version, then double-click this file again.
    start "" "https://nodejs.org/en/download"
  )
  pause
  exit /b 1
)
node launcher\launch.mjs
if errorlevel 1 pause
