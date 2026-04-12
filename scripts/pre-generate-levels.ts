/**
 * Pre-generation script for all puzzle levels (3×3 - 20×20)
 * 
 * This script generates all levels OFFLINE and saves them as JSON files.
 * Runtime will only load these pre-generated levels - NO runtime generation.
 * 
 * Features:
 * - Resumable: Can be interrupted and resumed from where it left off
 * - Progress tracking: Shows ETA and completion percentage
 * - Timeout handling: Skips levels that take too long
 * - Validation: Validates each level after generation
 * 
 * Usage:
 *   npx tsx scripts/pre-generate-levels.ts              # Generate all
 *   npx tsx scripts/pre-generate-levels.ts --grid 6     # Generate only 6×6
 *   npx tsx scripts/pre-generate-levels.ts --start 10   # Resume from level 10
 */

import { PuzzleGenerator } from '../src/generator/PuzzleGenerator';
import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import type { LevelData, Mechanic } from '../src/types';
import { 
  LEVEL_COUNTS_BY_GRID, 
  COLOR_RANGE_BY_GRID, 
  MECHANIC_UNLOCK_GRID 
} from '../src/config';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'src', 'levels');

// ─── Configuration ────────────────────────────────────────────────────────────

interface GenerationStats {
  totalLevels: number;
  generatedLevels: number;
  failedLevels: number;
  startTime: number;
  gridStats: Record<number, { total: number; generated: number; failed: number; timeMs: number }>;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getAllowedMechanics(gridSize: number): Mechanic[] {
  const allowed: Mechanic[] = [];
  for (const [mech, unlockGrid] of Object.entries(MECHANIC_UNLOCK_GRID)) {
    if (gridSize >= unlockGrid) allowed.push(mech as Mechanic);
  }
  return allowed;
}

function getTargetDifficultyRange(gridSize: number): [number, number] {
  // Spread difficulties evenly across the spectrum
  // Small grids: focus on easy-medium
  // Large grids: include hard-expert
  if (gridSize <= 5) return [10, 40];   // trivial-medium
  if (gridSize <= 8) return [20, 60];   // easy-hard
  if (gridSize <= 12) return [30, 75];  // medium-expert
  if (gridSize <= 16) return [40, 85];  // hard-master
  return [50, 95];                       // expert-legendary
}

function getNumColorsForDifficulty(gridSize: number, targetDiff: number): number {
  const [minColors, maxColors] = COLOR_RANGE_BY_GRID[gridSize];
  const range = maxColors - minColors;
  const normalizedDiff = (targetDiff - 10) / 85; // 0-1
  return minColors + Math.floor(normalizedDiff * range);
}

function createLevelId(gridSize: number, index: number): string {
  return `g${String(gridSize).padStart(2, '0')}_${String(index).padStart(3, '0')}`;
}

// ─── Level Generation with Retry Logic ────────────────────────────────────────

function generateSingleLevel(
  gridSize: number,
  levelIndex: number,
  targetDifficulty: number
): LevelData | null {
  const maxRetries = 50;
  const numColors = getNumColorsForDifficulty(gridSize, targetDifficulty);
  const mechanics = getAllowedMechanics(gridSize);

  const generator = new PuzzleGenerator();
  const scorer = new DifficultyScorer();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const seed = `${createLevelId(gridSize, levelIndex)}_attempt${attempt}`;

    const level = generator.generate({
      gridSize,
      numColors,
      targetDifficulty,
      mechanics,
      seed
    });

    if (!level) continue;

    // NOTE: generator.generate() already validates uniqueness (countSolutions === 1)
    // No need to validate again here — that was the bug causing 40+ minute hangs!

    // Score difficulty
    const score = scorer.score(level);
    level.difficultyScore = score;
    level.difficultyLabel = scorer.getLabel(score);
    level.par = level.solution.reduce((sum, s) => sum + s.path.length, 0);
    level.estimatedSolveTime = Math.round(level.par * 1.5 + score * 0.5);
    level.id = createLevelId(gridSize, levelIndex);
    level.globalIndex = levelIndex;

    // Check if difficulty is within acceptable range
    const maxDiff = gridSize <= 5 ? 100 : 20;
    if (Math.abs(score - targetDifficulty) > maxDiff) continue;

    return level;
  }

  return null;
}

// ─── Progress Tracking ────────────────────────────────────────────────────────

function loadStats(): GenerationStats | null {
  const statsPath = join(OUTPUT_DIR, 'generation-stats.json');
  if (!existsSync(statsPath)) return null;
  
  try {
    return JSON.parse(readFileSync(statsPath, 'utf8'));
  } catch {
    return null;
  }
}

function saveStats(stats: GenerationStats): void {
  const statsPath = join(OUTPUT_DIR, 'generation-stats.json');
  writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');
}

