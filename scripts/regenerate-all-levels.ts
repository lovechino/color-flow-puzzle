/**
 * Regenerate all levels with uniqueness validation
 * 
 * Strategy:
 * - 3x3-6x6: Use solver + validator (proven to work)
 * - 7x7-8x8: Use solver + validator (slower but correct)
 * 
 * Each level is validated for uniqueness BEFORE saving.
 */

import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import { SeededRandom } from '../src/generator/SeededRandom';
import { placeDots } from '../src/generator/steps/PlaceDots';
import type { LevelData, Color, Mechanic } from '../src/types';
import { LEVEL_COUNTS_BY_GRID, COLOR_RANGE_BY_GRID, MECHANIC_UNLOCK_GRID } from '../src/config';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'src', 'levels');

function getAllowedMechanics(gridSize: number): Mechanic[] {
  return Object.entries(MECHANIC_UNLOCK_GRID)
    .filter(([, unlockGrid]) => gridSize >= (unlockGrid as number))
    .map(([mech]) => mech as Mechanic);
}

function loadExistingLevels(gridSize: number): { valid: Set<number>; invalid: Set<number> } {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) return { valid: new Set(), invalid: new Set() };
  
  const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
  const allIndices = new Set<number>();
  const validIndices = new Set<number>();
  
  for (const file of files) {
    const match = file.match(/g\d+_(\d+)\.json/);
    if (match) allIndices.add(parseInt(match[1], 10));
  }
  
  return { valid: validIndices, invalid: allIndices };
}

async function regenerateGrid(gridSize: number, targetCount: number): Promise<void> {
  const gridDir = join(OUTPUT_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });
  
  const solver = new BacktrackingSolver();
  const validator = new UniquenessValidator();
  const scorer = new DifficultyScorer();
  const [minColors, maxColors] = COLOR_RANGE_BY_GRID[gridSize];
  const mechanics: Mechanic[] = []; // No mechanics for now
  
  // Count existing valid levels
  let existingCount = 0;
  const existingFiles = readdirSync(gridDir).filter(f => f.endsWith('.json'));
  console.log(`  Existing files: ${existingFiles.length}, regenerating all with uniqueness check...`);
  
  let generated = 0;
  let attempts = 0;
  const maxAttempts = 50000;
  
  console.log(`  Target: ${targetCount} unique-solution levels\n`);
  
  while (generated < targetCount && attempts < maxAttempts) {
    attempts++;
    if (attempts % 1000 === 0) {
      console.log(`    Progress: ${attempts} attempts, ${generated}/${targetCount} valid levels`);
    }
    
    // Generate random level
    const numColors = minColors + Math.floor(Math.random() * (maxColors - minColors + 1));
    const rng = new SeededRandom(`regen_${gridSize}_${attempts}_${Date.now()}`);
    
    const pairs = placeDots(gridSize, numColors, rng, {
      minManhattanDistance: gridSize === 3 ? 1 : Math.max(2, Math.floor(gridSize * 0.35)),
      minColorSpread: 1,
      avoidCorners: gridSize > 3,
    });
    
    if (!pairs) continue;
    
    // Solve
    const solution = solver.solve(gridSize, pairs, []);
    if (!solution) continue;
    
    // Build level
    const level: LevelData = {
      id: `g${String(gridSize).padStart(2, '0')}_${String(generated + 1).padStart(3, '0')}`,
      gridSize,
      globalIndex: generated + 1,
      pairs: pairs as any,
      walls: [], mixers: [], teleports: [], locks: [],
      solution: solution as any,
      difficultyScore: 0, difficultyLabel: 'trivial',
      par: solution.reduce((s, p) => s + p.path.length, 0),
      estimatedSolveTime: 0, mechanics: [],
    };
    
    // CRITICAL: Validate uniqueness
    const solCount = validator.countSolutions(level, 2);
    if (solCount !== 1) continue; // Skip non-unique
    
    // Score difficulty
    const score = scorer.score(level);
    level.difficultyScore = score;
    level.difficultyLabel = scorer.getLabel(score);
    level.estimatedSolveTime = Math.round(level.par * 1.5 + score * 0.5);
    
    // Save
    level.id = `g${String(gridSize).padStart(2, '0')}_${String(generated + 1).padStart(3, '0')}`;
    const filePath = join(gridDir, level.id + '.json');
    writeFileSync(filePath, JSON.stringify(level, null, 2));
    generated++;
    
    console.log(`    ✅ ${level.id}: ${numColors} colors, score=${score} (${level.difficultyLabel}) [attempt ${attempts}]`);
  }
  
  console.log(`\n  ✅ Grid ${gridSize}x${gridSize}: ${generated}/${targetCount} unique-solution levels in ${attempts} attempts\n`);
}

async function main(): Promise<void> {
  const grids = process.argv.includes('--grid') 
    ? [parseInt(process.argv[process.argv.indexOf('--grid') + 1])]
    : [3, 4, 5, 6, 7, 8];
  
  console.log('🔄 Regenerating levels with uniqueness validation\n');
  
  for (const gridSize of grids) {
    const targetCount = LEVEL_COUNTS_BY_GRID[gridSize];
    if (!targetCount) continue;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Grid ${gridSize}x${gridSize} — ${targetCount} levels`);
    console.log(`${'='.repeat(60)}`);
    
    const start = Date.now();
    await regenerateGrid(gridSize, targetCount);
    console.log(`  Time: ${((Date.now() - start) / 60000).toFixed(1)} minutes`);
  }
  
  console.log('\n🎉 All grids regenerated with unique solutions!\n');
}

main().catch(console.error);
