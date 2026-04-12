/**
 * Fast pre-generation script - reuses instances to minimize overhead
 * 
 * Usage:
 *   npx tsx scripts/pre-generate-fast.ts              # Generate all 3-6
 *   npx tsx scripts/pre-generate-fast.ts --grid 6     # Generate only 6
 *   npx tsx scripts/pre-generate-fast.ts --grids 5,6  # Generate 5 and 6
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

// ─── Reuse instances (avoid recreation overhead) ─────────────────────────────
const generator = new PuzzleGenerator();
const scorer = new DifficultyScorer();
// validator removed — generator.generate() already validates uniqueness internally

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllowedMechanics(gridSize: number): Mechanic[] {
  const allowed: Mechanic[] = [];
  for (const [mech, unlockGrid] of Object.entries(MECHANIC_UNLOCK_GRID)) {
    if (gridSize >= unlockGrid) allowed.push(mech as Mechanic);
  }
  return allowed;
}

function getTargetDifficultyRange(gridSize: number): [number, number] {
  if (gridSize <= 5) return [10, 40];
  if (gridSize <= 8) return [20, 60];
  if (gridSize <= 12) return [30, 75];
  if (gridSize <= 16) return [40, 85];
  return [50, 95];
}

function getNumColorsForDifficulty(gridSize: number, targetDiff: number): number {
  const [minColors, maxColors] = COLOR_RANGE_BY_GRID[gridSize];
  const range = maxColors - minColors;
  const normalizedDiff = (targetDiff - 10) / 85;
  return minColors + Math.floor(normalizedDiff * range);
}

function createLevelId(gridSize: number, index: number): string {
  return `g${String(gridSize).padStart(2, '0')}_${String(index).padStart(3, '0')}`;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ─── Generate single level ───────────────────────────────────────────────────

function generateSingleLevel(
  gridSize: number,
  levelIndex: number,
  targetDifficulty: number
): LevelData | null {
  const maxRetries = 50;
  const numColors = getNumColorsForDifficulty(gridSize, targetDifficulty);
  const mechanics = getAllowedMechanics(gridSize);

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

    // Check difficulty range
    const maxDiff = gridSize <= 5 ? 100 : 20;
    if (Math.abs(score - targetDifficulty) > maxDiff) continue;

    return level;
  }

  return null;
}

// ─── File operations ─────────────────────────────────────────────────────────

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
      if (match) indices.add(parseInt(match[1], 10));
    }
    return indices;
  } catch {
    return new Set();
  }
}

function updateIndex(gridSize: number): void {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
  const index: Record<string, any> = {};
  
  for (const file of files) {
    try {
      const level = JSON.parse(readFileSync(join(gridDir, file), 'utf8'));
      index[level.id] = {
        id: level.id,
        gridSize: level.gridSize,
        globalIndex: level.globalIndex,
        pairs: level.pairs,
        difficultyScore: level.difficultyScore,
        difficultyLabel: level.difficultyLabel,
        par: level.par,
        mechanics: level.mechanics
      };
    } catch {}
  }
  
  writeFileSync(join(gridDir, 'index.ts'), `export const levels = ${JSON.stringify(index, null, 2)};\n`, 'utf8');
}

// ─── Main generation logic ───────────────────────────────────────────────────

function generateForGridSize(gridSize: number): void {
  const levelCount = LEVEL_COUNTS_BY_GRID[gridSize];
  const existingLevels = loadExistingLevels(gridSize);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generating ${levelCount} levels for ${gridSize}x${gridSize}...`);
  console.log(`Already exists: ${existingLevels.size} levels`);
  console.log(`Need to generate: ${levelCount - existingLevels.size} levels`);
  console.log(`${'='.repeat(60)}\n`);

  const [minDiff, maxDiff] = getTargetDifficultyRange(gridSize);
  const gridStart = Date.now();
  let generated = 0;
  let failed = 0;

  for (let i = 1; i <= levelCount; i++) {
    if (existingLevels.has(i)) {
      process.stdout.write(`  [${i}/${levelCount}] ⏭️  Skip\n`);
      continue;
    }

    const targetDifficulty = minDiff + Math.floor((i / levelCount) * (maxDiff - minDiff));
    process.stdout.write(`  [${i}/${levelCount}] 🎯 Target: ${targetDifficulty}... `);
    
    const levelStart = Date.now();
    const level = generateSingleLevel(gridSize, i, targetDifficulty);
    const levelTime = Date.now() - levelStart;

    if (level) {
      saveLevel(level);
      generated++;
      process.stdout.write(`✅ ${level.difficultyLabel}(${level.difficultyScore}) in ${formatTime(levelTime)}\n`);
    } else {
      failed++;
      process.stdout.write(`❌ Failed (${formatTime(levelTime)})\n`);
    }

    // Update index after each level
    updateIndex(gridSize);
  }

  const totalTime = Date.now() - gridStart;
  console.log(`\n✅ Grid ${gridSize}x${gridSize}: ${generated} generated, ${failed} failed in ${formatTime(totalTime)}\n`);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(): { grids?: number[] } {
  const args = process.argv.slice(2);
  const result: { grids?: number[] } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--grid' && args[i + 1]) {
      result.grids = [parseInt(args[i + 1], 10)];
      i++;
    } else if (args[i] === '--grids' && args[i + 1]) {
      result.grids = args[i + 1].split(',').map(s => parseInt(s.trim(), 10));
      i++;
    }
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const options = parseArgs();
  const grids = options.grids || [3, 4, 5, 6];
  
  console.log('🚀 Fast Pre-generation Starting');
  console.log(`   Grids: ${grids.join(', ')}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  const globalStart = Date.now();

  for (const gridSize of grids) {
    if (!LEVEL_COUNTS_BY_GRID[gridSize]) {
      console.warn(`⚠️  No level count for ${gridSize}x${gridSize}, skipping`);
      continue;
    }
    generateForGridSize(gridSize);
  }

  const totalTime = Date.now() - globalStart;
  console.log(`${'='.repeat(60)}`);
  console.log(`🎉 ALL DONE! Total time: ${formatTime(totalTime)}`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
