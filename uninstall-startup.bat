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
echo.
pause
