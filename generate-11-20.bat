@echo off
echo ============================================================
echo Color Flow Puzzle - Generate Grids 11x11 to 20x20
echo ============================================================
echo.
echo This command will generate levels for grids 11x11 through 20x20.
echo.
echo TIP: You can press Ctrl+C to pause. Resume later by running this file again.
echo ============================================================
echo.

cd /d "%~dp0"

call npx tsx scripts/pre-generate-levels.ts --grid 11-20

echo.
echo ============================================================
echo Generation Complete!
echo ============================================================
echo.
pause
