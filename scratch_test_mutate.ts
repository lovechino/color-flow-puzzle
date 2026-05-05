import { PuzzleGenerator } from './src/generator/PuzzleGenerator';
import { readFileSync } from 'fs';

async function testMutate() {
  const seed = JSON.parse(readFileSync('src/seeds/g07_seed_001.json', 'utf8'));
  console.log("Testing mutation with difficulty target 60...");
  
  const start = Date.now();
  // mutationCount > 0 to trigger actual change
  const mutated = PuzzleGenerator.mutate(seed, 5, 60);
  const end = Date.now();
  
  if (mutated) {
    console.log(`✅ Success in ${(end - start)/1000}s!`);
    console.log("Walls placed:", mutated.walls.length);
    console.log("Difficulty Score:", mutated.difficultyScore);
  } else {
    console.log(`❌ Failed in ${(end - start)/1000}s`);
  }
}

testMutate();
