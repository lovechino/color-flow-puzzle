/**
 * Worker Bridge - Main thread interface for GeneratorWorker
 * 
 * Provides a Promise-based API to communicate with the Web Worker.
 * Handles worker creation, message passing, and timeout management.
 * 
 * Per SOLVER_UPGRADE_EVALUATION.md Section 4.3:
 * - Worker prevents UI freeze during generation
 * - 5s timeout for grids >= 10x10, 3s for smaller grids
 * - Fallback to pre-baked templates if generation fails
 * 
 * Usage:
 *   const bridge = new GeneratorWorkerBridge();
 *   const result = await bridge.generate(config);
 *   
 *   // For batch generation:
 *   const levels = await bridge.generateBatch(config, count);
 *   
 *   // Cleanup when done:
 *   bridge.terminate();
 */

import type { GeneratorConfig, GeneratorResult } from './PuzzleGenerator';
import type { LevelData } from '../types';

// Worker message types
type WorkerRequest = {
  type: 'generate' | 'generateBatch' | 'cancel';
  requestId: string;
  config: GeneratorConfig & { count?: number };
};

type WorkerResponse = 
  | { type: 'result'; requestId: string; level: LevelData | null; status: string; attempts: number; timeMs: number }
  | { type: 'batchResult'; requestId: string; levels: LevelData[]; failed: number; timeMs: number }
  | { type: 'progress'; requestId: string; status: string; gridSize?: number; current?: number; total?: number; levelsGenerated?: number; levelsFailed?: number }
  | { type: 'error'; requestId: string; error: string; timeMs?: number }
  | { type: 'cancelled'; requestId: string };

export interface BatchResult {
  levels: LevelData[];
  failed: number;
  timeMs: number;
}

export interface GenerationProgress {
  status: string;
  gridSize?: number;
  current?: number;
  total?: number;
  levelsGenerated?: number;
  levelsFailed?: number;
}

export class GeneratorWorkerBridge {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason: unknown) => void; timeout: ReturnType<typeof setTimeout> }>();
  private requestCounter = 0;

  constructor() {
    // Worker is lazily initialized on first use
  }

  private ensureWorker() {
    if (!this.worker) {
      // Use Vite's special URL syntax for workers
      this.worker = new Worker(
        new URL('./GeneratorWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        this.handleMessage(e.data);
      };

      this.worker.onerror = (error: ErrorEvent) => {
        console.error('[GeneratorWorker] Worker error:', error);
        this.rejectAll('Worker crashed');
      };
    }
  }

  private nextRequestId(): string {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }

  private handleMessage(data: WorkerResponse) {
    const { requestId } = data;
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(requestId);

    if (data.type === 'result') {
      pending.resolve({
        level: data.level,
        status: data.status,
        attempts: data.attempts,
        timeMs: data.timeMs
      } as GeneratorResult);
    } else if (data.type === 'batchResult') {
      pending.resolve({
        levels: data.levels,
        failed: data.failed,
        timeMs: data.timeMs
      } as BatchResult);
    } else if (data.type === 'error') {
      pending.reject(new Error(data.error));
    } else if (data.type === 'cancelled') {
      pending.reject(new Error('Generation cancelled'));
    }
    // Progress messages are not resolved/rejected, they're passed to callbacks
  }

  private rejectAll(reason: string) {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  /**
   * Generate a single level
   * 
   * @param config Generation configuration
   * @param onProgress Optional progress callback
   * @returns Promise<GeneratorResult>
   */
  async generate(config: GeneratorConfig, onProgress?: (progress: GenerationProgress) => void): Promise<GeneratorResult> {
    this.ensureWorker();

    const requestId = this.nextRequestId();
    const timeoutMs = config.gridSize >= 10 ? 5000 : 3000;

    return new Promise<GeneratorResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.worker?.postMessage({ type: 'cancel', requestId } as WorkerRequest);
        reject(new Error(`Generation timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Set up progress listener
      if (onProgress) {
        const originalHandler = this.worker!.onmessage;
        this.worker!.onmessage = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.requestId === requestId && e.data.type === 'progress') {
            onProgress(e.data as unknown as GenerationProgress);
          }
          originalHandler?.call(this.worker!, e);
        };
      }

      this.worker!.postMessage({
        type: 'generate',
        requestId,
        config
      } as WorkerRequest);
    });
  }

  /**
   * Generate multiple levels in batch
   * 
   * @param config Base generation configuration
   * @param count Number of levels to generate
   * @param onProgress Optional progress callback
   * @returns Promise<BatchResult>
   */
  async generateBatch(config: GeneratorConfig, count: number, onProgress?: (progress: GenerationProgress) => void): Promise<BatchResult> {
    this.ensureWorker();

    const requestId = this.nextRequestId();
    const timeoutMs = count * 5000; // 5s per level, up to reasonable limit

    return new Promise<BatchResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.worker?.postMessage({ type: 'cancel', requestId } as WorkerRequest);
        reject(new Error(`Batch generation timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Set up progress listener
      if (onProgress) {
        const originalHandler = this.worker!.onmessage;
        this.worker!.onmessage = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.requestId === requestId && e.data.type === 'progress') {
            onProgress(e.data as unknown as GenerationProgress);
          }
          originalHandler?.call(this.worker!, e);
        };
      }

      this.worker!.postMessage({
        type: 'generateBatch',
        requestId,
        config: { ...config, count }
      } as WorkerRequest);
    });
  }

  /**
   * Terminate the worker
   * Call this when the app is closing or when generation is no longer needed
   */
  terminate() {
    this.rejectAll('Worker terminated');
    this.worker?.terminate();
    this.worker = null;
  }

  /**
   * Check if worker is running
   */
  get isRunning(): boolean {
    return this.pendingRequests.size > 0;
  }
}
