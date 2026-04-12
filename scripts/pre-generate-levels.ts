/**
 * Pre-generation script for all puzzle levels (3×3 - 20×20)
 * 
 * Strategy:
 * - Grids 3x3 - 6x6: Random placement (works fine, already generated)
 * - Grids 7x7 - 20x20: Seed-based mutation (hand-crafted seeds)
 * 
 * Usage:
 *   npx tsx scripts/pre-generate-levels.ts              # Generate all
 *   npx tsx scripts/pre-generate-levels.ts --grid 8     # Generate only 8×8
 */

import { PuzzleGenerator } from '../src/generator/PuzzleGenerator';
import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import type { LevelData, Mechanic } from '../src/types';
import { LEVEL_COUNTS_BY_GRID } from '../src/config';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'src', 'levels');
const SEEDS_DIR = join(process.cwd(), 'src', 'seeds');

// ─── State management ─────────────────────────────────────────────────────────

interface GenerationState {
  startedAt: string;
  lastUpdatedAt: string;
  grids: Record<number, { target: number; completed: number; status: string; }>;
}

const STATE_FILE = join(process.cwd(), 'generation-progress.json');

function loadState(): GenerationState | null {
  if (!existsSync(STATE_FILE)) return null;
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}

function saveState(state: GenerationState): void {
  state.lastUpdatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function initState(): GenerationState {
  const state: GenerationState = { startedAt: new Date().toISOString(), lastUpdatedAt: '', grids: {} };
  for (const size of Object.keys(LEVEL_COUNTS_BY_GRID).map(Number)) {
    state.grids[size] = { target: LEVEL_COUNTS_BY_GRID[size], completed: 0, status: 'pending' };
  }
  return state;
}

// ─── Seed loading ─────────────────────────────────────────────────────────────

function loadSeedForGrid(gridSize: number): LevelData | null {
  const seedPath = join(SEEDS_DIR, `g${String(gridSize).padStart(2, '0')}_seed_001.json`);
  if (!existsSync(seedPath)) return null;
  try {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as LevelData;
    if (!Array.isArray(seed.solution) || seed.solution.length === 0) return null;
    return seed;
  } catch { return null; }
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

// ─── Generation helpers ───────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

function getTargetDifficultyRange(gridSize: number): [number, number] {
  if (gridSize <= 5) return [10, 40];
  if (gridSize <= 8) return [20, 60];
  if (gridSize <= 12) return [30, 75];
  if (gridSize <= 16) return [40, 85];
  return [50, 95];
}

// ─── Mutation-based generation from seeds ─────────────────────────────────────

async function generateByMutation(gridSize: number, levelCount: number, state: GenerationState): Promise<void> {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });

  // Load seed
  const seedLevel = loadSeedForGrid(gridSize);
  if (!seedLevel) {
    console.log(`  ❌ No seed file for ${gridSize}×${gridSize}. Create src/seeds/g${String(gridSize).padStart(2,'0')}_seed_001.json first.`);
    state.grids[gridSize].status = 'failed';
    saveState(state);
    return;
  }
  console.log(`  ✅ Loaded seed: ${seedLevel.id}`);

  // Load existing levels to skip
  const existingIndices = loadExistingLevels(gridSize);
  let generated = existingIndices.size;
  const gridStart = Date.now();

  state.grids[gridSize].completed = generated;
  state.grids[gridSize].status = generated >= levelCount ? 'completed' : 'in_progress';
  saveState(state);

  if (generated >= levelCount) {
    console.log(`  ✅ Already complete (${generated}/${levelCount}), skipping`);
    return;
  }

  console.log(`  🔄 Resuming: ${generated}/${levelCount} done, need ${levelCount - generated} more`);

  // Seed pool grows as we generate
  const pool: LevelData[] = [seedLevel];
  const validator = new UniquenessValidator();
  const scorer = new DifficultyScorer();
  const [minDiff, maxDiff] = getTargetDifficultyRange(gridSize);

  while (generated < levelCount) {
    const nextIndex = generated + 1;
    const targetDifficulty = minDiff + Math.floor((nextIndex / levelCount) * (maxDiff - minDiff));

    // Pick random seed from pool
    const seed = pool[Math.floor(Math.random() * pool.length)];

    process.stdout.write(`\r  [${nextIndex}/${levelCount}] Mutating from ${seed.id}... `);
    const mutStart = Date.now();

    const mutated = PuzzleGenerator.mutate(seed, nextIndex, targetDifficulty);

    if (!mutated) {
      console.log(`❌ Mutation failed (${((Date.now() - mutStart) / 1000).toFixed(1)}s)`);
      continue;
    }

    // Uniqueness check
    if (validator.countSolutions(mutated, 2) !== 1) {
      console.log(`❌ Not unique (${((Date.now() - mutStart) / 1000).toFixed(1)}s)`);
      continue;
    }

    // Score difficulty
    const score = scorer.score(mutated);
    mutated.difficultyScore = score;
    mutated.difficultyLabel = scorer.getLabel(score);
    mutated.par = mutated.solution.reduce((sum, s) => sum + s.path.length, 0);
    mutated.estimatedSolveTime = Math.round(mutated.par * 1.5 + score * 0.5);

    // Save
    const mutId = `g${String(gridSize).padStart(2, '0')}_${String(nextIndex).padStart(3, '0')}`;
    mutated.id = mutId;
    mutated.globalIndex = nextIndex;
    writeFileSync(join(gridDir, `${mutId}.json`), JSON.stringify(mutated, null, 2), 'utf8');

    // Add to pool for diversity
    pool.push(mutated);
    generated++;

    state.grids[gridSize].completed = generated;
    saveState(state);

    console.log(`✅ ${mutId} (${((Date.now() - mutStart) / 1000).toFixed(1)}s, score: ${score}, pool: ${pool.length})`);
  }

  const totalTime = Date.now() - gridStart;
  state.grids[gridSize].status = 'completed';
  state.grids[gridSize].completed = generated;
  saveState(state);

  console.log(`\n  ✅ Grid ${gridSize}×${gridSize}: ${generated}/${levelCount} in ${formatTime(totalTime)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

async function main(): Promise<void> {
  const options = parseArgs();
  const grids = options.grids || Object.keys(LEVEL_COUNTS_BY_GRID).map(Number).sort((a, b) => a - b);

  console.log('🚀 Pre-generating puzzle levels (seed-based mutation)');
  console.log(`   Grids: ${grids.join(', ')}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  let state = loadState() ?? initState();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Interrupted. Saving progress...');
    saveState(state);
    console.log('✅ Progress saved. Run again to resume.');
    process.exit(0);
  });

  process.on('SIGTERM', () => { saveState(state); process.exit(0); });

  for (const gridSize of grids) {
    if (!LEVEL_COUNTS_BY_GRID[gridSize]) {
      console.warn(`⚠️  No level count for ${gridSize}×${gridSize}, skipping`);
      continue;
    }
    await generateByMutation(gridSize, LEVEL_COUNTS_BY_GRID[gridSize], state);
  }

  console.log('\n🎉 All grids complete!\n');
}

main().catch(err => { console.error(err); process.exit(1); });
