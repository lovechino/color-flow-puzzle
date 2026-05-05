import { BacktrackingSolver } from './src/generator/steps/BuildSolution';
import { readFileSync } from 'fs';

async function testSeed() {
  const solver = new BacktrackingSolver();
  const seed = JSON.parse(readFileSync('src/seeds/g07_seed_001.json', 'utf8'));
  console.log("Checking uniqueness of 7x7 6-color railway seed...");
  
  const count = solver.countSolutions(seed, 5);
  console.log(`Solution count: ${count}`);
}

testSeed();
