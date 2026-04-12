@echo off
echo ============================================================
echo Color Flow Puzzle - Phase 5: Generate Large Grids (7x7 - 20x20)
echo ============================================================
echo.
echo Total levels to generate: 2,269
echo Estimated time: ~30 hours
echo.
echo TIP: You can press Ctrl+C to pause. Resume later by running this file again.
echo ============================================================
echo.

cd /d "%~dp0"

echo Starting generation...
echo.

REM Grid 7x7
echo ========================================
echo Generating 7x7 (28 levels) ~ 10 minutes
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 7

REM Grid 8x8
echo.
echo ========================================
echo Generating 8x8 (40 levels) ~ 15 minutes
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 8

REM Grid 9x9
echo.
echo ========================================
echo Generating 9x9 (55 levels) ~ 25 minutes
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 9

REM Grid 10x10
echo.
echo ========================================
echo Generating 10x10 (70 levels) ~ 35 minutes
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 10

REM Grid 11x11
echo.
echo ========================================
echo Generating 11x11 (88 levels) ~ 50 minutes
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 11

REM Grid 12x12
echo.
echo ========================================
echo Generating 12x12 (108 levels) ~ 1 hour
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 12

REM Grid 13x13
echo.
echo ========================================
echo Generating 13x13 (130 levels) ~ 1.5 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 13

REM Grid 14x14
echo.
echo ========================================
echo Generating 14x14 (155 levels) ~ 2 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 14

REM Grid 15x15
echo.
echo ========================================
echo Generating 15x15 (182 levels) ~ 2.5 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 15

REM Grid 16x16
echo.
echo ========================================
echo Generating 16x16 (212 levels) ~ 3 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 16

REM Grid 17x17
echo.
echo ========================================
echo Generating 17x17 (245 levels) ~ 3.5 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 17

REM Grid 18x18
echo.
echo ========================================
echo Generating 18x18 (280 levels) ~ 4 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 18

REM Grid 19x19
echo.
echo ========================================
echo Generating 19x19 (318 levels) ~ 5 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 19

REM Grid 20x20
echo.
echo ========================================
echo Generating 20x20 (358 levels) ~ 6 hours
echo ========================================
call npx tsx scripts/pre-generate-levels.ts --grid 20

echo.
echo ============================================================
echo Phase 5 Complete! All grids 7x7 - 20x20 generated.
echo ============================================================
echo.
echo Run validation to verify:
echo   npm run validate
echo.
pause
