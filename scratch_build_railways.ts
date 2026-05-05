import { writeFileSync } from 'fs';

function buildRailway(gridSize: number, numColors: number) {
  const colors = ["red", "blue", "green", "yellow", "orange", "purple", "cyan", "pink", "brown", "white", "lime", "magenta", "teal", "gold", "navy"];
  const pairs = [];
  const solution = [];
  const walls = [];
  
  // Fill rows with colors
  for (let i = 0; i < numColors; i++) {
    const r = i;
    pairs.push({
      color: colors[i],
      start: [r, 0],
      end: [r, gridSize - 1]
    });
    
    const path = [];
    for (let c = 0; c < gridSize; c++) {
      path.push([r, c]);
    }
    solution.push({ color: colors[i], path });
  }

  // Fill remaining rows with walls
  for (let r = numColors; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      walls.push([r, c] as [number, number]);
    }
  }

  return {
    gridSize,
    globalIndex: 0,
    pairs,
    walls,
    mixers: [],
    teleports: [],
    locks: [],
    solution,
    difficultyScore: 0,
    difficultyLabel: "trivial",
    par: gridSize * numColors,
    estimatedSolveTime: 0,
    mechanics: ["wall"]
  };
}

// 7x7 with 6 colors
const g07 = buildRailway(7, 6);
g07.id = "g07_seed_001";
writeFileSync('src/seeds/g07_seed_001.json', JSON.stringify(g07, null, 2));

// 8x8 with 8 colors (Full grid!)
const g08 = buildRailway(8, 8);
g08.id = "g08_seed_001";
writeFileSync('src/seeds/g08_seed_001.json', JSON.stringify(g08, null, 2));

// 9x9 with 9 colors (Full grid!)
const g09 = buildRailway(9, 9);
g09.id = "g09_seed_001";
writeFileSync('src/seeds/g09_seed_001.json', JSON.stringify(g09, null, 2));

// 10x10 with 10 colors (Full grid!)
const g10 = buildRailway(10, 10);
g10.id = "g10_seed_001";
writeFileSync('src/seeds/g10_seed_001.json', JSON.stringify(g10, null, 2));

console.log("Updated seeds for 8x8, 9x9, and 10x10 (Full grid).");
