#!/usr/bin/env bash
# Clears stuck Playwright/Chrome processes and SingletonLock files.
# Run before any Playwright session to guarantee a clean start.
pkill -f -- "chrome"   2>/dev/null || true
pkill -f -- "chromium" 2>/dev/null || true
# Playwright cache locations differ by OS — clear locks in all common roots.
rm -f "$HOME/Library/Caches/ms-playwright/"*/Singleton*       2>/dev/null || true
rm -f "$HOME/Library/Caches/ms-playwright/"*/chrome-*/SingletonLock 2>/dev/null || true
rm -f "$HOME/.cache/ms-playwright/"*/Singleton*               2>/dev/null || true
rm -f "$HOME/.cache/ms-playwright/"*/chrome-*/SingletonLock   2>/dev/null || true
echo "Browser cleared."
