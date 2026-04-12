import type { Cell, GamePath, LevelData } from '../types';

export function checkWin(grid: Cell[][], paths: GamePath[], level: LevelData): boolean {
  const allPathsComplete = paths.every(p => p.isComplete);
  if (!allPathsComplete) return false;

  const allCellsFilled = grid.every(row =>
    row.every(cell => !cell.isActive || cell.isFilled),
  );
  if (!allCellsFilled) return false;

  const allPairsConnected = level.pairs.every(pair => {
    const path = paths.find(p => p.color === pair.color);
    return path?.isComplete ?? false;
  });

  return allPairsConnected;
}

export function countCompletedPaths(paths: GamePath[]): number {
  return paths.filter(p => p.isComplete).length;
}

export function countFilledCells(grid: Cell[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.isActive && cell.isFilled) count++;
    }
  }
  return count;
}

export function countActiveCells(grid: Cell[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.isActive) count++;
    }
  }
  return count;
}
