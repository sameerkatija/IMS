@echo off
setlocal

:: Resolve root directory where this script resides
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"

if not exist "%BACKEND_DIR%" (
    echo [ERROR] Could not find backend folder at "%BACKEND_DIR%"
    pause
    exit /b 1
)

echo Starting backend server (npm run dev)...
cd /d "%BACKEND_DIR%"
call npm run dev

endlocal
