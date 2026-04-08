@echo off
cd /d "%~dp0"

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_FILE=%STARTUP_DIR%\spotify-local-rp.vbs
set BAT_DIR=%~dp0
set BAT_DIR=%BAT_DIR:~0,-1%

echo Set ws = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo ws.CurrentDirectory = "%BAT_DIR%" >> "%VBS_FILE%"
echo ws.Run "cmd /c npm start", 0, False >> "%VBS_FILE%"

findstr /b "START_MINIMIZED" .env >nul 2>&1
if %errorlevel% neq 0 (
    echo. >> .env
    echo START_MINIMIZED=true >> .env
)

echo.
echo  Done! The app will now start silently when you log in to Windows.
echo  Starting the app in the background now...
echo.

wscript "%~dp0run-hidden.vbs"

echo  To undo this, run uninstall-startup.bat
echo.
pause
