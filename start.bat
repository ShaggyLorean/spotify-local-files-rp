@echo off
cd /d "%~dp0"

set MINIMIZED=false
for /f "tokens=1,2 delims==" %%a in ('findstr /b "START_MINIMIZED" .env 2^>nul') do (
    if "%%a"=="START_MINIMIZED" set MINIMIZED=%%b
)

if "%MINIMIZED%"=="true" (
    wscript "%~dp0run-hidden.vbs"
) else (
    npm start
    pause
)
