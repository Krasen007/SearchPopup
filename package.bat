@echo off
setlocal

set "OUTPUT_DIR=dist"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0package-extension.ps1" -OutputDir "%OUTPUT_DIR%"

endlocal