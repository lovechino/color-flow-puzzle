import { BacktrackingSolver } from './src/generator/steps/BuildSolution';
import { readFileSync } from 'fs';

async function test8x8() {
  const solver = new BacktrackingSolver();
  const seed = JSON.parse(readFileSync('src/seeds/g08_seed_001.json', 'utf8'));
  console.log("Testing 8x8 6-color seed...");
  
  const start = performance.now();
  const solution = solver.solve(seed.gridSize, seed.pairs, seed.walls, 10000);
  const end = performance.now();
  
  if (solution) {
    console.log(`✅ Solved in ${((end - start)/1000).toFixed(2)}s`);
  } else {
    console.log(`❌ Failed to solve in ${((end - start)/1000).toFixed(2)}s`);
  }

  console.log("Checking uniqueness...");
  const uStart = performance.now();
  const count = solver.countSolutions(seed, 2);
  const uEnd = performance.now();
  console.log(`Count: ${count} in ${((uEnd - uStart)/1000).toFixed(2)}s`);
}

test8x8();
