/**
 * Pre-generation script for all puzzle levels (3×3 - 20×20)
 * 
 * Strategy:
 * - Grids 3x3 - 6x6: Random placement (works fine)
 * - Grids 7x7 - 20x20: Mutation-based (random placement fails for large grids)
 * 
 * Usage:
 *   npx tsx scripts/pre-generate-levels.ts              # Generate all
 *   npx tsx scripts/pre-generate-levels.ts --grid 6     # Generate only 6×6
 */

import { PuzzleGenerator } from '../src/generator/PuzzleGenerator';
import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import type { LevelData, Mechanic } from '../src/types';
import { LEVEL_COUNTS_BY_GRID, COLOR_RANGE_BY_GRID, MECHANIC_UNLOCK_GRID } from '../src/config';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'src', 'levels');

// ─── Generation stats ─────────────────────────────────────────────────────────

interface GridStats { total: number; generated: number; failed: number; timeMs: number; }
interface GenerationStats {
  totalLevels: number;
  generatedLevels: number;
  failedLevels: number;
  startTime: number;
  gridStats: Record<number, GridStats>;
}

function loadStats(): GenerationStats | null {
  const statsPath = join(OUTPUT_DIR, 'generation-stats.json');
  if (!existsSync(statsPath)) return null;
  try { return JSON.parse(readFileSync(statsPath, 'utf8')); } catch { return null; }
}

function saveStats(stats: GenerationStats): void {
  writeFileSync(join(OUTPUT_DIR, 'generation-stats.json'), JSON.stringify(stats, null, 2), 'utf8');
}

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllowedMechanics(gridSize: number): Mechanic[] {
  return Object.entries(MECHANIC_UNLOCK_GRID)
    .filter(([, unlockGrid]) => gridSize >= (unlockGrid as number))
    .map(([mech]) => mech as Mechanic);
}

function getTargetDifficultyRange(gridSize: number): [number, number] {
  if (gridSize <= 5) return [10, 40];
  if (gridSize <= 8) return [20, 60];
  if (gridSize <= 12) return [30, 75];
  if (gridSize <= 16) return [40, 85];
  return [50, 95];
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
  } catch { return new Set(); }
}

// ─── Random generation (for 3x3 - 6x6) ───────────────────────────────────────

function generateByRandom(gridSize: number, levelCount: number, existingIndices: Set<number>, stats: GenerationStats): void {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });

  if (!stats.gridStats[gridSize]) {
    stats.gridStats[gridSize] = { total: levelCount, generated: 0, failed: 0, timeMs: 0 };
  }
  const gridStats = stats.gridStats[gridSize];
  const gridStart = Date.now();
  const generator = new PuzzleGenerator();
  const scorer = new DifficultyScorer();
  const [minDiff, maxDiff] = getTargetDifficultyRange(gridSize);
  const [minColors, maxColors] = COLOR_RANGE_BY_GRID[gridSize];
  const mechanics = getAllowedMechanics(gridSize);

  let generated = existingIndices.size;
  let nextIndex = 1;
  while (existingIndices.has(nextIndex)) nextIndex;

  while (generated < levelCount) {
    const targetDifficulty = minDiff + Math.floor((nextIndex / levelCount) * (maxDiff - minDiff));
    const numColors = minColors + Math.floor(((targetDifficulty - 10) / 85) * (maxColors - minColors));
    const seed = `g${String(gridSize).padStart(2, '0')}_${String(nextIndex).padStart(3, '0')}`;

    console.log(`  [${nextIndex}/${levelCount}] 🎯 Target difficulty: ${targetDifficulty}...`);
    const levelStart = Date.now();

    const level = generator.generate({ gridSize, numColors, targetDifficulty, mechanics, seed });

    if (level) {
      const score = scorer.score(level);
      level.difficultyScore = score;
      level.difficultyLabel = scorer.getLabel(score);
      level.par = level.solution.reduce((sum, s) => sum + s.path.length, 0);
      level.estimatedSolveTime = Math.round(level.par * 1.5 + score * 0.5);
      level.id = seed;
      level.globalIndex = nextIndex;

      writeFileSync(join(gridDir, `${level.id}.json`), JSON.stringify(level, null, 2), 'utf8');
      existingIndices.add(nextIndex);
      gridStats.generated++;
      stats.generatedLevels++;
      generated++;
      nextIndex++;
      console.log(`  ✅ ${seed} in ${((Date.now() - levelStart) / 1000).toFixed(0)}s (score: ${score})`);
    } else {
      gridStats.failed++;
      stats.failedLevels++;
      console.log(`  ❌ Failed after ${((Date.now() - levelStart) / 60000).toFixed(1)}min`);
    }

    gridStats.timeMs = Date.now() - gridStart;
    saveStats(stats);
  }

  console.log(`\n✅ Grid ${gridSize}x${gridSize}: ${gridStats.generated}/${levelCount} in ${formatTime(gridStats.timeMs)}`);
}

