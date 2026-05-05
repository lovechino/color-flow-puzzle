import { UniquenessValidator } from './src/generator/steps/ValidateUnique';
import { BacktrackingSolver } from './src/generator/steps/BuildSolution';
import { writeFileSync } from 'fs';

const level = {
  gridSize: 7,
  pairs: [
    { color: "red", start: [0, 0], end: [3, 3] },
    { color: "blue", start: [0, 1], end: [0, 6] },
    { color: "green", start: [1, 0], end: [6, 0] },
    { color: "yellow", start: [2, 2], end: [5, 5] },
    { color: "orange", start: [1, 6], end: [6, 6] },
    { color: "purple", start: [6, 1], end: [6, 5] },
    { color: "cyan", start: [3, 2], end: [4, 4] }
  ],
  walls: []
};

const solver = new BacktrackingSolver();
const sol = solver.solve(level.gridSize, level.pairs as any, level.walls as any, 10000);
if (sol) {
  console.log("Found solution!");
  const validator = new UniquenessValidator();
  const count = validator.countSolutions({ ...level, solution: sol } as any, 2);
  console.log("Solution count:", count);
  if (count === 1) {
    writeFileSync('src/seeds/g07_seed_001.json', JSON.stringify({ ...level, solution: sol }, null, 2));
  }
} else {
  console.log("No solution");
}
