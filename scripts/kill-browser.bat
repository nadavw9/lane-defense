@echo off
REM Clears stuck Playwright/Chrome processes and SingletonLock files.
REM Run before any Playwright session to guarantee a clean start.
taskkill /F /IM chrome.exe /T 2>nul
taskkill /F /IM chromium.exe /T 2>nul
del /Q "%LOCALAPPDATA%\ms-playwright\*\chrome-win\SingletonLock" 2>nul
del /Q "%LOCALAPPDATA%\ms-playwright\*\Singleton*" 2>nul
echo Browser cleared.
