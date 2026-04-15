import type { DotPair, Color, LevelData } from '../../types';
import { ColorId, COLOR_LIST } from '../../types';
import { GridUtils } from '../GridUtils';

export class UniquenessValidator {
  private gu!: GridUtils;
  private grid!: Uint8Array;
  private size = 0;
  private callCount = 0;
  private startTime = 0;
  private readonly TIMEOUT_MS = 15_000;
  private colorToId = new Map<Color, ColorId>();

  constructor() {
    COLOR_LIST.forEach((name, i) => {
      this.colorToId.set(name, (i + 1) as ColorId);
    });
  }

  countSolutions(levelData: Partial<LevelData>, maxCount: number = 2): number {
    this.size = levelData.gridSize!;
    this.gu = new GridUtils(this.size);
    this.grid = new Uint8Array(this.size * this.size);
    this.callCount = 0;
    this.startTime = Date.now();

    const pairs: { colorId: ColorId, start: number, end: number }[] = [];
    for (const p of levelData.pairs!) {
      const id = this.colorToId.get(p.color)!;
      const sIdx = this.gu.idx(p.start[0], p.start[1]);
      const eIdx = this.gu.idx(p.end[0], p.end[1]);
      this.grid[sIdx] = id;
      this.grid[eIdx] = id;
      pairs.push({ colorId: id, start: sIdx, end: eIdx });
    }

    for (const [r, c] of levelData.walls ?? []) {
      this.grid[this.gu.idx(r, c)] = ColorId.WALL;
    }

    return this.countRecursive(pairs, 0, maxCount);
  }

  private countRecursive(
    pairs: { colorId: ColorId, start: number, end: number }[],
    pairIndex: number,
    maxCount: number,
  ): number {
    this.callCount++;
    if (Date.now() - this.startTime > this.TIMEOUT_MS) return maxCount;
    // Hard limit to prevent infinite recursion in extremely large/open grids
    if (this.callCount > 500_000) return maxCount;

    if (pairIndex === pairs.length) {
      return this.checkAllFilled() ? 1 : 0;
    }

    const pair = pairs[pairIndex];
    
    // SAFE HEURISTICS (Math admissible)
    if (!this.checkDegrees(pairs.slice(pairIndex))) return 0;
    if (!this.checkReachability(pair.start, pair.end, pair.colorId)) return 0;

    // Find ALL paths for this color - no maxPaths limit to ensure uniqueness
    const paths = this.findAllPaths(pair.start, pair.end, pair.colorId);

    let count = 0;
    for (const path of paths) {
      const filled = this.applyPath(path, pair.colorId, pair.end);
      count += this.countRecursive(pairs, pairIndex + 1, maxCount);
      this.unapplyPath(filled);

      if (count >= maxCount) return count;
    }
    return count;
  }

  private checkAllFilled(): boolean {
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === ColorId.EMPTY) return false;
    }
    return true;
  }

  private checkDegrees(remaining: { colorId: ColorId, start: number, end: number }[]): boolean {
    const endpoints = new Set<number>();
    remaining.forEach(p => {
        endpoints.add(p.start);
        endpoints.add(p.end);
    });

    for (let i = 0; i < this.grid.length; i++) {
        if (this.grid[i] === ColorId.WALL) continue;
        if (this.grid[i] !== ColorId.EMPTY && !endpoints.has(i)) continue;

        let deg = 0;
        this.gu.forEachNeighbor(i, ni => {
            if (this.grid[ni] === ColorId.EMPTY || endpoints.has(ni)) deg++;
        });

        if (this.grid[i] === ColorId.EMPTY && deg < 2) return false;
        if (endpoints.has(i) && deg < 1) return false;
    }
    return true;
  }

  private checkReachability(start: number, end: number, colorId: ColorId): boolean {
    const visited = new Uint8Array(this.grid.length);
    const queue = [start];
    visited[start] = 1;
    let qIdx = 0;
    while (qIdx < queue.length) {
        const curr = queue[qIdx++];
        if (curr === end) return true;
        this.gu.forEachNeighbor(curr, ni => {
            if (!visited[ni] && (this.grid[ni] === ColorId.EMPTY || (ni === end && this.grid[ni] === colorId))) {
                visited[ni] = 1;
                queue.push(ni);
            }
        });
    }
    return false;
  }

  private findAllPaths(start: number, end: number, colorId: ColorId): number[][] {
    const paths: number[][] = [];
    const vis = new Uint8Array(this.grid.length);
    vis[start] = 1;
    
    const dfs = (curr: number, path: number[]) => {
      if (paths.length >= 100) return; // Still some limit to avoid explosion, but higher
      if (curr === end) {
        paths.push([...path]);
        return;
      }
      this.gu.forEachNeighbor(curr, ni => {
        if (!vis[ni] && (this.grid[ni] === ColorId.EMPTY || (ni === end && this.grid[ni] === colorId))) {
          vis[ni] = 1;
          path.push(ni);
          dfs(ni, path);
          path.pop();
          vis[ni] = 0;
        }
      });
    };

    dfs(start, [start]);
    return paths;
  }

  private applyPath(path: number[], colorId: ColorId, endIdx: number): number[] {
    const filled: number[] = [];
    for (let i = 1; i < path.length; i++) {
      const idx = path[i];
      if (idx !== endIdx && this.grid[idx] === ColorId.EMPTY) {
        this.grid[idx] = colorId;
        filled.push(idx);
      }
    }
    return filled;
  }

  private unapplyPath(filled: number[]): void {
    for (const idx of filled) {
      this.grid[idx] = ColorId.EMPTY;
    }
  }
}
