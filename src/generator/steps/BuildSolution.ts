import type { DotPair, SolutionPath, Color } from '../../types';
import { ColorId, COLOR_LIST } from '../../types';
import { GridUtils } from '../GridUtils';

interface SolverState {
  grid: Uint8Array;
  paths: number[][]; // Index by ColorId
  completed: boolean[]; // Index by ColorId
  emptyCells: number;
}

export class BacktrackingSolver {
  private size = 0;
  private callCount = 0;
  private maxCalls = 0;
  private gu!: GridUtils;
  private colorToId = new Map<Color, ColorId>();

  constructor() {
    COLOR_LIST.forEach((name, i) => {
      this.colorToId.set(name, (i + 1) as ColorId);
    });
  }

  solve(size: number, pairs: DotPair[], walls: [number, number][] = []): SolutionPath[] | null {
    this.size = size;
    this.gu = new GridUtils(size);
    this.maxCalls = this.getMaxCalls(size);
    this.callCount = 0;

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

    if (this.backtrack(state, colorPairs, 0)) {
        return this.format(state);
    }
    return null;
  }

  private getMaxCalls(s: number): number {
    return s * s * 2000 + 100000;
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

    if (pIdx === pairs.length) {
      return state.emptyCells === 0;
    }

    const pair = pairs[pIdx];
    const path = state.paths[pair.id];
    const curr = path[path.length - 1];

    if (curr === pair.end) {
      return this.backtrack(state, pairs, pIdx + 1);
    }

    // Degree Check
    if (!this.checkDegrees(state, pairs.slice(pIdx))) return false;

    // BFS Island Check for large grids
    if (this.size >= 10 && this.callCount % 100 === 0) {
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

      if (this.backtrack(state, pairs, pIdx)) return true;

      // Undo
      path.pop();
      if (fillEmpty) {
        state.grid[ni] = ColorId.EMPTY;
        state.emptyCells++;
      }
    }

    return false;
  }

  private checkDegrees(state: SolverState, remaining: { id: ColorId, end: number }[]): boolean {
    const endpoints = new Set<number>();
    for (const p of remaining) {
        endpoints.add(state.paths[p.id].at(-1)!);
        endpoints.add(p.end);
    }

    for (let i = 0; i < state.grid.length; i++) {
      const c = state.grid[i];
      if (c === ColorId.WALL) continue;
      if (c !== ColorId.EMPTY && !endpoints.has(i)) continue;

      let deg = 0;
      this.gu.forEachNeighbor(i, ni => {
        const nc = state.grid[ni];
        if (nc === ColorId.EMPTY || endpoints.has(ni)) deg++;
      });

      if (c === ColorId.EMPTY && deg < 2) return false;
      if (endpoints.has(i) && deg < 1) return false;
    }
    return true;
  }

  private checkIslands(state: SolverState, remaining: { id: ColorId, end: number }[]): boolean {
    const visited = new Uint8Array(state.grid.length);
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
      if (visited[i] || state.grid[i] === ColorId.WALL) continue;
      if (state.grid[i] !== ColorId.EMPTY && !endpoints.has(i)) continue;

      // BFS for component
      const componentDots = new Set<ColorId>();
      const queue = [i];
      visited[i] = 1;
      let qIdx = 0;
      let hasEmpty = false;

      while (qIdx < queue.length) {
        const curr = queue[qIdx++];
        if (state.grid[curr] === ColorId.EMPTY) hasEmpty = true;
        if (endpoints.has(curr)) componentDots.add(endpointToPair.get(curr)!);

        this.gu.forEachNeighbor(curr, ni => {
          if (!visited[ni] && (state.grid[ni] === ColorId.EMPTY || endpoints.has(ni))) {
            visited[ni] = 1;
            queue.push(ni);
          }
        });
      }

      // If component has no paths or an incomplete pair (only 1 endpoint), it's invalid
      if (componentDots.size === 0 && hasEmpty) return false;
      for (const id of componentDots) {
          // Check if both head and end of this pair are in the same component
          const h = state.paths[id].at(-1)!;
          const e = remaining.find(r => r.id === id)!.end;
          if (visited[h] !== visited[e]) return false;
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
