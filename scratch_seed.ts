import { PuzzleGenerator } from './src/generator/PuzzleGenerator';
import { writeFileSync } from 'fs';

async function generateSeed() {
  const generator = new PuzzleGenerator();
  console.log("Attempting to generate 7x7 with 6 colors...");
  const level = generator.generateWithFallback({
    gridSize: 7,
    numColors: 6,
    targetDifficulty: 30,
    mechanics: ['wall'],
    seed: "debug_seed"
  }).level;
  
  if (level) {
    console.log(`✅ Success!`);
    level.id = "g07_seed_001";
    writeFileSync('src/seeds/g07_seed_001.json', JSON.stringify(level, null, 2));
  } else {
    console.log("❌ Failed");
  }
}

generateSeed();
