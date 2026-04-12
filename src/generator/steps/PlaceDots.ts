import type { DotPair } from '../../types';
import { COLORS } from '../../config';
import type { SeededRandom } from '../SeededRandom';

interface PlacementConstraints {
  minManhattanDistance: number;
  minColorSpread: number;
  avoidCorners: boolean;
}

export function placeDots(
  size: number,
  numColors: number,
  rng: SeededRandom,
  constraints?: Partial<PlacementConstraints>,
): DotPair[] | null {
  const config = {
    minDist: constraints?.minManhattanDistance ?? Math.max(2, Math.floor(size * 0.35)),
    minSpread: constraints?.minColorSpread ?? 1,
    avoidCorners: constraints?.avoidCorners ?? true,
  };

  const pairs: DotPair[] = [];
  const occupied = new Set<string>();

  for (let colorIdx = 0; colorIdx < numColors; colorIdx++) {
    const pair = tryPlacePair(size, colorIdx, rng, config, occupied, pairs);
    if (!pair) return null;
    pairs.push(pair);
  }

  return pairs;
}

function tryPlacePair(
  size: number,
  colorIdx: number,
  rng: SeededRandom,
  config: any,
  occupied: Set<string>,
  pairs: DotPair[],
): DotPair | null {
  for (let attempts = 0; attempts < 200; attempts++) {
    const available = getAvailable(size, occupied, config.avoidCorners);
    if (available.length < 2) return null;

    const startIdx = rng.nextInt(available.length);
    const start = available[startIdx];
    const end = findEnd(available, startIdx, start, config.minDist, rng);
    if (!end) continue;

    if (isSpreadValid(start, end, pairs, config.minSpread)) {
      occupied.add(`${start[0]},${start[1]}`);
      occupied.add(`${end[0]},${end[1]}`);
      return { color: COLORS[colorIdx], start, end };
    }
  }
  return null;
}

function getAvailable(size: number, occupied: Set<string>, avoidCorners: boolean): [number, number][] {
  const available: [number, number][] = [];
  const corners = new Set([`0,0`, `0,${size - 1}`, `${size - 1},0`, `${size - 1},${size - 1}`]);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const key = `${r},${c}`;
      if (!occupied.has(key)) {
        if (avoidCorners && corners.has(key) && available.length > 4) continue;
        available.push([r, c]);
      }
    }
  }
  return available;
}

function findEnd(
  available: [number, number][],
  startIdx: number,
  start: [number, number],
  minDist: number,
  rng: SeededRandom,
): [number, number] | null {
  const validEnds = available.filter((cell, idx) => {
    if (idx === startIdx) return false;
    const dist = Math.abs(cell[0] - start[0]) + Math.abs(cell[1] - start[1]);
    return dist >= minDist;
  });
  return validEnds.length > 0 ? validEnds[rng.nextInt(validEnds.length)] : null;
}

function isSpreadValid(
  start: [number, number],
  end: [number, number],
  pairs: DotPair[],
  minSpread: number,
): boolean {
  return !pairs.some(p => {
    const dists = [
      Math.abs(p.start[0] - start[0]) + Math.abs(p.start[1] - start[1]),
      Math.abs(p.end[0] - start[0]) + Math.abs(p.end[1] - start[1]),
      Math.abs(p.start[0] - end[0]) + Math.abs(p.start[1] - end[1]),
      Math.abs(p.end[0] - end[0]) + Math.abs(p.end[1] - end[1]),
    ];
    return dists.some(d => d < minSpread);
  });
}