// ─── Mutation generation (for 7x7 - 20x20) ────────────────────────────────────

function generateByMutation(gridSize: number, levelCount: number, existingIndices: Set<number>, stats: GenerationStats): void {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });

  if (!stats.gridStats[gridSize]) {
    stats.gridStats[gridSize] = { total: levelCount, generated: 0, failed: 0, timeMs: 0 };
  }
  const gridStats = stats.gridStats[gridSize];
  const gridStart = Date.now();
  const scorer = new DifficultyScorer();
  const [minDiff, maxDiff] = getTargetDifficultyRange(gridSize);
  const [minColors] = COLOR_RANGE_BY_GRID[gridSize];
  const mechanics = getAllowedMechanics(gridSize);

  console.log(`\n⚙️  Using MUTATION strategy for ${gridSize}x${gridSize}`);
  console.log(`   Step 1: Bootstrap first level (may take 10-30 min)`);
  console.log(`   Step 2: Mutate to create remaining levels (~1-2 min each)`);

  // Step 1: Bootstrap first level
  let seed: LevelData | null = null;
  const bootstrapStart = Date.now();

  console.log(`\n🔨 Bootstrapping first level...`);
  for (let attempt = 0; attempt < 2000; attempt++) {
    if (attempt % 100 === 0) {
      const elapsed = ((Date.now() - bootstrapStart) / 60000).toFixed(1);
      console.log(`   Bootstrap attempt ${attempt}/2000 (${elapsed}min)`);
    }
    seed = PuzzleGenerator.bootstrap(gridSize, minColors, 30, mechanics, 1);
    
    // Strict validation: seed must have pairs AND solution
    if (seed && Array.isArray(seed.pairs) && seed.pairs.length > 0 && 
        Array.isArray(seed.solution) && seed.solution.length > 0) {
      console.log(`   ✅ Bootstrap succeeded on attempt ${attempt}! (${((Date.now()-bootstrapStart)/60000).toFixed(1)}min)`);
      break;
    }
    seed = null; // Reset if incomplete
  }

  if (!seed) {
    console.log(`\n❌ Bootstrap failed after 2000 attempts. Cannot generate ${gridSize}x${gridSize}.`);
    gridStats.failed = levelCount;
    return;
  }

  // Save seed as first level
  let nextIndex = 1;
  while (existingIndices.has(nextIndex)) nextIndex++;
  const seedId = `g${String(gridSize).padStart(2, '0')}_${String(nextIndex).padStart(3, '0')}`;
  seed.id = seedId;
  seed.globalIndex = nextIndex;
  writeFileSync(join(gridDir, `${seed.id}.json`), JSON.stringify(seed, null, 2), 'utf8');
  existingIndices.add(nextIndex);
  gridStats.generated = 1;
  stats.generatedLevels = 1;
  console.log(`   💾 Saved ${seed.id}`);

  // Step 2: Mutate to create remaining levels
  let currentLevels = [seed];
  console.log(`\n🧬 Mutating to create ${levelCount - existingIndices.size} more levels...`);

  while (existingIndices.size < levelCount) {
    nextIndex = 1;
    while (existingIndices.has(nextIndex)) nextIndex++;
    const targetDifficulty = minDiff + Math.floor((nextIndex / levelCount) * (maxDiff - minDiff));

    const seedIdx = Math.floor(Math.random() * currentLevels.length);
    const seedLevel = currentLevels[seedIdx];
    
    // Double-check seed validity before mutating
    if (!seedLevel || !Array.isArray(seedLevel.pairs) || !Array.isArray(seedLevel.solution)) {
      console.log(`  [${nextIndex}/${levelCount}] ⚠️  Invalid seed ${seedLevel?.id}, skipping...`);
      continue;
    }

    console.log(`  [${nextIndex}/${levelCount}] Mutating from ${seedLevel.id}...`);
    const mutStart = Date.now();

    const mutated = PuzzleGenerator.mutate(seedLevel, nextIndex, targetDifficulty);

    if (mutated) {
      const mutId = `g${String(gridSize).padStart(2, '0')}_${String(nextIndex).padStart(3, '0')}`;
      mutated.id = mutId;
      mutated.globalIndex = nextIndex;
      writeFileSync(join(gridDir, `${mutated.id}.json`), JSON.stringify(mutated, null, 2), 'utf8');

      existingIndices.add(nextIndex);
      gridStats.generated++;
      stats.generatedLevels++;
      currentLevels.push(mutated);
      console.log(`  ✅ ${mutId} in ${((Date.now() - mutStart) / 1000).toFixed(0)}s (score: ${mutated.difficultyScore})`);
    } else {
      gridStats.failed++;
      stats.failedLevels++;
      console.log(`  ❌ Mutation failed (${((Date.now() - mutStart) / 1000).toFixed(0)}s)`);
    }

    gridStats.timeMs = Date.now() - gridStart;
    saveStats(stats);
  }

  console.log(`\n✅ Grid ${gridSize}x${gridSize}: ${gridStats.generated}/${levelCount} in ${formatTime(gridStats.timeMs)}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function generateForGridSize(gridSize: number, stats: GenerationStats): void {
  const levelCount = LEVEL_COUNTS_BY_GRID[gridSize];
  const existingIndices = loadExistingLevels(gridSize);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generating ${levelCount} levels for ${gridSize}x${gridSize}...`);
  console.log(`Already exists: ${existingIndices.size} levels`);
  console.log(`${'='.repeat(60)}`);

  if (existingIndices.size >= levelCount) {
    console.log('✅ Already complete, skipping\n');
    return;
  }

  // For grids >= 7, use mutation-based approach
  if (gridSize >= 7) {
    generateByMutation(gridSize, levelCount, existingIndices, stats);
  } else {
    generateByRandom(gridSize, levelCount, existingIndices, stats);
  }
}

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

function main(): void {
  const options = parseArgs();
  const grids = options.grids || Object.keys(LEVEL_COUNTS_BY_GRID).map(Number).sort((a, b) => a - b);

  console.log('🚀 Pre-generating puzzle levels');
  console.log(`   Grids: ${grids.join(', ')}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  let stats = loadStats();
  if (!stats) {
    stats = { totalLevels: 0, generatedLevels: 0, failedLevels: 0, startTime: Date.now(), gridStats: {} };
  }

  for (const gridSize of grids) {
    if (!LEVEL_COUNTS_BY_GRID[gridSize]) {
      console.warn(`⚠️  No level count for ${gridSize}x${gridSize}, skipping`);
      continue;
    }
    generateForGridSize(gridSize, stats);
  }

  const totalTime = Date.now() - stats.startTime;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 Generation complete! Total time: ${formatTime(totalTime)}`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
