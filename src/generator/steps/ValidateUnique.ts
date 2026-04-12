import type { DotPair, Color, LevelData } from '../../types';

export class UniquenessValidator {
  private grid: (Color | null)[][] = [];
  private size = 0;
  private callCount = 0;
  private startTime = 0;
  private readonly TIMEOUT_MS = 30_000; // 30 second timeout

  countSolutions(levelData: Partial<LevelData>, maxCount: number = 2): number {
    this.size = levelData.gridSize!;
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.callCount = 0;
    this.startTime = Date.now();

    for (const p of levelData.pairs!) {
      this.grid[p.start[0]][p.start[1]] = p.color;
      this.grid[p.end[0]][p.end[1]] = p.color;
    }

    for (const [r, c] of levelData.walls ?? []) {
      this.grid[r][c] = 'WALL' as Color;
    }

    const result = this.countRecursive(levelData.pairs!, 0, maxCount);
    
    // If timeout occurred, return maxCount to indicate "not unique" (safe conservative)
    if (Date.now() - this.startTime > this.TIMEOUT_MS) return maxCount;
    
    return result;
  }

  private countRecursive(
    pairs: DotPair[],
    pairIndex: number,
    maxCount: number,
  ): number {
    this.callCount++;
    if (this.callCount > 200_000) return maxCount;

    if (pairIndex === pairs.length) {
      return this.checkAllFilled() ? 1 : 0;
    }

    const pair = pairs[pairIndex];
    const paths = this.findAllPaths(pair.start, pair.end, pair.color, 20);

    let count = 0;
    for (const path of paths) {
      this.applyPath(path, pair.color);
      count += this.countRecursive(pairs, pairIndex + 1, maxCount);
      this.unapplyPath(path);

      if (count >= maxCount) return count;
    }
    return count;
  }

  private checkAllFilled(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) return false;
      }
    }
    return true;
  }

  private findAllPaths(
    start: [number, number],
    end: [number, number],
    color: Color,
    maxPaths: number,
  ): [number, number][][] {
    const paths: [number, number][][] = [];
    const visited = new Set<string>();
    // Hard upper bound: path cannot exceed total cells on grid
    // Without this bound, DFS could explore exponentially many paths on larger grids
    const maxLen = this.size * this.size;

    const dfs = (current: [number, number], path: [number, number][]) => {
      // Early exit: found enough paths
      if (paths.length >= maxPaths) return;

      if (current[0] === end[0] && current[1] === end[1]) {
        paths.push([...path]);
        return;
      }

      // Hard bound: path length cannot exceed total grid cells
      if (path.length > maxLen) return;

      const [r, c] = current;
      const neighbors: [number, number][] = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
      ];

      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) continue;

        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;

        const cell = this.grid[nr][nc];
        if (cell !== null && !(nr === end[0] && nc === end[1] && cell === color)) continue;

        visited.add(key);
        path.push([nr, nc]);
        dfs([nr, nc], path);
        path.pop();
        visited.delete(key);
        
        // Early exit if we've found enough paths
        if (paths.length >= maxPaths) return;
      }
    };

    visited.add(`${start[0]},${start[1]}`);
    dfs(start, [start]);
    return paths;
  }

  private applyPath(path: [number, number][], color: Color): void {
    for (let i = 1; i < path.length - 1; i++) {
      this.grid[path[i][0]][path[i][1]] = color;
    }
  }

  private unapplyPath(path: [number, number][]): void {
    for (let i = 1; i < path.length - 1; i++) {
      this.grid[path[i][0]][path[i][1]] = null;
    }
  }
}
