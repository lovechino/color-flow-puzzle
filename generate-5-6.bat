@echo off
echo ============================================================
echo Quick Generation for grids 5x5 and 6x6 only
echo ============================================================
echo.

cd /d "%~dp0"
echo Current directory: %CD%
echo.

echo Generating grid 5x5...
call npx tsx scripts/pre-generate-levels.ts --grid 5

echo.
echo Generating grid 6x6...
call npx tsx scripts/pre-generate-levels.ts --grid 6

echo.
echo ============================================================
echo Done! Validating levels...
echo ============================================================
call npm run validate

echo.
pause
