@echo off
cd /d "%~dp0"
title Bot-Remote - kontrol AHK aktif
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Remote.ps1"
echo Bot-Remote berhenti.
pause
