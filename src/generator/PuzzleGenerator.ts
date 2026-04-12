import type { LevelData, Mechanic } from '../types';
import { SeededRandom } from './SeededRandom';
import { placeDots } from './steps/PlaceDots';
import { BacktrackingSolver } from './steps/BuildSolution';
import { UniquenessValidator } from './steps/ValidateUnique';
import { ConstraintPropagator } from './steps/ConstraintPropagator';
import { MechanicsPlacer } from './steps/PlaceMechanics';
import { DifficultyScorer } from './DifficultyScorer';
import { createEmptyGrid, populateGridFromLevel } from '../game/GridLogic';
import type { Color } from '../types';

function mutateLevelInternal(seed: LevelData, rng: SeededRandom): LevelData | null {
  const solver = new BacktrackingSolver();
  const gridSize = seed.gridSize;

  // Guard: ensure seed has valid pairs
  if (!seed || !seed.pairs || seed.pairs.length === 0) return null;

  // Copy pairs and mutate positions
  const pairs = seed.pairs.map(p => ({
    color: p.color as Color,
    start: [...p.start] as [number, number],
    end: [...p.end] as [number, number]
  }));

  // Mutation strategies (randomly pick one)
  const strategy = rng.nextInt(4);

  if (strategy === 0 && pairs.length >= 2) {
    // Swap positions between 2 random pairs
    const i = rng.nextInt(pairs.length);
    const j = (i + 1 + rng.nextInt(pairs.length - 1)) % pairs.length;
    const swapDot = rng.nextInt(2);
    if (swapDot === 0) {
      const tmp = pairs[i].start;
      pairs[i].start = pairs[j].start;
      pairs[j].start = tmp;
    } else {
      const tmp = pairs[i].end;
      pairs[i].end = pairs[j].end;
      pairs[j].end = tmp;
    }
  } else if (strategy === 1) {
    // Shift a random dot by 1 cell
    const i = rng.nextInt(pairs.length);
    const dotIdx = rng.nextInt(2);
    const dot = dotIdx === 0 ? pairs[i].start : pairs[i].end;
    const dir = rng.nextInt(4);
    const dr = [0, 0, 1, -1][dir];
    const dc = [1, -1, 0, 0][dir];
    const nr = dot[0] + dr;
    const nc = dot[1] + dc;

    if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
      const occupied = new Set<string>();
      pairs.forEach((p, idx) => {
        occupied.add(`${p.start[0]},${p.start[1]}`);
        occupied.add(`${p.end[0]},${p.end[1]}`);
      });

      if (!occupied.has(`${nr},${nc}`)) {
        if (dotIdx === 0) pairs[i].start = [nr, nc];
        else pairs[i].end = [nr, nc];
      }
    }
  } else if (strategy === 2 && pairs.length >= 2) {
    // Swap colors of 2 random pairs
    const i = rng.nextInt(pairs.length);
    const j = (i + 1 + rng.nextInt(pairs.length - 1)) % pairs.length;
    const tmp = pairs[i].color;
    pairs[i].color = pairs[j].color;
    pairs[j].color = tmp;
  } else {
    // Flip a pair's start/end
    const i = rng.nextInt(pairs.length);
    const tmp = pairs[i].start;
    pairs[i].start = pairs[i].end;
    pairs[i].end = tmp;
  }

  // Try to solve
  const solution = solver.solve(gridSize, pairs, []);
  if (!solution) return null;

  return {
    ...seed,
    pairs,
    solution,
    difficultyScore: 0,
    difficultyLabel: 'trivial',
    par: 0,
    estimatedSolveTime: 0,
  };
}

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
                       : gridSize <= 9 ? 1000
                       : gridSize <= 12 ? 2000
                       : 5000;

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

    console.error(`[PG] All ${maxAttempts} attempts failed, returning null`);
    return null;
  }

  // Bootstrap a level by trying many different seeds with progressive difficulty
  static bootstrap(gridSize: number, numColors: number, targetDifficulty: number, mechanics: Mechanic[], maxBootstraps: number = 1000): LevelData | null {
    const generator = new PuzzleGenerator();
    
    // Keep target colors — optimize solver instead
    // For large grids, increase attempts and use relaxed constraints
    for (let i = 0; i < maxBootstraps; i++) {
      const result = generator.generate({
        gridSize,
        numColors,
        targetDifficulty: 10 + (i % 30), // Start easy, ramp up slowly
        mechanics: [], // No mechanics for bootstrap
        seed: `bootstrap_${gridSize}_${i}_${Date.now()}`
      });
      
      // Validate that result has required properties
      if (result && Array.isArray(result.pairs) && result.pairs.length > 0 && 
          Array.isArray(result.solution) && result.solution.length > 0) {
        // Update to target parameters
        result.difficultyScore = targetDifficulty;
        return result;
      }
    }
    return null;
  }

  // Mutate an existing level to create a new one
  static mutate(seed: LevelData, mutationCount: number, difficultyTarget: number): LevelData | null {
    // Strict validation of seed
    if (!seed || !Array.isArray(seed.pairs) || seed.pairs.length === 0) {
      return null;
    }
    if (!Array.isArray(seed.solution) || seed.solution.length === 0) {
      return null;
    }

    const maxRetries = 100;
    const rng = new SeededRandom(`mutate_${seed.id}_${mutationCount}_${Date.now()}`);
    const scorer = new DifficultyScorer();
    const validator = new UniquenessValidator();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const mutated = mutateLevelInternal(seed, rng);
      if (!mutated) continue;

      // Validate uniqueness
      if (validator.countSolutions(mutated, 2) !== 1) continue;

      // Score difficulty
      const score = scorer.score(mutated);
      mutated.difficultyScore = score;
      mutated.difficultyLabel = scorer.getLabel(score);
      mutated.par = mutated.solution.reduce((sum, s) => sum + s.path.length, 0);
      mutated.estimatedSolveTime = Math.round(mutated.par * 1.5 + score * 0.5);

      return mutated;
    }
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
