@echo off
title Agentic Forge — Backend
echo.
echo  ╔══════════════════════════════════╗
echo  ║      Agentic Forge Backend       ║
echo  ║      http://localhost:3456       ║
echo  ╚══════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Install Python deps if needed
pip install -r requirements.txt --quiet

:: Start Flask
python workflow_builder.py
pause
