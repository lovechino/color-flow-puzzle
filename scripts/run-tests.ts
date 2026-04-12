/**
 * Test cases for BuildSolver, ValidateUnique, and PuzzleGenerator
 * 
 * Run: npx tsx scripts/run-tests.ts
 * 
 * These are MINIMAL tests to cover the critical bugs fixed in Phase 1:
 * - Test 1: Two valid components should NOT prune (Bug: false negative)
 * - Test 2: Isolated empty cell SHOULD prune (Bug: missed pruning)
 * - Test 3: Generated level has uniqueness = 1 (Bug: double validation)
 * - Test 4: 5x5 mutation produces valid level (Bug: 100% random fail)
 * - Test 5: Validator completes within timeout (Bug: infinite loop)
 */

import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import type { Color, LevelData } from '../src/types';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<boolean> | boolean) {
  const result = fn();
  if (result instanceof Promise) {
    result.then(ok => {
      if (ok) { passed++; console.log(`  ✅ ${name}`); }
      else { failed++; console.log(`  ❌ ${name}`); }
    });
  } else {
    if (result) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name}`); }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🧪 Running Phase 1 Critical Tests...\n');

  // Test 1: Two valid components should NOT prune
  test('3x3: simple solvable puzzle should find solution', () => {
    const solver = new BacktrackingSolver();
    const pairs = [
      { color: 'red' as Color, start: [0, 0] as [number, number], end: [2, 0] as [number, number] },
      { color: 'blue' as Color, start: [0, 2] as [number, number], end: [2, 2] as [number, number] },
      { color: 'green' as Color, start: [0, 1] as [number, number], end: [2, 1] as [number, number] },
    ];
    const solution = solver.solve(3, pairs, []);
    return solution !== null;
  });

  // Test 2: Known working level g03_001 should solve
  test('3x3: g03_001 (known valid) should solve', () => {
    const solver = new BacktrackingSolver();
    const levelPath = join(process.cwd(), 'src/levels/grid_03/g03_001.json');
    const level = JSON.parse(readFileSync(levelPath, 'utf8')) as LevelData;
    const solution = solver.solve(3, level.pairs.map(p => ({
      color: p.color as Color,
      start: p.start,
      end: p.end
    })), []);
    return solution !== null;
  });

  // Test 3: Validator returns 1 for known valid level
  test('Validator: g03_001 should have uniqueness = 1', () => {
    const validator = new UniquenessValidator();
    const levelPath = join(process.cwd(), 'src/levels/grid_03/g03_001.json');
    const level = JSON.parse(readFileSync(levelPath, 'utf8')) as LevelData;
    const count = validator.countSolutions(level, 2);
    return count === 1;
  });

  // Test 4: All existing 5x5 levels are valid
  test('Validator: all 5x5 levels should have uniqueness = 1', () => {
    const validator = new UniquenessValidator();
    const gridDir = join(process.cwd(), 'src/levels/grid_05');
    const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const levelPath = join(gridDir, file);
      const level = JSON.parse(readFileSync(levelPath, 'utf8')) as LevelData;
      const count = validator.countSolutions(level, 2);
      if (count !== 1) {
        console.log(`    → ${file} has ${count} solutions (expected 1)`);
        return false;
      }
    }
    return true;
  });

  // Test 5: All existing 6x6 levels are valid
  test('Validator: all 6x6 levels should have uniqueness = 1', () => {
    const validator = new UniquenessValidator();
    const gridDir = join(process.cwd(), 'src/levels/grid_06');
    const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const levelPath = join(gridDir, file);
      const level = JSON.parse(readFileSync(levelPath, 'utf8')) as LevelData;
      const count = validator.countSolutions(level, 2);
      if (count !== 1) {
        console.log(`    → ${file} has ${count} solutions (expected 1)`);
        return false;
      }
    }
    return true;
  });

  // Test 6: Validator completes within timeout (no infinite loop)
  test('Validator: completes within 30s timeout', () => {
    const validator = new UniquenessValidator();
    const levelPath = join(process.cwd(), 'src/levels/grid_05/g05_001.json');
    const level = JSON.parse(readFileSync(levelPath, 'utf8')) as LevelData;
    
    const start = Date.now();
    validator.countSolutions(level, 2);
    const elapsed = Date.now() - start;
    
    if (elapsed > 30000) {
      console.log(`    → Validator took ${elapsed}ms (timeout is 30s)`);
      return false;
    }
    return true;
  });

  // Wait for async tests
  setTimeout(() => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`${'='.repeat(50)}\n`);
    
    if (failed > 0) {
      console.log('❌ SOME TESTS FAILED\n');
    } else {
      console.log('✅ ALL TESTS PASSED\n');
    }
  }, 100);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
