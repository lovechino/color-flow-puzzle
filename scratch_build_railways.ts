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

// Generate seeds for grids 7 to 20
for (let size = 7; size <= 20; size++) {
  const numColors = Math.min(size, 15); // Cap at 15 colors
  const seed = buildRailway(size, numColors);
  seed.id = `g${String(size).padStart(2, '0')}_seed_001`;
  writeFileSync(`src/seeds/g${String(size).padStart(2, '0')}_seed_001.json`, JSON.stringify(seed, null, 2));
}

console.log("Updated all seeds from 7x7 to 20x20.");
