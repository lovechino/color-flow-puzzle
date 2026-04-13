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

// Sort seeds by grid size — verify small ones first
function sortByGridSize(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const aMatch = a.match(/g(\d+)_/);
    const bMatch = b.match(/g(\d+)_/);
    const aSize = aMatch ? parseInt(aMatch[1]) : 99;
    const bSize = bMatch ? parseInt(bMatch[1]) : 99;
    return aSize - bSize;
  });
}

async function main(): Promise<void> {
  const seedFiles = readdirSync(SEEDS_DIR).filter(f => f.endsWith('.json'));
  if (seedFiles.length === 0) {
    console.log('❌ No seed files found in src/seeds/');
    return;
  }

  const sortedFiles = sortByGridSize(seedFiles);

  console.log('=== Seed Verification ===\n');
  console.log(`Found ${sortedFiles.length} seeds. Verifying smallest first...\n`);
  console.log('💡 Press Ctrl+C at any time to stop. Progress is saved.\n');

  let passed = 0;
  let failed = 0;

  for (const file of sortedFiles) {
    const seed = JSON.parse(readFileSync(join(SEEDS_DIR, file), 'utf8'));
    const gridSize = seed.gridSize;

    // Skip if already has solution
    if (Array.isArray(seed.solution) && seed.solution.length > 0) {
      console.log(`  ⏭️  ${file}: already verified, skipping`);
      passed++;
      continue;
    }

    console.log(`  🔄 ${file} (${gridSize}×${gridSize}, ${seed.pairs.length} colors)...`);
    process.stdout.write('     Solving... ');

    const solver = new BacktrackingSolver();
    const start = Date.now();

    try {
      const solution = solver.solve(gridSize, seed.pairs, seed.walls ?? []);
      const elapsed = Date.now() - start;

      if (solution) {
        seed.solution = solution;
        seed.par = solution.reduce((sum: number, s: any) => sum + s.path.length, 0);
        writeFileSync(join(SEEDS_DIR, file), JSON.stringify(seed, null, 2));
        console.log(`✅ solved in ${(elapsed/1000).toFixed(1)}s (${solution.length} paths, ${seed.par} cells)`);
        passed++;
      } else {
        console.log(`❌ NO SOLUTION (${(elapsed/1000).toFixed(1)}s) — redesign needed`);
        failed++;
      }
    } catch (err) {
      const elapsed = Date.now() - start;
      console.log(`❌ ERROR: ${err} (${(elapsed/1000).toFixed(1)}s)`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
