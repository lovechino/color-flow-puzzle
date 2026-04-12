import type { Cell, Color, GamePath } from '../types';

export function canExtendPath(
  currentPath: GamePath,
  nextCell: Cell,
): boolean {
  if (!nextCell.isActive) return false;
  if (nextCell.type === 'wall') return false;
  if (nextCell.isLocked) return false;

  const [headRow, headCol] = currentPath.cells[currentPath.cells.length - 1];
  const [nr, nc] = [nextCell.row, nextCell.col];

  if (Math.abs(nr - headRow) + Math.abs(nc - headCol) !== 1) {
    return false;
  }

  if (nextCell.isFilled && nextCell.pathColor !== currentPath.color) {
    return false;
  }

  const alreadyInPath = currentPath.cells.some(([r, c]) => r === nr && c === nc);
  if (alreadyInPath) return false;

  return true;
}

export function addCellToPath(
  path: GamePath,
  cell: Cell,
  grid: Cell[][],
): void {
  path.cells.push([cell.row, cell.col]);
  grid[cell.row][cell.col].isFilled = true;
  grid[cell.row][cell.col].pathColor = path.color;
}

export function shrinkPath(
  path: GamePath,
  grid: Cell[][],
): [number, number] | null {
  if (path.cells.length <= 1) return null;

  const removed = path.cells.pop()!;
  const [r, c] = removed;

  if (grid[r][c].type !== 'dot') {
    grid[r][c].isFilled = false;
    grid[r][c].pathColor = undefined;
  }

  return removed;
}

export function resetPath(
  path: GamePath,
  grid: Cell[][],
): void {
  for (const [r, c] of path.cells) {
    if (grid[r][c].type !== 'dot') {
      grid[r][c].isFilled = false;
      grid[r][c].pathColor = undefined;
    }
  }
  path.cells = [path.cells[0]];
  path.isComplete = false;
}

export function isPathComplete(path: GamePath, endDot: [number, number]): boolean {
  if (path.cells.length < 2) return false;
  const [lastR, lastC] = path.cells[path.cells.length - 1];
  return lastR === endDot[0] && lastC === endDot[1];
}

export function cutPathAtPoint(
  path: GamePath,
  cutIndex: number,
  grid: Cell[][],
): void {
  const cellsToRemove = path.cells.slice(cutIndex + 1);
  path.cells = path.cells.slice(0, cutIndex + 1);
  path.isComplete = false;

  for (const [r, c] of cellsToRemove) {
    if (grid[r][c].type !== 'dot') {
      grid[r][c].isFilled = false;
      grid[r][c].pathColor = undefined;
    }
  }
}

export function createGamePath(color: Color, startCell: Cell): GamePath {
  return {
    color,
    cells: [[startCell.row, startCell.col]],
    isComplete: false,
  };
}