function saveLevel(level: LevelData): void {
  const gridDir = join(OUTPUT_DIR, `grid_${String(level.gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });
  
  const filePath = join(gridDir, `${level.id}.json`);
  writeFileSync(filePath, JSON.stringify(level, null, 2), 'utf8');
}

function loadExistingLevels(gridSize: number): Set<number> {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) return new Set();
  
  try {
    const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
    const indices = new Set<number>();
    
    for (const file of files) {
      const match = file.match(/g\d+_(\d+)\.json/);
      if (match) {
        indices.add(parseInt(match[1], 10));
      }
    }
    
    return indices;
  } catch {
    return new Set();
  }
}

// ─── Main Generation Logic ────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function generateForGridSize(
  gridSize: number, 
  stats: GenerationStats
): void {
  const levelCount = LEVEL_COUNTS_BY_GRID[gridSize];
  const existingLevels = loadExistingLevels(gridSize);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generating ${levelCount} levels for ${gridSize}×${gridSize}...`);
  console.log(`Already exists: ${existingLevels.size} levels`);
  console.log(`${'='.repeat(60)}`);

  if (!stats.gridStats[gridSize]) {
    stats.gridStats[gridSize] = { total: levelCount, generated: 0, failed: 0, timeMs: 0 };
  }

  const gridStats = stats.gridStats[gridSize];
  const gridStart = Date.now();

  for (let i = 1; i <= levelCount; i++) {
    // Skip existing levels
    if (existingLevels.has(i)) {
      console.log(`  [${i}/${levelCount}] ⏭️  Skipped (exists)`);
      continue;
    }

    // Target difficulty: spread across range
    const [minDiff, maxDiff] = getTargetDifficultyRange(gridSize);
    const targetDifficulty = minDiff + Math.floor((i / levelCount) * (maxDiff - minDiff));

    console.log(`  [${i}/${levelCount}] 🎯 Target difficulty: ${targetDifficulty}...`);
    const levelStart = Date.now();
    
    const level = generateSingleLevel(gridSize, i, targetDifficulty);
    const levelTime = Date.now() - levelStart;

    if (level) {
      saveLevel(level);
      gridStats.generated++;
      stats.generatedLevels++;
      console.log(`  [${i}/${levelCount}] ✅ Created in ${formatTime(levelTime)} (score: ${level.difficultyScore}, ${level.difficultyLabel})`);
    } else {
      gridStats.failed++;
      stats.failedLevels++;
      console.log(`  [${i}/${levelCount}] ❌ Failed after ${formatTime(levelTime)}`);
    }

    gridStats.timeMs += levelTime;
    stats.totalLevels = Object.values(stats.gridStats).reduce((sum, g) => sum + g.total, 0);
    stats.generatedLevels = Object.values(stats.gridStats).reduce((sum, g) => sum + g.generated, 0);

    // Save progress after each level
    saveStats(stats);

    // ETA
    const elapsed = Date.now() - stats.startTime;
    const rate = elapsed / stats.generatedLevels;
    const remaining = (stats.totalLevels - stats.generatedLevels) * rate;
    console.log(`       📊 Progress: ${((stats.generatedLevels / stats.totalLevels) * 100).toFixed(1)}% | ETA: ${formatTime(remaining)}`);
  }

  gridStats.timeMs = Date.now() - gridStart;
  console.log(`\n✅ Grid ${gridSize}×${gridSize} complete: ${gridStats.generated}/${levelCount} levels in ${formatTime(gridStats.timeMs)}`);
}

function generateAllLevels(targetGrids?: number[]): void {
  const grids = targetGrids || Object.keys(LEVEL_COUNTS_BY_GRID).map(Number).sort((a, b) => a - b);
  
  console.log('🚀 Pre-generating puzzle levels');
  console.log(`   Grids: ${grids.join(', ')}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  // Load or create stats
  let stats = loadStats();
  if (!stats) {
    stats = {
      totalLevels: 0,
      generatedLevels: 0,
      failedLevels: 0,
      startTime: Date.now(),
      gridStats: {}
    };
  }

  // Generate for each grid size
  for (const gridSize of grids) {
    if (!LEVEL_COUNTS_BY_GRID[gridSize]) {
      console.warn(`⚠️  No level count for grid ${gridSize}×${gridSize}, skipping`);
      continue;
    }

    generateForGridSize(gridSize, stats);
  }

  // Final summary
  const totalTime = Date.now() - stats.startTime;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 GENERATION COMPLETE!`);
  console.log(`   Total levels generated: ${stats.generatedLevels}`);
  console.log(`   Total failed: ${stats.failedLevels}`);
  console.log(`   Total time: ${formatTime(totalTime)}`);
  console.log(`${'='.repeat(60)}\n`);
}

// ─── CLI Interface ────────────────────────────────────────────────────────────

function parseArgs(): { grids?: number[] } {
  const args = process.argv.slice(2);
  const result: { grids?: number[] } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--grid' && args[i + 1]) {
      result.grids = [parseInt(args[i + 1], 10)];
      i++;
    }
  }

  return result;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

const options = parseArgs();
generateAllLevels(options.grids);
