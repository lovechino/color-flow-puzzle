import type { Cell, DotPair } from '../../types';

export class ConstraintPropagator {
  propagate(grid: Cell[][], _pairs: DotPair[]): boolean {
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 100) {
      changed = false;
      iterations++;

      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          const cell = grid[r][c];
          if (!cell.isActive || cell.isFilled) continue;

          const emptyNeighbors = this.getEmptyNeighbors(grid, r, c);

          if (emptyNeighbors.length === 0 && cell.type !== 'dot') {
            return false;
          }

          if (emptyNeighbors.length === 1 && cell.type === 'empty') {
            changed = true;
          }
        }
      }
    }

    return true;
  }

  private getEmptyNeighbors(grid: Cell[][], r: number, c: number): Cell[] {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return dirs
      .map(([dr, dc]) => grid[r + dr]?.[c + dc])
      .filter(cell => cell?.isActive && !cell.isFilled && cell.type !== 'wall');
  }
}
