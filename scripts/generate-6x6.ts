/**
 * Generate missing levels for grid 6x6 using seed-based mutation
 * Run: npx tsx scripts/generate-6x6.ts
 */

import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';
import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import { DifficultyScorer } from '../src/generator/DifficultyScorer';
import { SeededRandom } from '../src/generator/SeededRandom';
import type { LevelData, Color } from '../src/types';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const LEVELS_DIR = join(process.cwd(), 'src', 'levels');

function loadExistingLevels(gridSize: number): LevelData[] {
  const gridDir = join(LEVELS_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  const levels: LevelData[] = [];
  try {
    const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        levels.push(JSON.parse(readFileSync(join(gridDir, file), 'utf8')));
      } catch {}
    }
  } catch {}
  return levels;
}

function mutateLevel(seedLevel: LevelData, rng: SeededRandom, mutationCount: number): LevelData | null {
  const gridSize = seedLevel.gridSize;
  let pairs = seedLevel.pairs.map(p => ({
    color: p.color as Color,
    start: [...p.start] as [number, number],
    end: [...p.end] as [number, number]
  }));

  for (let m = 0; m < mutationCount; m++) {
    const mutationType = rng.nextInt(3);

    if (mutationType === 0 && pairs.length >= 2) {
      const i = rng.nextInt(pairs.length);
      const j = (i + 1 + rng.nextInt(pairs.length - 1)) % pairs.length;
      const tmp = pairs[i].start;
      pairs[i].start = pairs[j].start;
      pairs[j].start = tmp;
    } else if (mutationType === 1) {
      const i = rng.nextInt(pairs.length);
      const dotIdx = rng.nextInt(2);
      const dot = dotIdx === 0 ? pairs[i].start : pairs[i].end;
      const dir = rng.nextInt(4);
      const dr = [0, 0, 1, -1][dir];
      const dc = [1, -1, 0, 0][dir];
      const nr = dot[0] + dr;
      const nc = dot[1] + dc;
      
      if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
        const occupied = new Set<string>();
        pairs.forEach((p, idx) => {
          if (idx === i) return;
          occupied.add(`${p.start[0]},${p.start[1]}`);
          occupied.add(`${p.end[0]},${p.end[1]}`);
        });
        
        if (!occupied.has(`${nr},${nc}`)) {
          if (dotIdx === 0) pairs[i].start = [nr, nc];
          else pairs[i].end = [nr, nc];
        }
      }
    } else if (pairs.length >= 2) {
      const i = rng.nextInt(pairs.length);
      const j = (i + 1 + rng.nextInt(pairs.length - 1)) % pairs.length;
      const tmp = pairs[i].color;
      pairs[i].color = pairs[j].color;
      pairs[j].color = tmp;
    }
  }

  const solver = new BacktrackingSolver();
  const solution = solver.solve(gridSize, pairs, []);
  if (!solution) return null;

  return {
    ...seedLevel,
    pairs,
    solution,
    difficultyScore: 0,
    difficultyLabel: 'trivial',
    par: solution.reduce((sum, s) => sum + s.path.length, 0),
  };
}

async function main() {
  console.log('🧬 Generating 6x6 levels from existing seeds...\n');
  
  const gridSize = 6;
  const targetCount = 18;
  
  const existingLevels = loadExistingLevels(gridSize);
  const existingIndices = new Set(existingLevels.map(l => l.globalIndex));
  
  console.log(`Grid ${gridSize}x${gridSize}: ${existingLevels.length} existing levels`);
  console.log(`Need to generate: ${targetCount - existingLevels.length} more\n`);

  const validator = new UniquenessValidator();
  const scorer = new DifficultyScorer();
  
  let generated = 0;
  let needed = targetCount - existingLevels.length;
  
  if (needed <= 0) {
    console.log('✅ Already have enough levels!');
    return;
  }

  let nextIndex = 1;
  while (existingIndices.has(nextIndex)) nextIndex++;

  for (const seedLevel of existingLevels) {
    if (generated >= needed) break;
    
    console.log(`\nUsing seed: ${seedLevel.id} → trying to generate...`);
    
    for (let mutationCount = 1; mutationCount <= 500; mutationCount++) {
      const rng = new SeededRandom(`mutate_${seedLevel.id}_${mutationCount}_${generated}`);
      
      const mutated = mutateLevel(seedLevel, rng, mutationCount);
      if (!mutated) continue;
      
      if (validator.countSolutions(mutated, 2) !== 1) continue;
      
      const score = scorer.score(mutated);
      mutated.difficultyScore = score;
      mutated.difficultyLabel = scorer.getLabel(score);
      mutated.estimatedSolveTime = Math.round(mutated.par * 1.5 + score * 0.5);
      mutated.id = `g06_${String(nextIndex).padStart(3, '0')}`;
      mutated.globalIndex = nextIndex;

      const gridDir = join(LEVELS_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
      const outputPath = join(gridDir, `${mutated.id}.json`);
      writeFileSync(outputPath, JSON.stringify(mutated, null, 2), 'utf8');
      
      console.log(`  ✅ Generated ${mutated.id}: score=${score} (${mutated.difficultyLabel}), mutations=${mutationCount}`);
      
      existingIndices.add(nextIndex);
      nextIndex++;
      generated++;
      
      if (generated >= needed) break;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Generated: ${generated}/${needed} new levels`);
  
  if (generated >= needed) {
    console.log('🎉 All 6x6 levels generated successfully!');
  } else {
    console.log(`⚠️  Only generated ${generated}, need ${needed}`);
    console.log(`   Consider running again with more attempts or hand-crafting remaining levels`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
