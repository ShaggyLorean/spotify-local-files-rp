@echo off
cd /d "%~dp0"

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_FILE=%STARTUP_DIR%\spotify-local-rp.vbs
set BAT_PATH=%~dp0start.bat

echo Set ws = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo ws.Run "cmd /c """"%BAT_PATH%"""" --bg", 0, False >> "%VBS_FILE%"

findstr /b "START_MINIMIZED" .env >nul 2>&1
if %errorlevel% neq 0 (
    echo. >> .env
    echo START_MINIMIZED=true >> .env
)

echo.
echo  Done! The app will now start silently when you log in to Windows.
echo  To undo this, run uninstall-startup.bat
echo.
pause
