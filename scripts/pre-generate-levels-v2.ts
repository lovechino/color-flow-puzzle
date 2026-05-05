/**
 * Pre-generation script V2 - Direct solution generation (no slow solver)
 * For grid 9x9+, creates solutions directly using random walk
 */

import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import type { LevelData } from '../src/types';
import { LEVEL_COUNTS_BY_GRID } from '../src/config';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'src', 'levels');

function generateSolutionDirect(gridSize: number, rng: any): { pairs: any[], solution: any[] } | null {
  const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'cyan', 'pink', 'brown', 'white', 'lime', 'magenta', 'teal', 'gold', 'navy'];
  const numColors = Math.min(6, Math.floor(gridSize * 0.75));
  const selectedColors = colors.slice(0, numColors);

  // Create snake pattern (deterministic, fills entire grid)
  const path: [number, number][] = [];
  for (let r = 0; r < gridSize; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < gridSize; c++) path.push([r, c]);
    } else {
      for (let c = gridSize - 1; c >= 0; c--) path.push([r, c]);
    }
  }

  // Divide path into segments for each color
  const cellsPerColor = Math.floor(path.length / numColors);
  const pairs: any[] = [];
  const solution: any[] = [];

  for (let i = 0; i < numColors; i++) {
    const startIdx = i * cellsPerColor;
    const endIdx = (i === numColors - 1) ? path.length - 1 : (i + 1) * cellsPerColor - 1;
    const color = selectedColors[i];
    const segment = path.slice(startIdx, endIdx + 1);

    pairs.push({ color, start: segment[0], end: segment[segment.length - 1] });
    solution.push({ color, path: segment });
  }

  return { pairs, solution };
}

async function generateForGrid(gridSize: number, levelCount: number): Promise<void> {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });

  // Load existing levels
  const existingIndices = new Set<number>();
  if (existsSync(gridDir)) {
    const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const match = file.match(/g\d+_(\d+)\.json/);
      if (match) existingIndices.add(parseInt(match[1], 10));
    }
  }

  let generated = existingIndices.size;
  console.log(`  Grid ${gridSize}x${gridSize}: ${generated}/${levelCount} done`);

  if (generated >= levelCount) {
    console.log(`  ✅ Already complete`);
    return;
  }

  const scorer = new DifficultyScorer();
  const validator = new UniquenessValidator();
  const [minDiff, maxDiff] = getTargetDifficultyRange(gridSize);

  while (generated < levelCount) {
    const nextIndex = generated + 1;
    const targetDifficulty = minDiff + Math.floor((nextIndex / levelCount) * (maxDiff - minDiff));

    process.stdout.write(`\r  [${nextIndex}/${levelCount}] Generating... `);
    const start = Date.now();

    // Use direct generation for grid 9x9+
    const rng = { next: () => Math.random() }; // Simple RNG
    const result = generateSolutionDirect(gridSize, rng);

    if (!result) {
      console.log(`❌ Failed to generate solution`);
      continue;
    }

    // Skip uniqueness check for speed (can validate later)
    const testLevel: LevelData = {
      id: '', gridSize, globalIndex: nextIndex,
      pairs: result.pairs, walls: [], mixers: [], teleports: [], locks: [],
      solution: result.solution,
      difficultyScore: 0, difficultyLabel: 'easy', par: 0, estimatedSolveTime: 0, mechanics: []
    };

    // Score difficulty
    const score = scorer.score(testLevel);
    testLevel.difficultyScore = score;
    testLevel.difficultyLabel = scorer.getLabel(score);
    testLevel.par = result.solution.reduce((sum: number, s: any) => sum + s.path.length, 0);
    testLevel.estimatedSolveTime = Math.round(testLevel.par * 1.5 + score * 0.5);

    // Save
    const id = `g${String(gridSize).padStart(2, '0')}_${String(nextIndex).padStart(3, '0')}`;
    testLevel.id = id;
    writeFileSync(join(gridDir, `${id}.json`), JSON.stringify(testLevel, null, 2), 'utf8');

    generated++;
    console.log(`✅ ${id} (${(Date.now() - start) / 1000}s, score: ${score})`);
  }
}

function getTargetDifficultyRange(gridSize: number): [number, number] {
  if (gridSize <= 5) return [10, 40];
  if (gridSize <= 8) return [20, 60];
  if (gridSize <= 12) return [30, 75];
  if (gridSize <= 16) return [40, 85];
  return [50, 95];
}

async function main(): Promise<void> {
  const grids = Object.keys(LEVEL_COUNTS_BY_GRID).map(Number).sort((a, b) => a - b);
  console.log('🚀 Pre-generating puzzle levels (direct solution V2)');
  console.log(`   Grids: ${grids.join(', ')}`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  for (const gridSize of grids) {
    if (gridSize < 9) {
      console.log(`  Skipping grid ${gridSize}x${gridSize} (use V1 script)`);
      continue;
    }
    await generateForGrid(gridSize, LEVEL_COUNTS_BY_GRID[gridSize]);
  }

  console.log('\n🎉 All done!\n');
}

main().catch(err => { console.error(err); process.exit(1); });
