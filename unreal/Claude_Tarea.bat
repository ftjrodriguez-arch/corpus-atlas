@echo off
chcp 65001 >nul
title Corpus Atlas - tarea de Claude
cd /d "%~dp0"
echo inicio %date% %time% > "%~dp0claude_tarea_log.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0claude_tarea.ps1" >> "%~dp0claude_tarea_log.txt" 2>&1
echo FIN %time% >> "%~dp0claude_tarea_log.txt"
exit
