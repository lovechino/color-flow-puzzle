import type { DotPair, SolutionPath, Color, LevelData } from '../../types';
import { ColorId, COLOR_LIST } from '../../types';
import { GridUtils } from '../GridUtils';


interface SolverState {
  grid: Uint8Array;
  paths: number[][]; // Index by ColorId
  completed: boolean[]; // Index by ColorId
  emptyCells: number;
}

// Pre-allocated BFS scratch buffer (reused across calls to avoid GC pressure)
const SCRATCH_BUF_SIZE = 20 * 20;
const scratchVisited = new Uint8Array(SCRATCH_BUF_SIZE);
let scratchEpoch = 1; // Increment instead of fill(0)

export class BacktrackingSolver {
  private size = 0;
  private callCount = 0;
  private maxCalls = 0;
  private startTime = 0;
  private timeoutMs = 0;
  private gu!: GridUtils;
  private colorToId = new Map<Color, ColorId>();
  private solutionCount = 0;
  private maxSolutions = 1;

  constructor() {
    COLOR_LIST.forEach((name, i) => {
      this.colorToId.set(name, (i + 1) as ColorId);
    });
  }

  solve(size: number, pairs: DotPair[], walls: [number, number][] = [], timeoutMs: number = 0): SolutionPath[] | null {
    this.size = size;
    this.gu = new GridUtils(size);
    this.maxCalls = this.getMaxCalls(size);
    this.callCount = 0;
    this.startTime = Date.now();
    this.timeoutMs = timeoutMs;

    const grid = new Uint8Array(size * size).fill(ColorId.EMPTY);
    const paths: number[][] = Array.from({ length: 17 }, () => []);
    const completed = new Array(17).fill(false);
    const colorPairs: { id: ColorId; end: number }[] = [];

    let emptyCells = size * size;

    pairs.forEach(p => {
      const id = this.colorToId.get(p.color)!;
      const sIdx = this.gu.idx(p.start[0], p.start[1]);
      const eIdx = this.gu.idx(p.end[0], p.end[1]);
      grid[sIdx] = id;
      grid[eIdx] = id;
      paths[id].push(sIdx);
      colorPairs.push({ id, end: eIdx });
      emptyCells -= 2;
    });

    walls.forEach(([r, c]) => {
      grid[this.gu.idx(r, c)] = ColorId.WALL;
      emptyCells--;
    });

    const state: SolverState = { grid, paths, completed, emptyCells };
    // Static MRV: sort by distance
    colorPairs.sort((a, b) => {
        const aStart = paths[a.id][0];
        const bStart = paths[b.id][0];
        return this.gu.manhattan(aStart, a.end) - this.gu.manhattan(bStart, b.end);
    });

    this.solutionCount = 0;
    this.maxSolutions = 1;
    if (this.backtrack(state, colorPairs, 0)) {
        return this.format(state);
    }
    return null;
  }

  countSolutions(levelData: Partial<LevelData>, maxCount: number = 2): number {
    const { gridSize, pairs, walls } = levelData;
    if (!gridSize || !pairs) return 0;

    this.size = gridSize;
    this.gu = new GridUtils(gridSize);
    this.maxCalls = this.getMaxCalls(gridSize);
    this.callCount = 0;
    this.startTime = Date.now();
    this.timeoutMs = 5000; // Default timeout for validator

    const grid = new Uint8Array(gridSize * gridSize).fill(ColorId.EMPTY);
    const paths: number[][] = Array.from({ length: 17 }, () => []);
    const completed = new Array(17).fill(false);
    const colorPairs: { id: ColorId; end: number }[] = [];

    let emptyCells = gridSize * gridSize;

    pairs.forEach(p => {
      const id = this.colorToId.get(p.color)!;
      const sIdx = this.gu.idx(p.start[0], p.start[1]);
      const eIdx = this.gu.idx(p.end[0], p.end[1]);
      grid[sIdx] = id;
      grid[eIdx] = id;
      paths[id].push(sIdx);
      colorPairs.push({ id, end: eIdx });
      emptyCells -= 2;
    });

    (walls || []).forEach(([r, c]) => {
      grid[this.gu.idx(r, c)] = ColorId.WALL;
      emptyCells--;
    });

    const state: SolverState = { grid, paths, completed, emptyCells };
    colorPairs.sort((a, b) => {
        const aStart = paths[a.id][0];
        const bStart = paths[b.id][0];
        return this.gu.manhattan(aStart, a.end) - this.gu.manhattan(bStart, b.end);
    });

    this.solutionCount = 0;
    this.maxSolutions = maxCount;
    this.backtrack(state, colorPairs, 0);
    return this.solutionCount;
  }

