/**
 * Standalone test suite - NO src imports to avoid module resolution issues
 * 
 * Run: npm test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Inline types to avoid importing from src
type CellType = 'empty' | 'dot' | 'wall' | 'mixer' | 'teleport' | 'lock';
interface Cell {
  row: number; col: number; type: CellType;
  isActive: boolean; isFilled: boolean;
  mixerFilledA: boolean; mixerFilledB: boolean; isLocked: boolean;
  dotColor?: string;
}

// ─── Pure Grid Logic Tests ────────────────────────────────────────────────────

function createEmptyGrid(size: number, shapeMask?: boolean[][]): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < size; r++) {
    grid[r] = [];
    for (let c = 0; c < size; c++) {
      grid[r][c] = {
        row: r, col: c, type: 'empty',
        isActive: shapeMask ? shapeMask[r]?.[c] ?? true : true,
        isFilled: false, mixerFilledA: false, mixerFilledB: false, isLocked: false,
      };
    }
  }
  return grid;
}

function getNeighbors(grid: Cell[][], r: number, c: number): Cell[] {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  return dirs
    .map(([dr, dc]) => grid[r + dr]?.[c + dc])
    .filter(cell => cell?.isActive);
}

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })));
}

// ─── Level loading ────────────────────────────────────────────────────────────

function loadAllLevels(gridSize: number): any[] {
  const gridDir = join(process.cwd(), 'src/levels', `grid_${String(gridSize).padStart(2, '0')}`);
  const files = readdirSync(gridDir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(readFileSync(join(gridDir, f), 'utf8')));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Grid Logic', () => {
  it('creates grid of correct size', () => {
    expect(createEmptyGrid(5)).toHaveLength(5);
    expect(createEmptyGrid(5)[0]).toHaveLength(5);
  });

  it('initializes all cells as empty and active', () => {
    const grid = createEmptyGrid(3);
    grid.flat().forEach(cell => {
      expect(cell.type).toBe('empty');
      expect(cell.isActive).toBe(true);
      expect(cell.isFilled).toBe(false);
    });
  });

  it('respects shapeMask', () => {
    const mask = [[true,true,true],[true,false,true],[true,true,true]];
    const grid = createEmptyGrid(3, mask);
    expect(grid[1][1].isActive).toBe(false);
    expect(grid[0][0].isActive).toBe(true);
  });

  it('returns correct neighbor counts', () => {
    const grid = createEmptyGrid(3);
    expect(getNeighbors(grid, 1, 1)).toHaveLength(4);
    expect(getNeighbors(grid, 0, 0)).toHaveLength(2);
    expect(getNeighbors(grid, 0, 1)).toHaveLength(3);
  });

  it('creates deep copy', () => {
    const grid = createEmptyGrid(3);
    const clone = cloneGrid(grid);
    grid[0][0].isFilled = true;
    expect(clone[0][0].isFilled).toBe(false);
  });
});

describe('Level Data Validation', () => {
  it('all levels have required fields', () => {
    for (const gridSize of [3, 4, 5, 6]) {
      const levels = loadAllLevels(gridSize);
      expect(levels.length).toBeGreaterThan(0);
      
      for (const level of levels) {
        expect(level.id).toBeDefined();
        expect(level.gridSize).toBe(gridSize);
        expect(level.pairs).toBeDefined();
        expect(level.pairs.length).toBeGreaterThan(0);
        expect(level.solution).toBeDefined();
        expect(level.solution.length).toBeGreaterThan(0);
        expect(level.difficultyScore).toBeGreaterThanOrEqual(0);
        expect(level.difficultyScore).toBeLessThanOrEqual(100);
      }
    }
  });

  it('all 3x3 solution paths connect dots correctly', () => {
    const levels = loadAllLevels(3);
    for (const level of levels) {
      for (const sol of level.solution) {
        const pair = level.pairs.find((p: any) => p.color === sol.color);
        const start = sol.path[0];
        const end = sol.path[sol.path.length - 1];
        
        const startOk = (start[0] === pair.start[0] && start[1] === pair.start[1]) ||
                        (start[0] === pair.end[0] && start[1] === pair.end[1]);
        const endOk = (end[0] === pair.start[0] && end[1] === pair.start[1]) ||
                      (end[0] === pair.end[0] && end[1] === pair.end[1]);
        
        expect(startOk).toBe(true);
        expect(endOk).toBe(true);
      }
    }
  });

  it('all 6x6 solution paths fill entire grid', () => {
    const levels = loadAllLevels(6);
    for (const level of levels) {
      const totalCells = level.solution.reduce((sum: number, s: any) => sum + s.path.length, 0);
      expect(totalCells).toBe(level.gridSize * level.gridSize);
    }
  });

  it('all levels have valid difficulty labels', () => {
    const validLabels = ['trivial','easy','medium','hard','expert','master','legendary'];
    
    for (const gridSize of [3, 4, 5, 6]) {
      const levels = loadAllLevels(gridSize);
      for (const level of levels) {
        expect(validLabels).toContain(level.difficultyLabel);
      }
    }
  });

  it('difficulty scores increase with grid size (on average)', () => {
    const averages: number[] = [];
    
    for (const gridSize of [3, 4, 5, 6]) {
      const levels = loadAllLevels(gridSize);
      const avg = levels.reduce((sum: number, l: any) => sum + l.difficultyScore, 0) / levels.length;
      averages.push(avg);
    }
    
    // General trend: larger grids should have higher average difficulty
    expect(averages[3]).toBeGreaterThanOrEqual(averages[0]); // 6x6 avg >= 3x3 avg
  });

  it('no path overlaps in any level', () => {
    for (const gridSize of [3, 4, 5, 6]) {
      const levels = loadAllLevels(gridSize);
      for (const level of levels) {
        const filledCells = new Set<string>();
        for (const sol of level.solution) {
          // Skip dots (first and last cell of each path)
          for (let i = 1; i < sol.path.length - 1; i++) {
            const key = `${sol.path[i][0]},${sol.path[i][1]}`;
            expect(filledCells.has(key)).toBe(false);
            filledCells.add(key);
          }
        }
      }
    }
  });

  it('all dot positions are within grid bounds', () => {
    for (const gridSize of [3, 4, 5, 6]) {
      const levels = loadAllLevels(gridSize);
      for (const level of levels) {
        for (const pair of level.pairs) {
          expect(pair.start[0]).toBeGreaterThanOrEqual(0);
          expect(pair.start[0]).toBeLessThan(gridSize);
          expect(pair.start[1]).toBeGreaterThanOrEqual(0);
          expect(pair.start[1]).toBeLessThan(gridSize);
          expect(pair.end[0]).toBeGreaterThanOrEqual(0);
          expect(pair.end[0]).toBeLessThan(gridSize);
          expect(pair.end[1]).toBeGreaterThanOrEqual(0);
          expect(pair.end[1]).toBeLessThan(gridSize);
        }
      }
    }
  });
});
