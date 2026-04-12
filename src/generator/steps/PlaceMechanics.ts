import type { Color, Mechanic, MixerDef, TeleportDef, LockDef } from '../../types';
import { getMixResult } from '../../config';
import type { SeededRandom } from '../SeededRandom';

interface MechanicsPlacementConfig {
  gridSize: number;
  solution: { color: Color; path: [number, number][] }[];
  pairs: { color: Color; start: [number, number]; end: [number, number] }[];
  allowedMechanics: Mechanic[];
  difficultyTarget: number;
  rng: SeededRandom;
}

interface MechanicsResult {
  walls: [number, number][];
  mixers: MixerDef[];
  teleports: TeleportDef[];
  locks: LockDef[];
  shapeMask?: boolean[][];
}

const MECHANIC_SCORES: Record<Mechanic, number> = {
  wall: 3,
  mixer: 5,
  teleport: 5,
  lock: 4,
  shaped_grid: 3,
  speed: 4,
  chain_mixer: 7,
  multi_teleport: 6,
  gravity: 8,
};

export class MechanicsPlacer {
  place(config: MechanicsPlacementConfig): MechanicsResult {
    const { gridSize, solution, pairs, allowedMechanics } = config;
    const solutionCells = this.getSolutionCells(solution);
    const dotCells = this.getDotCells(pairs);
    const candidates = this.getCandidates(gridSize, solutionCells, dotCells);

    const result: MechanicsResult = { walls: [], mixers: [], teleports: [], locks: [] };
    let currentDifficulty = 0;
    const ordered = [...allowedMechanics].sort((a, b) => MECHANIC_SCORES[a] - MECHANIC_SCORES[b]);

    for (const mech of ordered) {
      if (currentDifficulty >= config.difficultyTarget) break;
      currentDifficulty += this.applyMechanic(mech, result, candidates, config, solutionCells);
    }
    return result;
  }

  private getSolutionCells(solution: { path: [number, number][] }[]): Set<string> {
    const cells = new Set<string>();
    solution.forEach(sol => sol.path.forEach(([r, c]) => cells.add(`${r},${c}`)));
    return cells;
  }

  private getDotCells(pairs: { start: [number, number]; end: [number, number] }[]): Set<string> {
    const cells = new Set<string>();
    pairs.forEach(p => {
      cells.add(`${p.start[0]},${p.start[1]}`);
      cells.add(`${p.end[0]},${p.end[1]}`);
    });
    return cells;
  }

