/**
 * Generator Web Worker
 * 
 * Runs puzzle generation in a separate thread to prevent UI freeze.
 * This file runs in the Worker context, NOT in the main thread.
 * 
 * Per SOLVER_UPGRADE_EVALUATION.md Section 4.3:
 * - 15x15 puzzle generation can take 200-800ms
 * - During that time, main thread is blocked → animations freeze, touch input dropped
 * - On Android mid-range (Snapdragon 660): JS execution ~2x slower than desktop
 * 
 * Usage (from main thread):
 *   const worker = new Worker(new URL('./GeneratorWorker.ts', import.meta.url), { type: 'module' });
 *   worker.postMessage({ type: 'generate', config: { ... } });
 *   worker.onmessage = (e) => { const result = e.data; };
 */

// Import generation logic - note: in worker context, we need direct imports
// since we can't use Phaser or browser APIs
import { PuzzleGenerator } from './PuzzleGenerator';
import type { GeneratorConfig } from './PuzzleGenerator';

// Worker message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, requestId, config } = e.data;

  if (type === 'generate') {
    await handleGenerate(requestId, config);
  } else if (type === 'generateBatch') {
    const batchConfig = config as GeneratorConfig & { count: number };
    await handleGenerateBatch(requestId, batchConfig);
  } else if (type === 'cancel') {
    self.postMessage({ type: 'cancelled', requestId });
  }
};

let isRunning = false;

async function handleGenerate(requestId: string, config: GeneratorConfig) {
  if (isRunning) {
    self.postMessage({ 
      type: 'error', 
      requestId, 
      error: 'Generator already running' 
    });
    return;
  }

  isRunning = true;
  const startTime = performance.now();

  try {
    // Progress notification
    self.postMessage({ 
      type: 'progress', 
      requestId, 
      status: 'starting',
      gridSize: config.gridSize 
    });

    const generator = new PuzzleGenerator();
    
    // Use generateWithFallback which has built-in timeout (5s for grids >= 10, 3s for smaller)
    const result = generator.generateWithFallback(config);
    const elapsed = performance.now() - startTime;

    self.postMessage({
      type: 'result',
      requestId,
      level: result.level,
      status: result.status,
      attempts: result.attempts,
      timeMs: elapsed
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      timeMs: performance.now() - startTime
    });
  } finally {
    isRunning = false;
  }
}

async function handleGenerateBatch(requestId: string, config: GeneratorConfig & { count: number }) {
  if (isRunning) {
    self.postMessage({ 
      type: 'error', 
      requestId, 
      error: 'Generator already running' 
    });
    return;
  }

  isRunning = true;
  const startTime = performance.now();
  const levels: any[] = [];
  let failed = 0;

  try {
    const generator = new PuzzleGenerator();

    for (let i = 0; i < config.count; i++) {
      // Check for cancellation
      if (!isRunning) {
        self.postMessage({ type: 'cancelled', requestId });
        return;
      }

      // Progress notification
      self.postMessage({
        type: 'progress',
        requestId,
        status: 'generating',
        current: i + 1,
        total: config.count,
        levelsGenerated: levels.length,
        levelsFailed: failed
      });

      const levelConfig = {
        ...config,
        seed: `${config.seed}_batch_${i}`,
        targetDifficulty: config.targetDifficulty + (i * 5) % 50 // Spread difficulties
      };

      const result = generator.generateWithFallback(levelConfig);
      
      if (result.level) {
        levels.push(result.level);
      } else {
        failed++;
      }
    }

    const elapsed = performance.now() - startTime;

    self.postMessage({
      type: 'batchResult',
      requestId,
      levels,
      failed,
      timeMs: elapsed
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      timeMs: performance.now() - startTime
    });
  } finally {
    isRunning = false;
  }
}

// Worker message types
interface WorkerMessage {
  type: 'generate' | 'generateBatch' | 'cancel';
  requestId: string;
  config: GeneratorConfig & { count?: number };
}

// Tell TypeScript this is a worker
export {};
