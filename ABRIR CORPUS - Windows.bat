@echo off
cd /d "%~dp0"
title Corpus Atlas
echo Abriendo Corpus Atlas... (no cierres esta ventana mientras lo uses)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\servidor_local.ps1"
