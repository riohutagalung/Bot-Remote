@echo off
cd /d "%~dp0"
title Bot-Remote - kontrol laptop aktif
node --env-file=.env local.js
echo.
echo Bot-Remote berhenti. Tutup jendela ini untuk keluar.
pause
