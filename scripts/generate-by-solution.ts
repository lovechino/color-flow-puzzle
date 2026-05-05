import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Generate a valid 9x9 level by creating solution first
function generate9x9BySolution(): any {
  const gridSize = 9;
  const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
  const pairs: any[] = [];
  const solution: any[] = [];

  // Create a snake pattern that fills the entire grid
  // Snake: row 0 left->right, row 1 right->left, row 2 left->right, etc.
  const snakePath: [number, number][] = [];
  for (let r = 0; r < gridSize; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < gridSize; c++) snakePath.push([r, c]);
    } else {
      for (let c = gridSize - 1; c >= 0; c--) snakePath.push([r, c]);
    }
  }

  // Divide snake into 6 segments (one per color)
  const cellsPerSegment = Math.floor(snakePath.length / colors.length);

  for (let i = 0; i < colors.length; i++) {
    const startIdx = i * cellsPerSegment;
    const endIdx = (i === colors.length - 1) ? snakePath.length - 1 : (i + 1) * cellsPerSegment - 1;

    const color = colors[i];
    const start = snakePath[startIdx];
    const end = snakePath[endIdx];
    const path = snakePath.slice(startIdx, endIdx + 1);

    pairs.push({ color, start, end });
    solution.push({ color, path });
  }

  return {
    id: 'g09_001',
    gridSize: 9,
    globalIndex: 1,
    pairs,
    walls: [],
    mixers: [],
    teleports: [],
    locks: [],
    solution,
    difficultyScore: 15,
    difficultyLabel: 'easy',
    par: solution.reduce((sum: number, s: any) => sum + s.path.length, 0),
    estimatedSolveTime: 45,
    mechanics: []
  };
}

const level = generate9x9BySolution();
const gridDir = join(process.cwd(), 'src', 'levels', 'grid_09');
if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });
writeFileSync(join(gridDir, 'g09_001.json'), JSON.stringify(level, null, 2));
console.log('Created 9x9 level with valid solution, par:', level.par);
