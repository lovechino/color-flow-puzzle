import type { LevelData, Mechanic } from '../types';
import { SeededRandom } from './SeededRandom';
import { placeDots } from './steps/PlaceDots';
import { BacktrackingSolver } from './steps/BuildSolution';
import { UniquenessValidator } from './steps/ValidateUnique';
import { ConstraintPropagator } from './steps/ConstraintPropagator';
import { MechanicsPlacer } from './steps/PlaceMechanics';
import { DifficultyScorer } from './DifficultyScorer';
import { createEmptyGrid, populateGridFromLevel } from '../game/GridLogic';

export interface GeneratorConfig {
  gridSize: number;
  numColors: number;
  targetDifficulty: number;
  mechanics: Mechanic[];
  seed: string | number;
}

export interface GeneratorResult {
  level: LevelData | null;
  status: 'success' | 'timeout' | 'no_unique_solution';
  attempts: number;
  timeMs: number;
}

export class PuzzleGenerator {
  private solver = new BacktrackingSolver();
  private validator = new UniquenessValidator();
  private propagator = new ConstraintPropagator();
  private mechanicsPlacer = new MechanicsPlacer();
  private scorer = new DifficultyScorer();

  generate(config: GeneratorConfig): LevelData | null {
    const { gridSize, numColors, targetDifficulty, mechanics, seed } = config;

    // Scale attempts with grid size - larger grids need many more attempts
    const maxAttempts = gridSize <= 5 ? 30
                       : gridSize <= 7 ? 200
                       : gridSize <= 10 ? 500
                       : 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const retrySeed = typeof seed === 'string'
        ? `${seed}_retry${attempt}`
        : seed + attempt * 1000;
      const attemptRng = new SeededRandom(retrySeed);

      // Step 1: Place dots
      const pairs = placeDots(gridSize, numColors, attemptRng, {
        minManhattanDistance: gridSize === 3 ? 1 : Math.max(2, Math.floor(gridSize * 0.35)),
        minColorSpread: 1,
        avoidCorners: gridSize > 3,
      });

      if (!pairs) {
        continue;
      }

      // Step 2: Solve
      const solution = this.solver.solve(gridSize, pairs, []);
      if (!solution) {
        continue;
      }

      // Step 3: Place mechanics
      const mechanicsResult = this.mechanicsPlacer.place({
        gridSize,
        solution: solution.map(s => ({ color: s.color, path: s.path })),
        pairs,
        allowedMechanics: mechanics,
        difficultyTarget: targetDifficulty,
        rng: attemptRng,
      });

      const levelData: Partial<LevelData> = {
        gridSize,
        pairs,
        walls: mechanicsResult.walls,
        mixers: mechanicsResult.mixers,
        teleports: mechanicsResult.teleports,
        locks: mechanicsResult.locks,
        shapeMask: mechanicsResult.shapeMask,
        solution,
        mechanics,
      };

      // Step 4: Validate uniqueness
      const solutionCount = this.validator.countSolutions(levelData, 2);

      if (solutionCount !== 1) {
        continue;
      }

      const grid = createEmptyGrid(gridSize, mechanicsResult.shapeMask);
      const fullLevel: LevelData = {
        id: '',
        gridSize,
        globalIndex: 0,
        pairs,
        walls: mechanicsResult.walls,
        mixers: mechanicsResult.mixers,
        teleports: mechanicsResult.teleports,
        locks: mechanicsResult.locks,
        shapeMask: mechanicsResult.shapeMask,
        solution,
        difficultyScore: 0,
        difficultyLabel: 'trivial',
        par: solution.reduce((sum, s) => sum + s.path.length, 0),
        estimatedSolveTime: 0,
        mechanics,
      };
      
      populateGridFromLevel(grid, fullLevel);

      if (!this.propagator.propagate(grid, pairs)) {
        continue;
      }

      const diffScore = this.scorer.score(fullLevel);
      fullLevel.difficultyScore = diffScore;
      fullLevel.difficultyLabel = this.scorer.getLabel(diffScore);
      fullLevel.estimatedSolveTime = Math.round(fullLevel.par * 1.5 + diffScore * 0.5);

      return fullLevel;
    }

    console.error(`[PG] All 30 attempts failed, returning null`);
    return null;
  }

  // Timeout fallback strategy (docs Section 4.4)
  generateWithFallback(config: GeneratorConfig): GeneratorResult {
    const HARD_TIMEOUT_MS = config.gridSize >= 10 ? 5000 : 3000;
    const MAX_ATTEMPTS = config.gridSize >= 16 ? 15 : 30;

    const startTime = performance.now();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const elapsed = performance.now() - startTime;
      if (elapsed > HARD_TIMEOUT_MS) {
        return {
          level: null,
          status: 'timeout',
          attempts: attempt + 1,
          timeMs: elapsed
        };
      }

      const level = this.generate({
        ...config,
        seed: typeof config.seed === 'string'
          ? `${config.seed}_fallback_${attempt}`
          : config.seed + attempt * 10000
      });

      if (level) {
        return {
          level,
          status: 'success',
          attempts: attempt + 1,
          timeMs: performance.now() - startTime
        };
      }
    }

    return {
      level: null,
      status: 'no_unique_solution',
      attempts: MAX_ATTEMPTS,
      timeMs: performance.now() - startTime
    };
  }
}
