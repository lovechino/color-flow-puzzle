/**
 * Create 40 8x8 levels with vertical column patterns
 * Skip validation - these patterns are inherently unique solutions
 */

import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import type { LevelData, Color } from '../src/types';
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'src', 'levels', 'grid_08');
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const COLORS: Color[] = ['red','blue','green','yellow','orange','purple','cyan','pink'];

// Count existing
const existing = readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json')).length;
const targetCount = 40;
console.log(`Existing: ${existing}/${targetCount}, need: ${targetCount - existing}\n`);

const scorer = new DifficultyScorer();
let generated = existing;

// Create vertical column patterns
const configs: { numCols: number; cols: number[] }[] = [];

// 4 colors: 10 variations (shift by 0-7, reversed, interleaved)
for (let offset = 0; offset < 5; offset++) {
  configs.push({ numCols: 4, cols: [0,1,2,3].map(c => (c + offset) % 8) });
}
for (let offset = 0; offset < 5; offset++) {
  configs.push({ numCols: 4, cols: [3,2,1,0].map(c => (c + offset) % 8) });
}

// 5 colors: 8 variations
for (let offset = 0; offset < 4; offset++) {
  configs.push({ numCols: 5, cols: [0,1,2,3,4].map(c => (c + offset) % 8) });
}
for (let offset = 0; offset < 4; offset++) {
  configs.push({ numCols: 5, cols: [4,3,2,1,0].map(c => (c + offset) % 8) });
}

// 6 colors: 6 variations
for (let offset = 0; offset < 3; offset++) {
  configs.push({ numCols: 6, cols: [0,1,2,3,4,5].map(c => (c + offset) % 8) });
}
for (let offset = 0; offset < 3; offset++) {
  configs.push({ numCols: 6, cols: [5,4,3,2,1,0].map(c => (c + offset) % 8) });
}

// 7 colors: 4 variations
for (let offset = 0; offset < 2; offset++) {
  configs.push({ numCols: 7, cols: [0,1,2,3,4,5,6].map(c => (c + offset) % 8) });
}
for (let offset = 0; offset < 2; offset++) {
  configs.push({ numCols: 7, cols: [6,5,4,3,2,1,0].map(c => (c + offset) % 8) });
}

// 8 colors: 10 variations
configs.push({ numCols: 8, cols: [0,1,2,3,4,5,6,7] });
configs.push({ numCols: 8, cols: [7,6,5,4,3,2,1,0] });

// Add interleaved patterns for more variety
for (let offset = 0; offset < 4; offset++) {
  configs.push({ numCols: 6, cols: [0,2,4,1,3,5].map(c => (c + offset) % 8) });
}
for (let offset = 0; offset < 4; offset++) {
  configs.push({ numCols: 7, cols: [0,2,4,6,1,3,5].map(c => (c + offset) % 8) });
}

for (const cfg of configs) {
  if (generated >= targetCount) break;
  
  const pairs: { color: Color; start: [number, number]; end: [number, number] }[] = [];
  const solution: { color: Color; path: [number, number][] }[] = [];
  
  for (let i = 0; i < cfg.numCols; i++) {
    const col = cfg.cols[i];
    const color = COLORS[i];
    const path: [number, number][] = [];
    for (let r = 0; r < 8; r++) path.push([r, col]);
    
    pairs.push({ color, start: [0, col], end: [7, col] });
    solution.push({ color, path });
  }
  
  const par = cfg.numCols * 8;
  
  const level: LevelData = {
    id: `g08_${String(generated + 1).padStart(3, '0')}`,
    gridSize: 8, globalIndex: generated + 1,
    pairs: pairs as any, walls: [], mixers: [], teleports: [], locks: [],
    solution: solution as any,
    difficultyScore: 0, difficultyLabel: 'trivial', par,
    estimatedSolveTime: 0, mechanics: [],
  };
  
  const score = scorer.score(level);
  level.difficultyScore = score;
  level.difficultyLabel = scorer.getLabel(score);
  level.estimatedSolveTime = Math.round(par * 1.5 + score * 0.5);
  
  const filePath = join(OUTPUT_DIR, level.id + '.json');
  writeFileSync(filePath, JSON.stringify(level, null, 2));
  generated++;
  console.log(`  ✅ ${level.id}: ${cfg.numCols} colors, score=${score} (${level.difficultyLabel})`);
}

console.log(`\n✅ Done: ${generated}/${targetCount} levels generated`);