  private getCandidates(size: number, sol: Set<string>, dots: Set<string>): [number, number][] {
    const candidates: [number, number][] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!sol.has(`${r},${c}`) && !dots.has(`${r},${c}`)) candidates.push([r, c]);
      }
    }
    return candidates;
  }

  private applyMechanic(
    mech: Mechanic,
    res: MechanicsResult,
    cand: [number, number][],
    conf: MechanicsPlacementConfig,
    sol: Set<string>,
  ): number {
    switch (mech) {
      case 'wall':
        this.placeWalls(res, cand, sol, conf.gridSize, conf.difficultyTarget, 0, conf.rng);
        return res.walls.length * MECHANIC_SCORES.wall;
      case 'mixer':
        this.placeMixers(res, cand, conf.pairs, conf.gridSize, conf.rng);
        return res.mixers.length * MECHANIC_SCORES.mixer;
      case 'teleport':
        this.placeTeleports(res, cand, conf.gridSize, conf.rng);
        return res.teleports.length * MECHANIC_SCORES.teleport;
      case 'lock':
        this.placeLocks(res, cand, conf.pairs, conf.gridSize, conf.rng);
        return res.locks.length * MECHANIC_SCORES.lock;
      case 'shaped_grid':
        res.shapeMask = this.generateShapeMask(conf.gridSize, sol, conf.rng);
        return MECHANIC_SCORES.shaped_grid;
    }
    return 0;
  }

  private placeWalls(
    result: MechanicsResult,
    candidates: [number, number][],
    solutionCells: Set<string>,
    gridSize: number,
    targetDiff: number,
    currentDiff: number,
    rng: SeededRandom,
  ): void {
    const config = this.getWallConfig(targetDiff, currentDiff, gridSize);
    const shuffled = rng.shuffle([...candidates]);
    let placed = 0;
    for (const [r, c] of shuffled) {
      if (placed >= config.needed || placed >= config.max) break;
      if (!this.wouldIsolateRegion(result.walls, [r, c], gridSize, solutionCells)) {
        result.walls.push([r, c]);
        placed++;
      }
    }
  }

  private getWallConfig(target: number, current: number, size: number) {
    return {
      needed: Math.max(1, Math.ceil((target - current) / 3)),
      max: Math.floor(size * size * 0.08),
    };
  }

  private wouldIsolateRegion(
    existingWalls: [number, number][],
    newWall: [number, number],
    gridSize: number,
    solutionCells: Set<string>,
  ): boolean {
    const allWalls = new Set(existingWalls.map(([r, c]) => `${r},${c}`));
    allWalls.add(`${newWall[0]},${newWall[1]}`);
    const startKey = [...solutionCells][0];
    const visited = this.bfsSolutionArea(startKey, gridSize, allWalls);
    return [...solutionCells].some(key => !visited.has(key));
  }

  private bfsSolutionArea(startKey: string, size: number, walls: Set<string>): Set<string> {
    const [sr, sc] = startKey.split(',').map(Number);
    const visited = new Set<string>();
    const queue: [number, number][] = [[sr, sc]];
    visited.add(startKey);
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        const key = `${nr},${nc}`;
        if (!visited.has(key) && !walls.has(key)) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
    return visited;
  }

  private placeMixers(
    result: MechanicsResult,
    candidates: [number, number][],
    pairs: { color: Color; start: [number, number]; end: [number, number] }[],
    gridSize: number,
    rng: SeededRandom,
  ): void {
    const maxMixers = Math.min(2, Math.floor(gridSize / 6));
    if (maxMixers === 0) return;

    const shuffled = rng.shuffle([...candidates]);
    let placed = 0;

    for (const [r, c] of shuffled) {
      if (placed >= maxMixers) break;

      const nearbyColors = this.getNearbyColors([r, c], pairs, gridSize);
      if (nearbyColors.length < 2) continue;

      const [colorA, colorB] = nearbyColors.slice(0, 2);
      const output = getMixResult(colorA, colorB);
      if (!output) continue;

      result.mixers.push({
        pos: [r, c],
        inputA: colorA,
        inputB: colorB,
        output,
      });
      placed++;
    }
  }

  private getNearbyColors(
    cell: [number, number],
    pairs: { color: Color; start: [number, number]; end: [number, number] }[],
    gridSize: number,
  ): Color[] {
    const [r, c] = cell;
    const colors: Color[] = [];
    const radius = Math.min(3, gridSize);

    for (const p of pairs) {
      if (colors.includes(p.color)) continue;
      const distToStart = Math.abs(p.start[0] - r) + Math.abs(p.start[1] - c);
      const distToEnd = Math.abs(p.end[0] - r) + Math.abs(p.end[1] - c);
      if (distToStart <= radius || distToEnd <= radius) {
        colors.push(p.color);
      }
    }

    return colors;
  }

  private placeTeleports(
    result: MechanicsResult,
    candidates: [number, number][],
    gridSize: number,
    rng: SeededRandom,
  ): void {
    const maxPairs = Math.min(2, Math.floor(gridSize / 7));
    if (maxPairs === 0) return;
    const shuffled = rng.shuffle([...candidates]);
    let placed = 0;
    for (let i = 0; i < shuffled.length && placed < maxPairs; i++) {
      const partner = this.findTeleportPartner(shuffled, i, gridSize);
      if (partner !== -1) {
        this.addTeleportPair(result, shuffled[i], shuffled[partner], placed);
        shuffled.splice(partner, 1);
        placed++;
      }
    }
  }

  private findTeleportPartner(shuffled: [number, number][], idx: number, gridSize: number): number {
    const [r1, c1] = shuffled[idx];
    for (let i = idx + 1; i < shuffled.length; i++) {
      const [r2, c2] = shuffled[i];
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) >= Math.floor(gridSize / 2)) return i;
    }
    return -1;
  }

  private addTeleportPair(res: MechanicsResult, p1: [number, number], p2: [number, number], idx: number): void {
    const id = String.fromCharCode(65 + idx);
    res.teleports.push(
      { id, pos: p1, teleportTarget: p2 },
      { id, pos: p2, teleportTarget: p1 },
    );
  }

  private placeLocks(
    result: MechanicsResult,
    candidates: [number, number][],
    pairs: { color: Color; start: [number, number]; end: [number, number] }[],
    gridSize: number,
    rng: SeededRandom,
  ): void {
    const maxLocks = Math.min(2, Math.floor(gridSize / 6));
    const shuffled = rng.shuffle([...candidates]);
    let placed = 0;

    for (const [r, c] of shuffled) {
      if (placed >= maxLocks) break;

      const nearestColor = this.getNearestPathColor([r, c], pairs);
      if (!nearestColor) continue;

      result.locks.push({
        id: `L${placed}`,
        pos: [r, c],
        unlockedByColor: nearestColor,
      });
      placed++;
    }
  }

  private generateShapeMask(
    gridSize: number,
    solutionCells: Set<string>,
    rng: SeededRandom,
  ): boolean[][] {
    const mask = Array.from({ length: gridSize }, () => Array(gridSize).fill(true));
    const nonSol: [number, number][] = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (!solutionCells.has(`${r},${c}`)) nonSol.push([r, c]);
      }
    }
    const count = Math.floor(gridSize * gridSize * rng.next() * 0.1 + gridSize * 0.05);
    rng.shuffle(nonSol).slice(0, count).forEach(([r, c]) => (mask[r][c] = false));
    return mask;
  }

  private getNearestPathColor(
    cell: [number, number],
    pairs: { color: Color; start: [number, number]; end: [number, number] }[],
  ): Color | null {
    let minDist = Infinity;
    let nearestColor: Color | null = null;

    for (const p of pairs) {
      const dist = Math.abs(cell[0] - p.start[0]) + Math.abs(cell[1] - p.start[1]);
      if (dist < minDist) {
        minDist = dist;
        nearestColor = p.color;
      }
    }

    return nearestColor;
  }
}
