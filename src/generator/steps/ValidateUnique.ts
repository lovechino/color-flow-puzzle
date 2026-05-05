import type { Color, LevelData } from '../../types';
import { ColorId, COLOR_LIST } from '../../types';
import { GridUtils } from '../GridUtils';

// OP-05: Module-level scratch buffer — reused across checkReachability calls
const reachBuf = new Uint8Array(20 * 20);
let reachEpoch = 1;

export class UniquenessValidator {
  private gu!: GridUtils;
  private grid!: Uint8Array;
  private size = 0;
  private callCount = 0;
  private startTime = 0;
  
  private getTimeoutMs(size: number): number {
    if (size <= 7) return 2500;
    if (size <= 10) return 4000;
    return 6000;
  }

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
    if (Date.now() - this.startTime > this.getTimeoutMs(this.size)) return 0; // timeout: unknown, not "multiple"
    if (this.callCount > 200000) return 0; // call limit: unknown, not "multiple"

    if (pairIndex === pairs.length) {
      return this.checkAllFilled() ? 1 : 0;
    }

    const pair = pairs[pairIndex];

    // SAFE HEURISTICS
    if (!this.checkDegrees(pairs.slice(pairIndex))) return 0;
    if (!this.checkReachability(pair.start, pair.end, pair.colorId)) return 0;

    // OP-04: Inline DFS with early-stop — no need to enumerate all paths first
    let count = 0;

    const dfs = (curr: number): void => {
      if (count >= maxCount) return; // Early stop!

      if (curr === pair.end) {
        // Path complete — recurse to next pair
        count += this.countRecursive(pairs, pairIndex + 1, maxCount - count);
        return;
      }

      this.gu.forEachNeighbor(curr, ni => {
        if (count >= maxCount) return;
        const c = this.grid[ni];
        if (c !== ColorId.EMPTY && !(ni === pair.end && c === pair.colorId)) return;

        const wasEmpty = c === ColorId.EMPTY;
        if (wasEmpty) this.grid[ni] = pair.colorId;
        dfs(ni);
        if (wasEmpty) this.grid[ni] = ColorId.EMPTY;
      });
    };

    dfs(pair.start);
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
    // OP-05: Reuse scratch buffer — no allocation per call
    if (reachEpoch > 250) { reachBuf.fill(0); reachEpoch = 1; }
    const epoch = ++reachEpoch;

    const queue = [start];
    reachBuf[start] = epoch;
    let qIdx = 0;
    while (qIdx < queue.length) {
      const curr = queue[qIdx++]; // index-based, no shift()
      if (curr === end) return true;
      this.gu.forEachNeighbor(curr, ni => {
        if (reachBuf[ni] !== epoch &&
            (this.grid[ni] === ColorId.EMPTY || (ni === end && this.grid[ni] === colorId))) {
          reachBuf[ni] = epoch;
          queue.push(ni);
        }
      });
    }
    return false;
  }

}
