/**
 * Verify all seed files have valid solutions
 * 
 * Usage: npx tsx scripts/verify-seeds.ts
 * 
 * For each seed in src/seeds/:
 *   1. Load the seed JSON
 *   2. Run solver on the pairs
 *   3. If solution found → inject into seed file and save
 *   4. If not found → report failure
 */

import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SEEDS_DIR = join(process.cwd(), 'src', 'seeds');

async function main(): Promise<void> {
  if (!readdirSync(SEEDS_DIR).length) {
    console.log('❌ No seed files found in src/seeds/');
    return;
  }

  const seedFiles = readdirSync(SEEDS_DIR).filter(f => f.endsWith('.json')).sort();
  console.log(`Verifying ${seedFiles.length} seed files...\n`);

  let passed = 0;
  let failed = 0;

  for (const file of seedFiles) {
    const seed = JSON.parse(readFileSync(join(SEEDS_DIR, file), 'utf8'));
    const solver = new BacktrackingSolver();

    console.log(`  🔄 ${file} (${seed.gridSize}×${seed.gridSize}, ${seed.pairs.length} colors)...`);
    const start = Date.now();
    const solution = solver.solve(seed.gridSize, seed.pairs, seed.walls ?? []);
    const elapsed = Date.now() - start;

    if (solution) {
      seed.solution = solution;
      seed.par = solution.reduce((sum: number, s: any) => sum + s.path.length, 0);
      writeFileSync(join(SEEDS_DIR, file), JSON.stringify(seed, null, 2));
      console.log(`  ✅ ${file}: solved in ${elapsed}ms, ${solution.length} paths, ${seed.par} cells`);
      passed++;
    } else {
      console.log(`  ❌ ${file}: NO SOLUTION (${elapsed}ms) — redesign needed`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed}/${seedFiles.length} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
