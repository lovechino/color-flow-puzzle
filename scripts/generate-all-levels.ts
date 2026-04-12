import { PuzzleGenerator } from '../src/generator/PuzzleGenerator';
import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import type { LevelMetadata } from '../src/types';
import { LEVEL_COUNTS_BY_GRID, COLOR_RANGE_BY_GRID, MECHANIC_UNLOCK_GRID } from '../src/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'src', 'levels');

function getAllowedMechanics(gridSize: number): any[] {
  const allowed: any[] = [];
  for (const [mech, unlockGrid] of Object.entries(MECHANIC_UNLOCK_GRID)) {
    if (gridSize >= unlockGrid) allowed.push(mech);
  }
  return allowed;
}

function finalizeLevel(level: any, generated: number, scoredDifficulty: number, scorer: any) {
  level.id = `g${String(level.gridSize).padStart(2, '0')}_${String(generated + 1).padStart(3, '0')}`;
  level.globalIndex = generated + 1;
  level.difficultyScore = scoredDifficulty;
  level.difficultyLabel = scorer.getLabel(scoredDifficulty);
  level.par = level.solution.reduce((sum: number, s: any) => sum + s.path.length, 0);
  level.estimatedSolveTime = Math.round(level.par * 1.5 + scoredDifficulty * 0.5);
}

function tryGenerateLevel(gridSize: number, generated: number, config: any, generator: any, validator: any, scorer: any) {
  const level = generator.generate(config);
  if (!level) return null;
  
  if (validator.countSolutions(level, 2) !== 1) return null;

  const scoredDifficulty = scorer.score(level);
  const maxDiff = gridSize === 3 ? 100 : 15;
  if (Math.abs(scoredDifficulty - config.targetDifficulty) > maxDiff) return null;

  finalizeLevel(level, generated, scoredDifficulty, scorer);
  return level;
}

function generateForGridSize(gridSize: number): void {
  console.log(`\n🚀 Generating levels for ${gridSize}x${gridSize}...`);
  
  const levelCount = LEVEL_COUNTS_BY_GRID[gridSize];
  const [minColors, maxColors] = COLOR_RANGE_BY_GRID[gridSize];
  const mechanics = getAllowedMechanics(gridSize);
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });

  const generator = new PuzzleGenerator();
  const scorer = new DifficultyScorer();
  const validator = new UniquenessValidator();
  const index: { [id: string]: LevelMetadata } = {};
  let generated = 0, attempt = 0;
  const maxAttempts = levelCount * 500; // Increased to handle 10% success rate

  const globalStart = Date.now();

  while (generated < levelCount && attempt < maxAttempts) {
    attempt++;
    
    const numColors = Math.floor(Math.random() * (maxColors - minColors + 1)) + minColors;
    const targetDifficulty = Math.floor(Math.random() * 100) + 1;
    const seed = `g${String(gridSize).padStart(2, '0')}_${String(generated + 1).padStart(3, '0')}_attempt${attempt}`;

    if (attempt % 2 === 0) {
      const elapsed = ((Date.now() - globalStart) / 1000).toFixed(1);
      console.log(`  ... attempt ${attempt}, generated: ${generated}/${levelCount} (${elapsed}s)`);
    }

    const level = tryGenerateLevel(gridSize, generated, { gridSize, numColors, targetDifficulty, mechanics, seed }, generator, validator, scorer);
    if (!level) continue;

    writeFileSync(join(gridDir, `${level.id}.json`), JSON.stringify(level, null, 2), 'utf8');
    index[level.id] = { id: level.id, gridSize: level.gridSize, globalIndex: level.globalIndex, pairs: level.pairs, difficultyScore: level.difficultyScore, difficultyLabel: level.difficultyLabel, par: level.par, mechanics: level.mechanics };
    generated++;
    console.log(`  ✅ Level ${generated}/${levelCount} created (attempt ${attempt})`);
  }
  const totalTime = ((Date.now() - globalStart) / 1000).toFixed(1);
  console.log(`\n✅ Grid ${gridSize}×${gridSize}: ${generated}/${levelCount} levels in ${totalTime}s`);
  writeFileSync(join(gridDir, 'index.ts'), `export const levels = ${JSON.stringify(index, null, 2)};\n`, 'utf8');
}

function main(): void {
  const targetGrids = [3, 4, 5, 6];
  for (const size of targetGrids) generateForGridSize(size);
  console.log('\n🎉 Level generation for 3x3 - 6x6 complete!');
}

main();