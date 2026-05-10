@echo off
title Agentic Forge — Dev Mode
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║      Agentic Forge — Development Mode        ║
echo  ║  Backend:  http://localhost:3456             ║
echo  ║  Frontend: http://localhost:5173             ║
echo  ╚══════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Start Flask in background
start "Agentic Forge Backend" cmd /k "pip install -r requirements.txt --quiet && python workflow_builder.py"

:: Start Vite dev server
cd webui
call npm run dev