  private getMaxCalls(s: number): number {
    const base = s * s * 2000 + 100000;
    if (s >= 10) return base * 20;
    if (s >= 9) return base * 10;
    return s >= 8 ? base * 3 : base;
  }

  private format(state: SolverState): SolutionPath[] {
    const result: SolutionPath[] = [];
    for (let id = 1; id <= 16; id++) {
        if (state.paths[id].length > 0) {
            result.push({
                color: COLOR_LIST[id - 1],
                path: state.paths[id].map(idx => [this.gu.row(idx), this.gu.col(idx)] as [number, number])
            });
        }
    }
    return result;
  }

  private backtrack(state: SolverState, pairs: { id: ColorId; end: number }[], pIdx: number): boolean {
    this.callCount++;
    if (this.callCount > this.maxCalls) return false;
    if (this.timeoutMs > 0 && this.callCount % 1000 === 0) {
      if (Date.now() - this.startTime > this.timeoutMs) return false;
    }

    if (pIdx === pairs.length) {
      if (state.emptyCells === 0) {
        this.solutionCount++;
        // In solve mode (maxSolutions === 1): return true to stop search immediately.
        // In count mode (maxSolutions > 1): return false to keep backtracking for more solutions.
        return this.maxSolutions === 1;
      }
      return false;
    }

    const pair = pairs[pIdx];
    const path = state.paths[pair.id];
    const curr = path[path.length - 1];

    if (curr === pair.end) {
      return this.backtrack(state, pairs, pIdx + 1);
    }

    // OP-03: BFS Island Check — more frequent, wider grid coverage
    const islandFreq = this.size >= 10 ? 2 : this.size >= 9 ? 3 : this.size >= 8 ? 5 : 20;
    if (this.size >= 7 && this.callCount % islandFreq === 0) {
        if (!this.checkIslands(state, pairs.slice(pIdx))) return false;
    }

    const neighbors: number[] = [];
    this.gu.forEachNeighbor(curr, ni => {
      const c = state.grid[ni];
      if (c === ColorId.EMPTY || (ni === pair.end && c === pair.id)) {
        neighbors.push(ni);
      }
    });

    // Sort neighbors: 1. Manhattan to end, 2. Wall-hugging
    neighbors.sort((a, b) => {
        const dA = this.gu.manhattan(a, pair.end);
        const dB = this.gu.manhattan(b, pair.end);
        if (dA !== dB) return dA - dB;
        return this.countOccupiedNeighbors(state.grid, b) - this.countOccupiedNeighbors(state.grid, a);
    });

    for (const ni of neighbors) {
      const fillEmpty = (state.grid[ni] === ColorId.EMPTY);
      if (fillEmpty) {
        state.grid[ni] = pair.id;
        state.emptyCells--;
      }
      path.push(ni);

      // Eager pruning: check if filling ni isolated any neighbors
      if (this.checkDegreesLocal(state, ni, pairs, pIdx)) {
        const found = this.backtrack(state, pairs, pIdx);
        // In solve mode: found=true means we have a solution, propagate immediately.
        // In count mode: found is always false (leaf returns false), we check solutionCount.
        if (found || this.solutionCount >= this.maxSolutions) return true;
      }

      // Undo
      path.pop();
      if (fillEmpty) {
        state.grid[ni] = ColorId.EMPTY;
        state.emptyCells++;
      }
    }

    return false;
  }

