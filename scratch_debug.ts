import { PuzzleGenerator } from './src/generator/PuzzleGenerator';
import { SeededRandom } from './src/generator/SeededRandom';
import { placeDots } from './src/generator/steps/PlaceDots';
import { BacktrackingSolver } from './src/generator/steps/BuildSolution';

async function analyze() {
  const generator = new PuzzleGenerator();
  const solver = new BacktrackingSolver();
  const rng = new SeededRandom('debug_6x6');
  const gridSize = 6;
  const numColors = 4;
  
  console.log('--- PlaceDots Test ---');
  let dotsSuccess = 0;
  for (let i = 0; i < 100; i++) {
    const pairs = placeDots(gridSize, numColors, rng, {
        minManhattanDistance: 2,
        avoidCorners: true
    });
    if (pairs) dotsSuccess++;
  }
  console.log(`PlaceDots: ${dotsSuccess}/100`);

  if (dotsSuccess > 0) {
    console.log('--- Solver Test ---');
    let solveSuccess = 0;
    const start = Date.now();
    for (let i = 0; i < 20; i++) {
        const pairs = placeDots(gridSize, numColors, rng, {
            minManhattanDistance: 2,
            avoidCorners: true
        });
        if (pairs) {
            const sol = solver.solve(gridSize, pairs);
            if (sol) solveSuccess++;
        }
    }
    console.log(`Solver: ${solveSuccess}/20 in ${Date.now() - start}ms`);
  }
}

analyze();
