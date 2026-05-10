@echo off
title Build UI
cd /d "%~dp0\webui"
echo Building React app...
call npm run build
echo.
echo Done! Flask will serve the built UI at http://localhost:3456
pause
