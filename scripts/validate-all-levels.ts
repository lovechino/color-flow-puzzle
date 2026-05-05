import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';

const LEVELS_DIR = join(process.cwd(), 'src', 'levels');

function validateLevel(filePath: string): { valid: boolean; reason?: string } {
  try {
    const content = readFileSync(filePath, 'utf8');
    const level = JSON.parse(content);
    
    // Basic structure check
    if (!level.id || !level.gridSize || !level.pairs || !level.solution) {
      return { valid: false, reason: 'Missing required fields' };
    }
    
    // Check solution count
    const solver = new BacktrackingSolver();
    const solutionCount = solver.countSolutions(level, 2);
    if (solutionCount !== 1) {
      return { valid: false, reason: `Invalid solution count: ${solutionCount}` };
    }
    
    // Check that all dots are connected in solution
    const filledCells = new Set<string>();
    for (const path of level.solution) {
      for (const [r, c] of path.path) {
        filledCells.add(`${r},${c}`);
      }
    }
    
    const dotCells = new Set<string>();
    for (const pair of level.pairs) {
      dotCells.add(`${pair.start[0]},${pair.start[1]}`);
      dotCells.add(`${pair.end[0]},${pair.end[1]}`);
    }
    
    // All dots should be in filled cells
    for (const dot of dotCells) {
      if (!filledCells.has(dot)) {
        return { valid: false, reason: `Dot not connected in solution: ${dot}` };
      }
    }
    
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `Parse error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function validateGridSize(gridSize: number): void {
  const gridDir = join(LEVELS_DIR, `grid_${String(gridSize).padStart(2, '0')}`);
  
  try {
    const files = readdirSync(gridDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/_(\d+)\.json$/)![1], 10);
        const numB = parseInt(b.match(/_(\d+)\.json$/)![1], 10);
        return numA - numB;
      });
    
    let validCount = 0;
    let invalidCount = 0;
    
    console.log(`🔍 Validating grid ${gridSize}×${gridSize} (${files.length} levels)...`);
    
    for (const file of files) {
      const result = validateLevel(join(gridDir, file));
      if (result.valid) {
        validCount++;
      } else {
        invalidCount++;
        console.log(`  ❌ ${file}: ${result.reason}`);
      }
    }
    
    console.log(`  ✅ Valid: ${validCount}/${files.length}`);
    if (invalidCount > 0) {
      console.log(`  ❌ Invalid: ${invalidCount}/${files.length}`);
    }
    
  } catch (err) {
    console.log(`⚠️  Could not read grid ${gridSize}×${gridSize}: ${err}`);
  }
}

function main(): void {
  console.log('🔍 Starting level validation...\n');
  
  for (let size = 3; size <= 20; size++) {
    validateGridSize(size);
  }
  
  console.log('\n🎉 Validation complete!');
}

main();