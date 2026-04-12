@echo off
echo ============================================================
echo Color Flow Puzzle - Level Pre-Generation
echo ============================================================
echo.
echo This will generate puzzle levels offline and save as JSON files.
echo The process can take several minutes to hours depending on grid size.
echo.
echo Grid sizes and estimated times:
echo   3x3-6x6:  ~10 minutes
echo   3x3-10x10: ~1.5 hours
echo   3x3-15x15: ~10 hours
echo   All (3-20): ~28 hours
echo.
echo You can safely interrupt (Ctrl+C) and resume later.
echo ============================================================
echo.

REM Change to the directory where this batch file is located
cd /d "%~dp0"

echo Current directory: %CD%
echo.

if "%1"=="" (
    echo Generating all levels for grids 3x3 - 6x6...
    echo.
    call npx tsx scripts/pre-generate-levels.ts
) else if "%1"=="--grid" (
    echo Generating levels for grid %2x%2...
    echo.
    call npx tsx scripts/pre-generate-levels.ts --grid %2
) else (
    echo Usage:
    echo   generate-levels.bat              # Generate grids 3-6
    echo   generate-levels.bat --grid 5     # Generate only grid 5
    echo   generate-levels.bat --all        # Generate grids 3-20
    echo.
)

echo.
echo ============================================================
echo Generation complete! Check src/levels/ for results.
echo ============================================================
echo.
echo To validate levels, run:
echo   npm run validate
echo.
pause
