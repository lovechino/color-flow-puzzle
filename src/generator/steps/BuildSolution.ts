import type { DotPair, SolutionPath, Color } from '../../types';

type GridCell = Color | 'WALL' | null;

interface SolverState {
  grid: GridCell[][];
  paths: Map<Color, [number, number][]>;
  completed: Set<Color>;
}

interface ComponentInfo {
  cells: [number, number][];
  dots: Map<Color, ('start' | 'end')[]>;
}

export class BacktrackingSolver {
  private size = 0;
  private callCount = 0;
  private maxCalls = 0;
  private readonly DIRECTIONS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  solve(size: number, pairs: DotPair[], walls: [number, number][] = []): SolutionPath[] | null {
    this.size = size;
    this.maxCalls = this.getMaxCalls(size);
    this.callCount = 0;
    const state = this.initSession(pairs, walls);
    const sorted = this.staticMRVSort(pairs, state.grid);
    const result = this.backtrack(state, sorted, 0);
    return result ? this.format(result) : null;
  }

  private initSession(pairs: DotPair[], walls: [number, number][]): SolverState {
    const grid: GridCell[][] = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    const paths = new Map<Color, [number, number][]>();
    pairs.forEach(p => {
      grid[p.start[0]][p.start[1]] = p.color;
      grid[p.end[0]][p.end[1]] = p.color;
      paths.set(p.color, [p.start]);
    });
    walls.forEach(([r, c]) => (grid[r][c] = 'WALL'));
    return { grid, paths, completed: new Set() };
  }

  private getMaxCalls(s: number): number {
    if (s <= 8) return 100_000;
    if (s <= 12) return 300_000;
    return 500_000;
  }

  private format(state: SolverState): SolutionPath[] {
    return Array.from(state.paths.entries()).map(([color, path]) => ({ color, path }));
  }

  private backtrack(state: SolverState, pairs: DotPair[], idx: number): SolverState | null {
    this.callCount++;
    if (this.callCount > this.maxCalls) return null;
    if (idx === pairs.length) return this.isFullyFilled(state.grid) ? state : null;

    const pair = pairs[idx];
    if (state.completed.has(pair.color)) return this.backtrack(state, pairs, idx + 1);

    const incomplete = pairs.filter(p => !state.completed.has(p.color));
    if (!this.isHeuristicallyFeasible(state, incomplete)) return null;

    return this.explore(state, pairs, idx);
  }

  private explore(state: SolverState, pairs: DotPair[], idx: number): SolverState | null {
    const pair = pairs[idx];
    const head = state.paths.get(pair.color)!.at(-1)!;
    const paths = this.findCandidatePaths(state.grid, head, pair.end, pair.color);
    
    for (const path of paths) {
      const next = this.apply(state, pair.color, path);
      if (path.at(-1)![0] === pair.end[0] && path.at(-1)![1] === pair.end[1]) {
        next.completed.add(pair.color);
      }
      const res = this.backtrack(next, pairs, idx + 1);
      if (res) return res;
    }
    return null;
  }

  private apply(state: SolverState, color: Color, extension: [number, number][]): SolverState {
    const grid = state.grid.map(r => [...r]);
    const paths = new Map(state.paths);
    const p = [...(paths.get(color) || [])];
    for (let i = 1; i < extension.length; i++) {
      const [r, c] = extension[i];
      grid[r][c] = color;
      p.push([r, c]);
    }
    paths.set(color, p);
    return { grid, paths, completed: new Set(state.completed) };
  }

  private isFullyFilled(grid: GridCell[][]): boolean {
    return grid.every(row => row.every(c => c !== null));
  }

