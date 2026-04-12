import type { DiffLabel, Mechanic, LevelData } from '../types';

export class DifficultyScorer {
  score(level: LevelData): number {
    const gridFactor = Math.min(30,
      (level.gridSize * level.gridSize) / (20 * 20) * 30,
    );

    const colorDensity = level.pairs.length / level.gridSize;
    const colorFactor = Math.min(20, colorDensity * 15);

    const pathLengths = level.solution.map(s => s.path.length);
    const avgLen = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;
    const variance = pathLengths.reduce((sum, l) =>
      sum + Math.pow(l - avgLen, 2), 0,
    ) / pathLengths.length;
    const varianceFactor = Math.min(15, Math.sqrt(variance) * 2);

    const mechanicScores: Record<Mechanic, number> = {
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
    const mechanicFactor = Math.min(20,
      level.mechanics.reduce((sum, m) => sum + (mechanicScores[m] ?? 0), 0),
    );

    const fillRatio = level.par / (level.gridSize * level.gridSize);
    const tightnessFactor = Math.min(15, fillRatio * 15);

    const rawScore = gridFactor + colorFactor + varianceFactor +
      mechanicFactor + tightnessFactor;

    return Math.round(Math.min(100, Math.max(0, rawScore)));
  }

  getLabel(score: number): DiffLabel {
    if (score <= 10) return 'trivial';
    if (score <= 25) return 'easy';
    if (score <= 45) return 'medium';
    if (score <= 60) return 'hard';
    if (score <= 75) return 'expert';
    if (score <= 90) return 'master';
    return 'legendary';
  }
}
