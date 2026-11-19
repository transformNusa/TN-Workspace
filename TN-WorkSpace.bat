@echo off
title TN-Workspace - TransformNusa
rem Jalankan dari folder mana pun: skrip pindah ke direktorinya sendiri.
cd /d "%~dp0"
call npm run dev
pause
