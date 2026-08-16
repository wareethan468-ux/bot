@echo off
setlocal
cd /d "%~dp0"

echo Starting Discord bot...
echo.
npm start

echo.
echo Bot stopped. Review the message above for details.
pause
