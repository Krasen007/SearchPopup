@echo off
git rev-parse 1.78.1 >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Tag 1.78.1 not found in this repository >&2
    exit /b 1
)
git log 1.78.1..HEAD --oneline > changelog.txt
if %errorlevel% neq 0 (
    echo Error: Failed to generate changelog >&2
    exit /b 1
)
