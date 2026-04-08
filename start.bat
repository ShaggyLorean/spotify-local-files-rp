@echo off
cd /d "%~dp0"

set MINIMIZED=false
for /f "tokens=1,2 delims==" %%a in ('findstr /b "START_MINIMIZED" .env 2^>nul') do (
    if "%%a"=="START_MINIMIZED" set MINIMIZED=%%b
)

if "%MINIMIZED%"=="true" (
    if not "%~1"=="--bg" (
        echo Set ws = CreateObject("WScript.Shell") > "%temp%\spotify-rp-bg.vbs"
        echo ws.Run "cmd /c """%~f0"" --bg", 0, False >> "%temp%\spotify-rp-bg.vbs"
        wscript "%temp%\spotify-rp-bg.vbs"
        exit
    )
    npm start
) else (
    npm start
    pause
)