  /**
   * OP-02: Local degree check — only scan neighbors of the recently placed cell.
   * Filling a cell only affects degrees of its direct neighbors, so scanning
   * the entire grid (O(n²)) on every node is wasteful. O(5) is sufficient.
   */
  private checkDegreesLocal(
    state: SolverState,
    curr: number,
    pairs: { id: ColorId; end: number }[],
    pIdx: number,
  ): boolean {
    // Build endpoints for remaining pairs
    const endpoints = new Set<number>();
    for (let i = pIdx; i < pairs.length; i++) {
      endpoints.add(state.paths[pairs[i].id].at(-1)!);
      endpoints.add(pairs[i].end);
    }

    // Only check cells adjacent to the recently-filled cell
    let valid = true;
    this.gu.forEachNeighbor(curr, i => {
      if (!valid) return;
      const c = state.grid[i];
      if (c === ColorId.WALL) return;
      if (c !== ColorId.EMPTY && !endpoints.has(i)) return;

      let deg = 0;
      this.gu.forEachNeighbor(i, ni => {
        if (state.grid[ni] === ColorId.EMPTY || endpoints.has(ni)) deg++;
      });

      if (c === ColorId.EMPTY && deg < 2) { valid = false; return; }
      if (endpoints.has(i) && deg < 1) { valid = false; return; }
    });
    return valid;
  }

  private checkIslands(state: SolverState, remaining: { id: ColorId, end: number }[]): boolean {
    // OP-05: Reuse module-level scratch buffer — no allocation per call
    const epoch = ++scratchEpoch;
    // Overflow guard: real reset every 250 solves
    if (scratchEpoch > 250) { scratchVisited.fill(0); scratchEpoch = 1; }
    const visited = scratchVisited;
    const endpoints = new Set<number>();
    const endpointToPair = new Map<number, ColorId>();
    for (const p of remaining) {
        const h = state.paths[p.id].at(-1)!;
        endpoints.add(h);
        endpoints.add(p.end);
        endpointToPair.set(h, p.id);
        endpointToPair.set(p.end, p.id);
    }

    for (let i = 0; i < state.grid.length; i++) {
      if (visited[i] === epoch || state.grid[i] === ColorId.WALL) continue;
      if (state.grid[i] !== ColorId.EMPTY && !endpoints.has(i)) continue;

      // BFS for component — use epoch-based visited marks
      const componentDots = new Set<ColorId>();
      const queue = [i];
      visited[i] = epoch;
      let qIdx = 0;
      let hasEmpty = false;

      while (qIdx < queue.length) {
        const curr = queue[qIdx++]; // OP-07-style: index-based, no shift()
        if (state.grid[curr] === ColorId.EMPTY) hasEmpty = true;
        if (endpoints.has(curr)) componentDots.add(endpointToPair.get(curr)!);

        this.gu.forEachNeighbor(curr, ni => {
          if (visited[ni] !== epoch && (state.grid[ni] === ColorId.EMPTY || endpoints.has(ni))) {
            visited[ni] = epoch;
            queue.push(ni);
          }
        });
      }

      // If component has no paths or an incomplete pair (only 1 endpoint), it's invalid
      if (componentDots.size === 0 && hasEmpty) return false;
      for (const id of componentDots) {
          const h = state.paths[id].at(-1)!;
          const e = remaining.find(r => r.id === id)!.end;
          // Both endpoints must be in this component (epoch-tagged)
          if (visited[h] !== epoch || visited[e] !== epoch) return false;
      }
    }
    return true;
  }

  private countOccupiedNeighbors(grid: Uint8Array, idx: number): number {
    let count = 0;
    this.gu.forEachNeighbor(idx, ni => {
      if (grid[ni] !== ColorId.EMPTY) count++;
    });
    count += (4 - this.gu.neighbors(idx).length);
    return count;
  }
}
