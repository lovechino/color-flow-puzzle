import { PuzzleGenerator } from './src/generator/PuzzleGenerator';
import { DifficultyScorer } from './src/generator/DifficultyScorer';

async function analyze() {
  const generator = new PuzzleGenerator();
  const scorer = new DifficultyScorer();
  const gridSize = 6;
  const colors = [4, 5, 6];
  
  for (const numColors of colors) {
    const scores: number[] = [];
    let success = 0;
    for (let i = 0; i < 50; i++) {
        const config = {
            gridSize,
            numColors,
            targetDifficulty: 100,
            mechanics: ['wall'] as any,
            seed: `test_6x6_${numColors}_${i}`,
        };
        const level = generator.generate(config);
        if (level) {
            success++;
            scores.push(scorer.score(level));
        }
    }
    const max = scores.length > 0 ? Math.max(...scores) : -Infinity;
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    console.log(`Grid 6x6 (${numColors} colors): Success: ${success}/50, Max: ${max}, Avg: ${avg.toFixed(2)}`);
  }
}

analyze();
