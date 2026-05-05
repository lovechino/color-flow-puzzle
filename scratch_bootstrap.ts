import { PuzzleGenerator } from './src/generator/PuzzleGenerator';
import { writeFileSync } from 'fs';

async function bootstrapSeed() {
  console.log("Attempting to bootstrap 7x7 with 7 colors...");
  for (let attempt = 0; attempt < 500; attempt++) {
    const level = PuzzleGenerator.bootstrap(7, 7, 50, ['wall'], attempt);
    if (level) {
      console.log(`✅ Success on attempt ${attempt}!`);
      level.id = "g07_seed_001";
      level.globalIndex = 0;
      writeFileSync('src/seeds/g07_seed_001.json', JSON.stringify(level, null, 2));
      return;
    }
    if (attempt % 10 === 0) process.stdout.write(".");
  }
  console.log("❌ Failed to bootstrap seed");
}

bootstrapSeed();
