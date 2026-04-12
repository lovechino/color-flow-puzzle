import type { Cell, LevelData } from '../types';

export function createEmptyGrid(size: number, shapeMask?: boolean[][]): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < size; r++) {
    grid[r] = [];
    for (let c = 0; c < size; c++) {
      grid[r][c] = {
        row: r,
        col: c,
        type: 'empty',
        isActive: shapeMask ? shapeMask[r]?.[c] ?? true : true,
        isFilled: false,
        mixerFilledA: false,
        mixerFilledB: false,
        isLocked: false,
      };
    }
  }
  return grid;
}

export function populateGridFromLevel(grid: Cell[][], level: LevelData): void {
  for (const pair of level.pairs) {
    const [sr, sc] = pair.start;
    const [er, ec] = pair.end;
    grid[sr][sc] = { ...grid[sr][sc], type: 'dot', dotColor: pair.color };
    grid[er][ec] = { ...grid[er][ec], type: 'dot', dotColor: pair.color };
  }

  for (const [r, c] of level.walls) {
    grid[r][c] = { ...grid[r][c], type: 'wall' };
  }

  for (const mixer of level.mixers) {
    const [r, c] = mixer.pos;
    grid[r][c] = {
      ...grid[r][c],
      type: 'mixer',
      mixerInputA: mixer.inputA,
      mixerInputB: mixer.inputB,
      mixerOutput: mixer.output,
    };
  }

  for (const tp of level.teleports) {
    const [r, c] = tp.pos;
    grid[r][c] = {
      ...grid[r][c],
      type: 'teleport',
      teleportId: tp.id,
      teleportTarget: tp.teleportTarget,
    };
  }

  for (const lock of level.locks) {
    const [r, c] = lock.pos;
    grid[r][c] = {
      ...grid[r][c],
      type: 'lock',
      lockId: lock.id,
      lockedBy: lock.unlockedByColor,
      isLocked: true,
    };
  }
}

export function getNeighbors(grid: Cell[][], row: number, col: number): Cell[] {
  const size = grid.length;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const result: Cell[] = [];

  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      result.push(grid[nr][nc]);
    }
  }

  return result;
}

export function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })));
}
