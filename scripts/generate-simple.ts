import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Simple level generator for 9x9 - creates paths using BFS
function generateSimple9x9(): any {
  const gridSize = 9;
  const colors: any = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];
  const pairs: any[] = [];
  const solution: any[] = [];
  
  // Create simple vertical paths
  // Each color gets a column (0-5), path goes from top to bottom
  for (let i = 0; i < 6; i++) {
    const color = colors[i];
    const col = i;
    const path = [];
    
    // Start at top
    const startR = 0, startC = col;
    const endR = 8, endC = col;
    
    // Create path: go down vertically
    for (let r = startR; r <= endR; r++) {
      path.push([r, col]);
    }
    
    pairs.push({ color, start: [startR, startC], end: [endR, endC] });
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
    difficultyScore: 10,
    difficultyLabel: 'trivial',
    par: solution.reduce((sum: number, s: any) => sum + s.path.length, 0),
    estimatedSolveTime: 30,
    mechanics: []
  };
}

const level = generateSimple9x9();
const gridDir = join(process.cwd(), 'src', 'levels', 'grid_09');
if (!existsSync(gridDir)) mkdirSync(gridDir, { recursive: true });
writeFileSync(join(gridDir, 'g09_001.json'), JSON.stringify(level, null, 2));
console.log('Created simple 9x9 level:', level.id);