  private isHeuristicallyFeasible(state: SolverState, incomplete: DotPair[]): boolean {
    // Per senior review: only disable EXPENSIVE heuristics for small grids
    // Degree Check (O(4N)) and Island Check (O(N)) should run for ALL grid sizes
    // because they catch infeasible configurations early at near-zero cost
    // Only skip Forced Moves (expensive) and Parity Check (only needed for large grids)
    
    // Forced Moves: only for grids ≥ 8 (expensive propagation)
    if (this.size >= 8) {
      if (!this.applyForcedMoves(state, incomplete)) return false;
    }
    
    // Degree Check: always run (O(4N), near-zero cost, catches obvious issues)
    if (!this.checkDegrees(state.grid, incomplete)) return false;
    
    // Island/Component Check: always run (O(N) BFS, catches disconnected regions)
    const components = this.getComponents(state.grid, incomplete);
    if (!this.validateComponents(components)) return false;
    
    // Parity Check: only for grids ≥ 10 (more complex patterns need it)
    if (this.size >= 10 && !this.checkParity(components)) return false;
    
    return true;
  }

  private applyForcedMoves(state: SolverState, incomplete: DotPair[]): boolean {
    const endpoints = this.getIncompleteEndpoints(incomplete);
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (state.grid[r][c] !== null) continue;
          const neighbors = this.getAccessibleNeighbors(state.grid, r, c, endpoints);
          if (neighbors.length === 0) return false;
          if (neighbors.length === 1 && !this.doForced(state, [r, c], neighbors[0], incomplete)) return false;
          if (neighbors.length === 1) changed = true;
        }
      }
    }
    return true;
  }

  private doForced(state: SolverState, pos: [number, number], neighbor: [number, number], inc: DotPair[]): boolean {
    const color = this.getColorAt(state, neighbor, inc);
    if (!color) return true;
    const path = state.paths.get(color)!;
    if (path.at(-1)![0] !== neighbor[0] || path.at(-1)![1] !== neighbor[1]) return true;
    path.push(pos);
    state.grid[pos[0]][pos[1]] = color;
    return true;
  }

  private getIncompleteEndpoints(inc: DotPair[]): Set<string> {
    const s = new Set<string>();
    inc.forEach(p => {
      s.add(`${p.start[0]},${p.start[1]}`);
      s.add(`${p.end[0]},${p.end[1]}`);
    });
    return s;
  }

  private checkDegrees(grid: GridCell[][], inc: DotPair[]): boolean {
    const endpoints = this.getIncompleteEndpoints(inc);
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = grid[r][c];
        const key = `${r},${c}`;
        if (cell === 'WALL' || (cell !== null && !endpoints.has(key))) continue;
        const deg = this.getAccessibleNeighbors(grid, r, c, endpoints).length;
        if (cell === null && deg < 2) return false;
        if (endpoints.has(key) && deg < 1) return false;
      }
    }
    return true;
  }

  private getAccessibleNeighbors(grid: GridCell[][], r: number, c: number, eps: Set<string>): [number, number][] {
    const res: [number, number][] = [];
    this.DIRECTIONS.forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
        if (grid[nr][nc] === null || eps.has(`${nr},${nc}`)) res.push([nr, nc]);
      }
    });
    return res;
  }

  private getComponents(grid: GridCell[][], inc: DotPair[]): ComponentInfo[] {
    const visited = new Set<string>();
    const comps: ComponentInfo[] = [];
    const eps = this.getEndpointMap(inc);
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const key = `${r},${c}`;
        if (visited.has(key) || grid[r][c] === 'WALL') continue;
        if (grid[r][c] !== null && !eps.has(key)) continue;
        comps.push(this.floodFill(grid, r, c, visited, eps));
      }
    }
    return comps;
  }

  private getEndpointMap(inc: DotPair[]): Map<string, { color: Color; role: 'start' | 'end' }> {
    const m = new Map<string, { color: Color; role: 'start' | 'end' }>();
    inc.forEach(p => {
      m.set(`${p.start[0]},${p.start[1]}`, { color: p.color, role: 'start' });
      m.set(`${p.end[0]},${p.end[1]}`, { color: p.color, role: 'end' });
    });
    return m;
  }

  private floodFill(grid: GridCell[][], r: number, c: number, visited: Set<string>, eps: Map<string, any>): ComponentInfo {
    const cells: [number, number][] = [];
    const dots = new Map<Color, any[]>();
    const queue: [number, number][] = [[r, c]];
    visited.add(`${r},${c}`);
    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      cells.push([cr, cc]);
      const d = eps.get(`${cr},${cc}`);
      if (d) {
        if (!dots.has(d.color)) dots.set(d.color, []);
        dots.get(d.color)!.push(d.role);
      }
      this.addNeighbors(grid, cr, cc, visited, eps, queue);
    }
    return { cells, dots };
  }

  private addNeighbors(grid: GridCell[][], r: number, c: number, vis: Set<string>, eps: Map<string, any>, q: [number, number][]) {
    this.DIRECTIONS.forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && !vis.has(key)) {
        if (grid[nr][nc] === null || eps.has(key)) {
          vis.add(key);
          q.push([nr, nc]);
        }
      }
    });
  }

  private validateComponents(comps: ComponentInfo[]): boolean {
    for (const comp of comps) {
      if (comp.dots.size === 0 && comp.cells.length > 0) return false;
      for (const [_, roles] of comp.dots) {
        if (roles.includes('start') !== roles.includes('end')) return false;
      }
    }
    return true;
  }

  private checkParity(comps: ComponentInfo[]): boolean {
    for (const comp of comps) {
      let b = 0, w = 0;
      comp.cells.forEach(([r, c]) => ((r + c) % 2 === 0 ? b++ : w++));
      if (Math.abs(b - w) > comp.dots.size) return false;
    }
    return true;
  }

  private staticMRVSort(pairs: DotPair[], grid: GridCell[][]): DotPair[] {
    return [...pairs].sort((a, b) => this.bfsCount(grid, a.start) - this.bfsCount(grid, b.start));
  }

  private bfsCount(grid: GridCell[][], start: [number, number]): number {
    const vis = new Set<string>([`${start[0]},${start[1]}`]);
    const q = [start];
    while (q.length > 0) {
      const [r, c] = q.shift()!;
      this.DIRECTIONS.forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && !vis.has(key) && grid[nr][nc] === null) {
          vis.add(key);
          q.push([nr, nc]);
        }
      });
    }
    return vis.size;
  }

  private findCandidatePaths(grid: GridCell[][], start: [number, number], end: [number, number], color: Color): [number, number][][] {
    const paths: [number, number][][] = [];
    const vis = new Set<string>([`${start[0]},${start[1]}`]);
    this.dfs(grid, start, end, color, [start], vis, paths);
    return paths.sort((a, b) => a.length - b.length);
  }

  private dfs(grid: GridCell[][], cur: [number, number], end: [number, number], color: Color, path: [number, number][], vis: Set<string>, paths: [number, number][][]) {
    if (paths.length >= 25) return;
    if (cur[0] === end[0] && cur[1] === end[1]) {
      paths.push([...path]);
      return;
    }
    const neighbors = this.getSortedNeighbors(grid, cur, end, color, vis);
    for (const [nr, nc] of neighbors) {
      const key = `${nr},${nc}`;
      vis.add(key);
      path.push([nr, nc]);
      this.dfs(grid, [nr, nc], end, color, path, vis, paths);
      path.pop();
      vis.delete(key);
    }
  }

  private getSortedNeighbors(grid: GridCell[][], cur: [number, number], end: [number, number], color: Color, vis: Set<string>): [number, number][] {
    return this.DIRECTIONS
      .map(([dr, dc]) => [cur[0] + dr, cur[1] + dc] as [number, number])
      .filter(([nr, nc]) => {
        if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size || vis.has(`${nr},${nc}`)) return false;
        const c = grid[nr][nc];
        return c === null || (nr === end[0] && nc === end[1] && c === color);
      })
      .sort(([r1, c1], [r2, c2]) => {
        const d1 = Math.abs(r1 - end[0]) + Math.abs(c1 - end[1]);
        const d2 = Math.abs(r2 - end[0]) + Math.abs(c2 - end[1]);
        return d1 - d2;
      });
  }

  private getColorAt(state: SolverState, pos: [number, number], inc: DotPair[]): Color | null {
    for (const p of inc) {
      const path = state.paths.get(p.color);
      if (path && path.at(-1)![0] === pos[0] && path.at(-1)![1] === pos[1]) return p.color;
    }
    return null;
  }
}
