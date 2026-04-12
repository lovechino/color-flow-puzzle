/**
 * Diagnostic script - find EXACTLY which step is hanging
 * Run: npx tsx scripts/diagnose-generation.ts
 */

import { placeDots } from '../src/generator/steps/PlaceDots';
import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';
import { MechanicsPlacer } from '../src/generator/steps/PlaceMechanics';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import { SeededRandom } from '../src/generator/SeededRandom';
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_FILE = join(process.cwd(), 'diagnose-result.txt');
function log(msg: string) {
  console.log(msg);
  writeFileSync(OUTPUT_FILE, msg + '\n', { flag: 'a' });
}

// Clear log file
writeFileSync(OUTPUT_FILE, '=== DIAGNOSTIC START ===\n');

async function main() {
  const globalStart = Date.now();
  log('Starting diagnostic test for 5x5 level #3...');
  
  const gridSize = 5;
  const numColors = 4;
  const targetDifficulty = 19;
  const seed = 'g05_003_attempt0';
  
  const solver = new BacktrackingSolver();
  const placer = new MechanicsPlacer();
  const validator = new UniquenessValidator();
  const scorer = new DifficultyScorer();
  
  let successCount = 0;
  let failCount = 0;
  const maxTests = 5;
  
  for (let attempt = 0; attempt < 50 && successCount < maxTests; attempt++) {
    const retrySeed = `${seed}_retry${attempt}`;
    const rng = new SeededRandom(retrySeed);
    const attemptStart = Date.now();
    
    // ── Step 1: Place dots ──
    const s1 = Date.now();
    const pairs = placeDots(gridSize, numColors, rng, {
      minManhattanDistance: 2,
      minColorSpread: 1,
      avoidCorners: true,
    });
    const dotsTime = Date.now() - s1;
    
    if (!pairs) {
      failCount++;
      log(`[Attempt ${attempt}] ❌ dots FAILED (${dotsTime}ms)`);
      continue;
    }
    log(`[Attempt ${attempt}] ✅ dots placed (${dotsTime}ms)`);
    
    // ── Step 2: Solve ──
    const s2 = Date.now();
    const solution = solver.solve(gridSize, pairs, []);
    const solveTime = Date.now() - s2;
    
    if (!solution) {
      failCount++;
      log(`[Attempt ${attempt}] ❌ solve FAILED (${solveTime}ms)`);
      continue;
    }
    log(`[Attempt ${attempt}] ✅ solved (${solveTime}ms, ${solution.length} paths)`);
    
    // ── Step 3: Place mechanics ──
    const s3 = Date.now();
    const mechanicsResult = placer.place({
      gridSize,
      solution: solution.map(s => ({ color: s.color as any, path: s.path })),
      pairs: pairs as any,
      allowedMechanics: [],
      difficultyTarget: targetDifficulty,
      rng,
    });
    const mechTime = Date.now() - s3;
    log(`[Attempt ${attempt}] ✅ mechanics placed (${mechTime}ms, ${mechanicsResult.walls.length} walls)`);
    
    // ── Step 4: Validate uniqueness ──
    const levelData = {
      gridSize,
      pairs,
      walls: mechanicsResult.walls,
      mixers: mechanicsResult.mixers,
      teleports: mechanicsResult.teleports,
      locks: mechanicsResult.locks,
      shapeMask: mechanicsResult.shapeMask,
      solution,
      mechanics: [] as any[],
    };
    
    log(`[Attempt ${attempt}] ⏳ Starting validation...`);
    const s4 = Date.now();
    const solCount = validator.countSolutions(levelData, 2);
    const valTime = Date.now() - s4;
    
    log(`[Attempt ${attempt}] Validation result: ${solCount} solutions (${valTime}ms)`);
    
    if (valTime > 10000) {
      log(`[Attempt ${attempt}] ⚠️  WARNING: validation took ${valTime}ms!`);
    }
    if (valTime > 30000) {
      log(`[Attempt ${attempt}] 🚨 CRITICAL: validation took ${valTime}ms - this is the bottleneck!`);
    }
    
    if (solCount !== 1) {
      failCount++;
      log(`[Attempt ${attempt}] ❌ validation FAILED (${solCount} solutions, ${valTime}ms)`);
      continue;
    }
    
    // ── Step 5: Score difficulty ──
    const s5 = Date.now();
    const score = scorer.score(levelData as any);
    const scoreTime = Date.now() - s5;
    log(`[Attempt ${attempt}] ✅ scored: ${score} (${scoreTime}ms)`);
    
    successCount++;
    log(`[Attempt ${attempt}] 🎉 FULL SUCCESS! Total: ${Date.now()-attemptStart}ms`);
    
    // Save the level
    const level = levelData as any;
    level.difficultyScore = score;
    level.difficultyLabel = scorer.getLabel(score);
    level.id = `g05_test_${successCount}`;
    level.par = solution.reduce((sum: number, s: any) => sum + s.path.length, 0);
    
    const outputPath = join(process.cwd(), `src/levels/grid_05/g05_test_${successCount}.json`);
    writeFileSync(outputPath, JSON.stringify(level, null, 2), 'utf8');
    log(`[Attempt ${attempt}] 💾 Saved to: ${outputPath}`);
  }
  
  log('\n=== DIAGNOSTIC SUMMARY ===');
  log(`Successes: ${successCount}`);
  log(`Failures: ${failCount}`);
  log(`Total time: ${((Date.now() - globalStart) / 1000).toFixed(1)}s`);
  log(`\nCheck diagnose-result.txt for full log`);
}

main().catch(err => {
  log(`ERROR: ${err.message}`);
  log(err.stack);
  process.exit(1);
});
