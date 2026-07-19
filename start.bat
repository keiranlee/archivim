@echo off
title archivim
chcp 65001 >nul 2>&1

set "DENO=C:\Users\crazy\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe"

echo.
echo   archivim - Muzik Indirici
echo   ─────────────────────────
echo   Sunucu baslatiliyor...
echo.

:: Start server and open Edge in app mode
powershell -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"

echo.
echo   Uygulama kapatildi. Sunucu durduruldu.
pause
