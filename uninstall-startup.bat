@echo off

set VBS_FILE=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\spotify-local-rp.vbs

if exist "%VBS_FILE%" (
    del "%VBS_FILE%"
    echo.
    echo  Done! Startup entry removed.
) else (
    echo.
    echo  No startup entry found.
)

cd /d "%~dp0"
if exist .env (
    powershell -ExecutionPolicy Bypass -Command "(Get-Content .env) | Where-Object { $_ -notmatch '^START_MINIMIZED=' } | Set-Content .env"
    echo  START_MINIMIZED removed from .env.
)

echo.
pause
