import { BacktrackingSolver } from './src/generator/steps/BuildSolution';
import { readFileSync } from 'fs';

async function test() {
  const solver = new BacktrackingSolver();
  
  // Test 7x7 (should pass)
  const s7 = JSON.parse(readFileSync('src/levels/grid_07/g07_001.json', 'utf8'));
  const c7 = solver.countSolutions(s7, 2);
  console.log(`g07_001 count: ${c7} (expected 1)`);

  // Test 8x8 (was failing with count=2)
  const s8 = JSON.parse(readFileSync('src/levels/grid_08/g08_001.json', 'utf8'));
  const c8 = solver.countSolutions(s8, 2);
  console.log(`g08_001 count: ${c8} (expected 1)`);
}

test();
