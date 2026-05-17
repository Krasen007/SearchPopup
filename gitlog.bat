@echo off
git rev-parse v1.75.3 >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Tag v1.75.3 not found in this repository >&2
    exit /b 1
)
git log v1.75.3..HEAD --oneline > changelog.txt
if %errorlevel% neq 0 (
    echo Error: Failed to generate changelog >&2
    exit /b 1
)
