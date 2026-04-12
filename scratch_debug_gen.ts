import { PuzzleGenerator } from './src/generator/PuzzleGenerator';
import { DifficultyScorer } from './src/generator/DifficultyScorer';
import { UniquenessValidator } from './src/generator/steps/ValidateUnique';

async function debugGen() {
  const generator = new PuzzleGenerator();
  const scorer = new DifficultyScorer();
  const validator = new UniquenessValidator();

  const config = {
    gridSize: 3,
    numColors: 3,
    targetDifficulty: 50,
    mechanics: [],
    seed: "debug_seed_1"
  };

  console.log("Attempting to generate 3x3 with 3 colors...");
  for (let i = 0; i < 100; i++) {
    config.seed = `debug_seed_${i}`;
    const level = generator.generate(config);
    if (level) {
      console.log(`✅ Success on attempt ${i}!`);
      console.log(JSON.stringify(level, null, 2));
      return;
    } else {
        if (i % 10 === 0) process.stdout.write(".");
    }
  }
  console.log("\n❌ Failed to generate level after 100 attempts.");
}

debugGen();
