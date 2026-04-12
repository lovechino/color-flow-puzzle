/**
 * Utility: Verify that a saved level JSON file is valid
 * 
 * Usage:
 *   npx tsx scripts/verify-level.ts src/levels/grid_05/g05_001.json
 *   npx tsx scripts/verify-level.ts --all  # verify all levels
 */

import { UniquenessValidator } from '../src/generator/steps/ValidateUnique';
import type { Color, LevelData } from '../src/types';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

function verifyLevel(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    const level = JSON.parse(readFileSync(filePath, 'utf8')) as LevelData;
    
    // 1. Check required fields
    if (!level.id) errors.push('Missing id');
    if (!level.gridSize) errors.push('Missing gridSize');
    if (!level.pairs || level.pairs.length === 0) errors.push('Missing or empty pairs');
    if (!level.solution || level.solution.length === 0) errors.push('Missing or empty solution');
    
    if (errors.length > 0) return { valid: false, errors };
    
    // 2. Verify pairs match solution colors
    const pairColors = new Map(level.pairs.map(p => [p.color, p]));
    const solutionColors = new Map(level.solution.map(s => [s.color, s]));
    
    for (const [color, pair] of pairColors) {
      if (!solutionColors.has(color)) {
        errors.push(`Pair ${color} has no solution path`);
      }
      const sol = solutionColors.get(color)!;
      const pathStart = sol.path[0];
      const pathEnd = sol.path[sol.path.length - 1];
      const isStartMatch = (pathStart[0] === pair.start[0] && pathStart[1] === pair.start[1]) ||
                           (pathEnd[0] === pair.start[0] && pathEnd[1] === pair.start[1]);
      const isEndMatch = (pathStart[0] === pair.end[0] && pathStart[1] === pair.end[1]) ||
                         (pathEnd[0] === pair.end[0] && pathEnd[1] === pair.end[1]);
      if (!isStartMatch || !isEndMatch) {
        errors.push(`Solution ${color} doesn't connect start/end dots`);
      }
    }
    
    // 3. Replay solution on grid and check all cells filled
    const grid: (Color | null)[][] = Array.from(
      { length: level.gridSize },
      () => Array(level.gridSize).fill(null)
    );
    
    // Place dots
    for (const pair of level.pairs) {
      grid[pair.start[0]][pair.start[1]] = pair.color as Color;
      grid[pair.end[0]][pair.end[1]] = pair.color as Color;
    }
    
    // Place walls
    for (const [r, c] of level.walls || []) {
      grid[r][c] = 'WALL' as Color;
    }
    
    // Replay paths
    for (const sol of level.solution) {
      for (let i = 1; i < sol.path.length - 1; i++) {
        const [r, c] = sol.path[i];
        if (grid[r][c] !== null && (grid[r][c] as string) !== 'WALL') {
          errors.push(`Path overlap at (${r},${c}) for ${sol.color}`);
        }
        grid[r][c] = sol.color as Color;
      }
    }
    
    // Check all cells filled
    for (let r = 0; r < level.gridSize; r++) {
      for (let c = 0; c < level.gridSize; c++) {
        if (grid[r][c] === null) {
          errors.push(`Empty cell at (${r},${c})`);
        }
      }
    }
    
    // 4. Verify uniqueness (only if no structural errors)
    if (errors.length === 0) {
      const validator = new UniquenessValidator();
      const count = validator.countSolutions(level, 2);
      if (count !== 1) {
        errors.push(`Solution count = ${count} (expected 1)`);
      }
    }
    
  } catch (err) {
    errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  return { valid: errors.length === 0, errors };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    console.log('🔍 Verifying ALL levels...\n');
    
    let total = 0, valid = 0, invalid = 0;
    
    for (let gridSize = 3; gridSize <= 6; gridSize++) {
      const gridDir = join(process.cwd(), 'src/levels', `grid_${String(gridSize).padStart(2, '0')}`);
      if (!existsSync(gridDir)) continue;
      
      const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
      console.log(`Grid ${gridSize}x${gridSize} (${files.length} levels):`);
      
      for (const file of files) {
        const filePath = join(gridDir, file);
        const result = verifyLevel(filePath);
        total++;
        
        if (result.valid) {
          valid++;
          console.log(`  ✅ ${file}`);
        } else {
          invalid++;
          console.log(`  ❌ ${file}: ${result.errors.join(', ')}`);
        }
      }
      console.log('');
    }
    
    console.log(`${'='.repeat(50)}`);
    console.log(`Total: ${total} | Valid: ${valid} | Invalid: ${invalid}`);
    console.log(`${'='.repeat(50)}\n`);
    
    if (invalid > 0) process.exit(1);
    
  } else if (args[0]) {
    const filePath = args[0];
    console.log(`🔍 Verifying: ${filePath}\n`);
    const result = verifyLevel(filePath);
    
    if (result.valid) {
      console.log('✅ Level is valid\n');
    } else {
      console.log('❌ Level has errors:');
      for (const err of result.errors) {
        console.log(`   - ${err}`);
      }
      console.log('');
      process.exit(1);
    }
    
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/verify-level.ts <path-to-level.json>');
    console.log('  npx tsx scripts/verify-level.ts --all');
  }
}

main();
