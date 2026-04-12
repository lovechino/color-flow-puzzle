# Color Flow Puzzle — Senior Game Dev Plan v3
> Cập nhật: Thuật toán đầy đủ (Backtracking, DFS/BFS, A*), hệ thống Adaptive Difficulty tự động.
> Mục tiêu: Tự động hóa tối đa — từ sinh level đến điều chỉnh độ khó theo từng người chơi.

---

## Mục lục
1. [Tổng quan & Triết lý thiết kế](#1-tổng-quan--triết-lý-thiết-kế)
2. [Tech Stack](#2-tech-stack)
3. [Data Structures](#3-data-structures)
4. [Thuật toán Puzzle Generator](#4-thuật-toán-puzzle-generator)
5. [Thuật toán Hint Engine (DFS/A*)](#5-thuật-toán-hint-engine-dfsa)
6. [Thuật toán Solver — Validate nghiệm duy nhất](#6-thuật-toán-solver--validate-nghiệm-duy-nhất)
7. [Hệ thống Adaptive Difficulty (tự động hóa)](#7-hệ-thống-adaptive-difficulty-tự-động-hóa)
8. [Difficulty Scoring Formula](#8-difficulty-scoring-formula)
9. [Level Design — 2305 màn (3×3 → 20×20)](#9-level-design--2305-màn-3×3--20×20)
10. [Game Mechanics — Đặc tả đầy đủ](#10-game-mechanics--đặc-tả-đầy-đủ)
11. [Monetization — AdMob](#11-monetization--admob)
12. [Kiến trúc hệ thống](#12-kiến-trúc-hệ-thống)
13. [Cấu trúc thư mục](#13-cấu-trúc-thư-mục)
14. [Roadmap 20 tuần](#14-roadmap-20-tuần)
15. [Thứ tự tạo file](#15-thứ-tự-tạo-file)
16. [Checklist Launch](#16-checklist-launch)

---

## 1. Tổng quan & Triết lý thiết kế

### Vấn đề cốt lõi cần giải quyết
Hầu hết puzzle game thất bại vì 1 trong 2 lý do:
- **Quá dễ:** User chán sau 10 phút, uninstall.
- **Quá khó:** User bị stuck, frustrated, uninstall.

Giải pháp: **Adaptive Difficulty** — hệ thống tự đo lường skill của từng người chơi và tự điều chỉnh độ khó. Không có 2 người chơi nào có cùng trải nghiệm.

### Ba tầng tự động hóa

```
Tầng 1 — Puzzle Generator:    Tự động tạo puzzle hợp lệ với độ khó mục tiêu
Tầng 2 — Difficulty Scorer:   Tự động tính điểm khó của từng puzzle
Tầng 3 — Adaptive Engine:     Tự động chọn puzzle phù hợp cho từng user
```

### Flow System Overview

```
User chơi level
       ↓
PerformanceTracker ghi nhận: thời gian, hints, undos, failures
       ↓
PerformanceScorer tính: PlayerScore (0–100)
       ↓
AdaptiveEngine cập nhật: SkillLevel của user
       ↓
LevelSelector chọn: level tiếp theo với DifficultyScore khớp SkillLevel
       ↓
[nếu không có level pre-generated phù hợp]
       ↓
RuntimeGenerator tạo: puzzle mới on-the-fly với targetDifficulty
```

---

## 2. Tech Stack

| Công cụ | Phiên bản | Vai trò |
|---------|-----------|---------|
| Phaser 3 | 3.60+ | Game engine (rendering, input, scenes) |
| TypeScript | 5.x | Type safety — bắt buộc với game logic phức tạp |
| Vite | 5.x | Build + HMR |
| Capacitor | 5.x | JS → APK/IPA native wrapper |
| @capacitor-community/admob | latest | Google AdMob |
| @capacitor/preferences | latest | Native key-value storage |
| Firebase Analytics | latest | Player behavior tracking |
| Howler.js | 2.x | Audio |

### Lệnh cài đặt

```bash
npm create vite@latest color-flow-puzzle -- --template vanilla-ts
cd color-flow-puzzle
npm install phaser howler firebase
npm install @capacitor/core @capacitor/android @capacitor/preferences @capacitor/haptics
npm install @capacitor-community/admob
npm install -D @capacitor/cli @types/howler typescript vite
```

---

## 3. Data Structures

### 3.1 Core Types

```typescript
// src/types/index.ts

// ─── Colors ───────────────────────────────────────────────────────────────────
export type Color =
  | 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple'
  | 'cyan' | 'pink' | 'brown' | 'white' | 'lime' | 'magenta'
  | 'teal' | 'gold' | 'navy';
// 15 màu — đủ cho 20×20 grid có tới 14 cặp

// ─── Mechanics ────────────────────────────────────────────────────────────────
export type Mechanic =
  | 'wall' | 'mixer' | 'teleport' | 'lock'
  | 'shaped_grid' | 'speed' | 'chain_mixer'
  | 'multi_teleport' | 'gravity';

// ─── Cell ─────────────────────────────────────────────────────────────────────
export interface Cell {
  row: number;
  col: number;
  // Loại ô
  type: CellType;
  isActive: boolean;       // false = ô bị vô hiệu hóa (shaped grid)
  // Màu
  dotColor?: Color;        // màu dot nếu type = 'dot'
  pathColor?: Color;       // màu đường đang đi qua ô này
  isFilled: boolean;
  // Mixer
  mixerInputA?: Color;     // màu đầu vào A
  mixerInputB?: Color;     // màu đầu vào B
  mixerOutput?: Color;     // màu đầu ra
  mixerFilledA: boolean;   // đã có đường A đi qua chưa
  mixerFilledB: boolean;
  // Teleport
  teleportId?: string;     // 'A', 'B', 'C'...
  teleportTarget?: [number, number]; // tọa độ ô đích
  // Lock
  lockId?: string;
  lockedBy?: Color;        // màu đường cần đi qua để mở
  isLocked: boolean;
}

export type CellType = 'empty' | 'dot' | 'wall' | 'mixer' | 'teleport' | 'lock';

// ─── Path ─────────────────────────────────────────────────────────────────────
export interface GamePath {
  color: Color;
  cells: [number, number][];   // ordered list of [row, col]
  isComplete: boolean;          // đã nối đến end dot chưa
}

// ─── Level ────────────────────────────────────────────────────────────────────
export interface LevelData {
  id: string;               // 'g07_042'
  gridSize: number;
  globalIndex: number;      // 1..2305
  pairs: DotPair[];
  walls: [number, number][];
  mixers: MixerDef[];
  teleports: TeleportDef[];
  locks: LockDef[];
  shapeMask?: boolean[][];  // true = active cell, false = disabled
  solution: SolutionPath[];
  // Difficulty metadata
  difficultyScore: number;       // 0..100, tính bởi DifficultyScorer
  difficultyLabel: DiffLabel;    // 'trivial'|'easy'|'medium'|'hard'|'expert'|'master'
  par: number;                   // optimal moves
  estimatedSolveTime: number;    // giây, dự đoán cho skill trung bình
  mechanics: Mechanic[];
}

export type DiffLabel = 'trivial' | 'easy' | 'medium' | 'hard' | 'expert' | 'master' | 'legendary';

export interface DotPair {
  color: Color;
  start: [number, number];
  end: [number, number];
}

export interface MixerDef {
  pos: [number, number];
  inputA: Color;
  inputB: Color;
  output: Color;
}

export interface TeleportDef {
  id: string;
  pos: [number, number];
}

export interface LockDef {
  id: string;
  pos: [number, number];
  unlockedByColor: Color;
}

export interface SolutionPath {
  color: Color;
  path: [number, number][];
}

// ─── Player State ─────────────────────────────────────────────────────────────
export interface GameSession {
  levelId: string;
  startTime: number;          // Date.now()
  moves: number;
  hintsUsed: number;
  undosUsed: number;
  restarts: number;
  adsWatchedForHint: number;
  adsWatchedForUndo: number;
  isComplete: boolean;
  completionTime?: number;    // ms
}

// ─── Player Profile ───────────────────────────────────────────────────────────
export interface PlayerProfile {
  skillLevel: number;         // 0..100, tự động cập nhật
  performanceHistory: PerformanceRecord[];  // rolling window 10 sessions
  currentGridSize: number;
  highestUnlockedGrid: number;
  totalLevelsCompleted: number;
  streakDays: number;
  lastPlayDate: string;
}

export interface PerformanceRecord {
  levelId: string;
  gridSize: number;
  difficultyScore: number;   // độ khó của level đó
  performanceScore: number;  // 0..100 của player trên level đó
  timestamp: number;
}
```

### 3.2 Seeded Random

```typescript
// src/generator/SeededRandom.ts
// Mulberry32 — fast, deterministic, good distribution
export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    // Hash string seed thành number
    if (typeof seed === 'string') {
      this.state = this.hashString(seed);
    } else {
      this.state = seed >>> 0;
    }
    if (this.state === 0) this.state = 1;
  }

  private hashString(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h;
  }

  // Returns float in [0, 1)
  next(): number {
    this.state |= 0;
    this.state = this.state + 0x6d2b79f5 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Returns int in [0, max)
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  // Returns int in [min, max]
  nextIntRange(min: number, max: number): number {
    return min + this.nextInt(max - min + 1);
  }

  // Shuffle array in place (Fisher-Yates)
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
```

---

## 4. Thuật toán Puzzle Generator

### 4.1 Tổng quan Pipeline

```
GeneratorConfig (gridSize, numColors, targetDifficulty, mechanics, seed)
       ↓
Step 1: PlaceDots()        → đặt N cặp dots lên grid
       ↓
Step 2: BuildSolution()    → Backtracking tìm 1 solution fill toàn bộ grid
       ↓
Step 3: ValidateUnique()   → đếm số solutions, reject nếu != 1
       ↓
Step 4: PlaceMechanics()   → đặt walls/mixers/teleports/locks
       ↓
Step 5: ScoreDifficulty()  → tính DifficultyScore
       ↓
Step 6: AdjustToTarget()   → nếu score lệch >10% so với target → retry
       ↓
LevelData
```

### 4.2 Step 1: PlaceDots

```typescript
// src/generator/steps/PlaceDots.ts

interface PlacementConstraints {
  minManhattanDistance: number;    // khoảng cách tối thiểu giữa start và end
  minColorSpread: number;          // khoảng cách tối thiểu giữa 2 dots khác màu
  avoidCorners: boolean;           // tránh cắm dots vào góc (làm puzzle tầm thường)
}

export function placeDots(
  size: number,
  numColors: number,
  rng: SeededRandom,
  constraints: PlacementConstraints
): DotPair[] | null {

  // Tính khoảng cách tối thiểu dựa trên grid size
  // Grid 3x3: min distance = 2. Grid 20x20: min distance = 7
  const minDist = constraints.minManhattanDistance ||
    Math.max(2, Math.floor(size * 0.35));

  const pairs: DotPair[] = [];
  const occupied = new Set<string>();

  const key = (r: number, c: number) => `${r},${c}`;

  // Corner cells (ít lựa chọn đường đi → dễ tạo trivial puzzles)
  const corners = new Set([
    key(0, 0), key(0, size-1), key(size-1, 0), key(size-1, size-1)
  ]);

  for (let colorIdx = 0; colorIdx < numColors; colorIdx++) {
    let placed = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 200;

    while (!placed && attempts < MAX_ATTEMPTS) {
      attempts++;

      // Tạo list tất cả ô trống
      const available: [number, number][] = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!occupied.has(key(r, c))) {
            // Skip corners nếu constraints yêu cầu và đã có đủ chỗ khác
            if (constraints.avoidCorners && corners.has(key(r, c)) && available.length > 4) continue;
            available.push([r, c]);
          }
        }
      }

      if (available.length < 2) return null; // không đủ chỗ

      // Chọn start ngẫu nhiên
      const startIdx = rng.nextInt(available.length);
      const start = available[startIdx];

      // Chọn end: phải đủ xa start (Manhattan distance >= minDist)
      const validEnds = available.filter((cell, idx) => {
        if (idx === startIdx) return false;
        const dist = Math.abs(cell[0] - start[0]) + Math.abs(cell[1] - start[1]);
        return dist >= minDist;
      });

      if (validEnds.length === 0) continue;

      const end = validEnds[rng.nextInt(validEnds.length)];

      // Kiểm tra spread: start và end không quá gần dots của màu khác
      const tooClose = pairs.some(p => {
        const dists = [
          Math.abs(p.start[0] - start[0]) + Math.abs(p.start[1] - start[1]),
          Math.abs(p.end[0] - start[0]) + Math.abs(p.end[1] - start[1]),
          Math.abs(p.start[0] - end[0]) + Math.abs(p.start[1] - end[1]),
          Math.abs(p.end[0] - end[0]) + Math.abs(p.end[1] - end[1]),
        ];
        return dists.some(d => d < (constraints.minColorSpread || 1));
      });

      if (tooClose) continue;

      // Đặt dots
      occupied.add(key(start[0], start[1]));
      occupied.add(key(end[0], end[1]));
      pairs.push({ color: COLORS[colorIdx], start, end });
      placed = true;
    }

    if (!placed) return null; // Fail — caller sẽ retry với seed khác
  }

  return pairs;
}
```

### 4.3 Step 2: BuildSolution — Backtracking Algorithm

Đây là thuật toán quan trọng nhất. Phải tìm 1 cách đi cho TẤT CẢ màu đồng thời, sao cho fill toàn bộ grid.

```typescript
// src/generator/steps/BuildSolution.ts

export class BacktrackingSolver {
  private grid: (Color | null)[][];  // null = empty
  private size: number;
  private pairs: DotPair[];
  private solution: Map<Color, [number, number][]>;
  private callCount: number;
  private readonly MAX_CALLS = 500_000; // Giới hạn để tránh infinite loop

  solve(size: number, pairs: DotPair[]): SolutionPath[] | null {
    this.size = size;
    this.grid = Array.from({ length: size }, () => Array(size).fill(null));
    this.pairs = pairs;
    this.solution = new Map();
    this.callCount = 0;

    // Đặt tất cả dots vào grid
    for (const p of pairs) {
      this.grid[p.start[0]][p.start[1]] = p.color;
      this.grid[p.end[0]][p.end[1]] = p.color;
    }

    // Sắp xếp pairs theo thứ tự: pairs có khoảng cách ngắn trước
    // → Backtracking hiệu quả hơn vì ràng buộc được áp dụng sớm
    const sortedPairs = [...pairs].sort((a, b) => {
      const distA = Math.abs(a.start[0]-a.end[0]) + Math.abs(a.start[1]-a.end[1]);
      const distB = Math.abs(b.start[0]-b.end[0]) + Math.abs(b.start[1]-b.end[1]);
      return distA - distB;
    });

    const result = this.backtrack(sortedPairs, 0, new Map());
    if (!result) return null;

    // Chuyển Map thành array
    return Array.from(result.entries()).map(([color, path]) => ({ color, path }));
  }

  private backtrack(
    pairs: DotPair[],
    pairIndex: number,
    currentPaths: Map<Color, [number, number][]>
  ): Map<Color, [number, number][]> | null {

    this.callCount++;
    if (this.callCount > this.MAX_CALLS) return null;

    // Base case: tất cả pairs đã được giải
    if (pairIndex === pairs.length) {
      // Kiểm tra fill: TẤT CẢ ô phải được fill
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.grid[r][c] === null) return null;
        }
      }
      return new Map(currentPaths);
    }

    const pair = pairs[pairIndex];
    // Tìm tất cả paths từ start → end cho màu này
    const paths = this.findAllPaths(pair.start, pair.end, pair.color);

    // Pruning: nếu không tìm được path nào → backtrack ngay
    if (paths.length === 0) return null;

    // Thử từng path
    for (const path of paths) {
      // Apply path
      this.applyPath(path, pair.color);
      currentPaths.set(pair.color, path);

      // Pruning: kiểm tra tính khả thi trước khi đệ quy
      // (Connectivity check: không có vùng ô trống bị cô lập)
      if (this.isConnectivityFeasible(pairs, pairIndex + 1)) {
        const result = this.backtrack(pairs, pairIndex + 1, currentPaths);
        if (result) return result;
      }

      // Undo path
      this.unapplyPath(path);
      currentPaths.delete(pair.color);
    }

    return null;
  }

  // DFS để tìm TẤT CẢ paths từ start → end
  // Giới hạn: max path length = gridSize * gridSize (không thể dài hơn)
  private findAllPaths(
    start: [number, number],
    end: [number, number],
    color: Color,
    maxPaths: number = 20  // Chỉ lấy 20 paths đầu tiên để tránh explosion
  ): [number, number][][] {

    const paths: [number, number][][] = [];
    const visited = new Set<string>();
    const maxLen = this.size * this.size;

    const dfs = (current: [number, number], path: [number, number][]) => {
      if (paths.length >= maxPaths) return;

      if (current[0] === end[0] && current[1] === end[1]) {
        paths.push([...path]);
        return;
      }

      if (path.length >= maxLen) return;

      const [r, c] = current;
      const neighbors: [number, number][] = [
        [r-1, c], [r+1, c], [r, c-1], [r, c+1]
      ];

      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) continue;

        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;

        const cell = this.grid[nr][nc];
        // Ô trống hoặc là end dot cùng màu → có thể đi
        if (cell !== null && !(nr === end[0] && nc === end[1] && cell === color)) continue;

        visited.add(key);
        path.push([nr, nc]);
        dfs([nr, nc], path);
        path.pop();
        visited.delete(key);
      }
    };

    visited.add(`${start[0]},${start[1]}`);
    dfs(start, [start]);
    return paths;
  }

  // Pruning optimization: kiểm tra không có vùng empty cells bị "nhốt"
  // (isolated pocket không thể fill được)
  private isConnectivityFeasible(remainingPairs: DotPair[], fromIndex: number): boolean {
    // Tìm tất cả empty cells
    const emptyCells: [number, number][] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) {
          emptyCells.push([r, c]);
        }
      }
    }

    if (emptyCells.length === 0) return true;

    // BFS flood fill: tất cả empty cells phải connected thành 1 khối
    // Nếu có 2+ disconnected regions → không thể fill → prune
    const visited = new Set<string>();
    const queue: [number, number][] = [emptyCells[0]];
    visited.add(`${emptyCells[0][0]},${emptyCells[0][1]}`);

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
        if (nr < 0 || nr >= this.size || nc < 0 || nc >= this.size) continue;
        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;
        if (this.grid[nr][nc] !== null) continue; // occupied
        visited.add(key);
        queue.push([nr, nc]);
      }
    }

    // Nếu flood fill không reach tất cả empty cells → có disconnected region
    return visited.size === emptyCells.length;
  }

  private applyPath(path: [number, number][], color: Color): void {
    // Skip dots (start/end), chỉ fill intermediate cells
    for (let i = 1; i < path.length - 1; i++) {
      const [r, c] = path[i];
      this.grid[r][c] = color;
    }
  }

  private unapplyPath(path: [number, number][]): void {
    for (let i = 1; i < path.length - 1; i++) {
      const [r, c] = path[i];
      this.grid[r][c] = null;
    }
  }
}
```

### 4.4 Step 3: Validate Unique Solution

```typescript
// src/generator/steps/ValidateUnique.ts

export class UniquenessValidator {
  private grid: (Color | null)[][];
  private size: number;
  private callCount: number;

  // Trả về số solutions tìm được (dừng sau maxCount)
  countSolutions(levelData: Partial<LevelData>, maxCount: number = 2): number {
    this.size = levelData.gridSize!;
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.callCount = 0;

    // Setup grid với dots
    for (const p of levelData.pairs!) {
      this.grid[p.start[0]][p.start[1]] = p.color;
      this.grid[p.end[0]][p.end[1]] = p.color;
    }
    // Setup walls
    for (const [r, c] of levelData.walls ?? []) {
      this.grid[r][c] = 'WALL' as Color;
    }

    return this.countRecursive(levelData.pairs!, 0, maxCount);
  }

  private countRecursive(
    pairs: DotPair[],
    pairIndex: number,
    maxCount: number
  ): number {

    this.callCount++;
    if (this.callCount > 200_000) return maxCount; // timeout = consider non-unique

    if (pairIndex === pairs.length) {
      const allFilled = this.checkAllFilled();
      return allFilled ? 1 : 0;
    }

    const pair = pairs[pairIndex];
    const paths = this.findAllPaths(pair.start, pair.end, pair.color, 50);

    let count = 0;
    for (const path of paths) {
      this.applyPath(path, pair.color);
      count += this.countRecursive(pairs, pairIndex + 1, maxCount);
      this.unapplyPath(path);

      if (count >= maxCount) return count; // early exit
    }
    return count;
  }

  private checkAllFilled(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) return false;
      }
    }
    return true;
  }

  // findAllPaths, applyPath, unapplyPath — tương tự BacktrackingSolver
  // (copy hoặc extract thành shared utility)
  private findAllPaths(
    start: [number, number],
    end: [number, number],
    color: Color,
    maxPaths: number
  ): [number, number][][] {
    // ... (identical to BacktrackingSolver.findAllPaths)
    return []; // placeholder
  }

  private applyPath(path: [number, number][], color: Color): void {
    for (let i = 1; i < path.length - 1; i++) {
      this.grid[path[i][0]][path[i][1]] = color;
    }
  }

  private unapplyPath(path: [number, number][]): void {
    for (let i = 1; i < path.length - 1; i++) {
      this.grid[path[i][0]][path[i][1]] = null;
    }
  }
}

// Usage: level hợp lệ khi và chỉ khi countSolutions() === 1
```

---

## 5. Thuật toán Hint Engine (DFS / A*)

### 5.1 Tại sao cần 2 thuật toán khác nhau

- **DFS với heuristic** — dùng cho grids nhỏ (3×3 → 10×10). Nhanh, ít RAM, tìm được optimal path.
- **A\* (A-star)** — dùng cho grids lớn (11×11 → 20×20). DFS thuần có thể tốn O(N!) nodes. A* với admissible heuristic đảm bảo optimal path và chạy nhanh hơn nhiều.

### 5.2 Hint Engine — DFS cho grids nhỏ

```typescript
// src/game/HintEngine.ts

export class HintEngine {
  // Entry point — được gọi khi user tap nút Hint
  getNextHint(gameState: GameState): HintResult | null {
    const { level, paths, grid } = gameState;

    if (level.gridSize <= 10) {
      return this.solveWithDFS(level, paths, grid);
    } else {
      return this.solveWithAStar(level, paths, grid);
    }
  }

  // ─── DFS Solution ──────────────────────────────────────────────────────────
  private solveWithDFS(
    level: LevelData,
    currentPaths: GamePath[],
    grid: Cell[][]
  ): HintResult | null {

    // Clone grid state
    const gridClone = this.cloneGrid(grid);
    const solution = this.dfsFromCurrentState(level, currentPaths, gridClone);

    if (!solution) return null;

    // Tìm "next step" — ô tiếp theo cần vẽ
    return this.extractNextStep(currentPaths, solution);
  }

  private dfsFromCurrentState(
    level: LevelData,
    existingPaths: GamePath[],
    grid: Cell[][]
  ): Map<Color, [number, number][]> | null {

    // Tìm màu chưa complete
    const incompletePairs = level.pairs.filter(p => {
      const path = existingPaths.find(ep => ep.color === p.color);
      return !path?.isComplete;
    });

    if (incompletePairs.length === 0) return null;

    // Lấy đường đang vẽ dở (nếu có) cho từng màu
    const partialPaths = new Map<Color, [number, number][]>();
    for (const p of existingPaths) {
      if (!p.isComplete) {
        partialPaths.set(p.color, p.cells as [number, number][]);
      }
    }

    return this.dfsRecursive(incompletePairs, 0, grid, partialPaths, level.pairs);
  }

  private dfsRecursive(
    incompletePairs: DotPair[],
    pairIndex: number,
    grid: Cell[][],
    currentPaths: Map<Color, [number, number][]>,
    allPairs: DotPair[]
  ): Map<Color, [number, number][]> | null {

    if (pairIndex === incompletePairs.length) {
      // Kiểm tra fill condition
      const allFilled = grid.every(row =>
        row.every(cell => !cell.isActive || cell.isFilled)
      );
      return allFilled ? new Map(currentPaths) : null;
    }

    const pair = incompletePairs[pairIndex];
    const existingPath = currentPaths.get(pair.color) ?? [pair.start];
    const head = existingPath[existingPath.length - 1];
    const target = pair.end;

    // DFS với Warnsdorff-inspired heuristic:
    // Ưu tiên ô có ít lựa chọn nhất (ít hàng xóm trống nhất)
    // → Tránh tạo dead ends sớm
    const paths = this.findPathsDFS(head, target, pair.color, grid, 30);

    // Sắp xếp paths theo heuristic: path "tight" (ít optional cells) trước
    paths.sort((a, b) => this.pathScore(a, grid) - this.pathScore(b, grid));

    for (const path of paths) {
      // Apply phần tiếp theo của path (từ head đến end)
      this.applyPathToGrid(path, pair.color, grid);
      currentPaths.set(pair.color, [...existingPath, ...path.slice(1)]);

      const result = this.dfsRecursive(
        incompletePairs, pairIndex + 1, grid, currentPaths, allPairs
      );
      if (result) return result;

      // Undo
      this.removePathFromGrid(path, pair.color, grid);
      currentPaths.set(pair.color, existingPath);
    }

    return null;
  }

  // Score cho path: thấp = "tight" = ưu tiên trước
  // (ít ô trống xung quanh → cần fill sớm)
  private pathScore(path: [number, number][], grid: Cell[][]): number {
    let score = 0;
    for (const [r, c] of path) {
      const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
      const emptyNeighbors = neighbors.filter(([nr,nc]) => {
        if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) return false;
        return grid[nr][nc].isActive && !grid[nr][nc].isFilled;
      });
      score += emptyNeighbors.length;
    }
    return score;
  }

  // ─── A* Solution cho grids lớn ─────────────────────────────────────────────
  private solveWithAStar(
    level: LevelData,
    currentPaths: GamePath[],
    grid: Cell[][]
  ): HintResult | null {

    // A* state: { paths: Map<Color, [r,c][]>, filledCount: number }
    // Heuristic: tổng Manhattan distance còn lại của tất cả incomplete pairs

    interface AStarState {
      paths: Map<Color, [number, number][]>;
      gridSnapshot: boolean[][];  // filled[r][c]
      g: number;  // cost so far (number of cells filled)
      h: number;  // heuristic
      f: number;  // g + h
    }

    const initialH = this.computeHeuristic(level.pairs, currentPaths, grid);
    const initialState: AStarState = {
      paths: new Map(currentPaths.map(p => [p.color, p.cells as [number, number][]])),
      gridSnapshot: grid.map(row => row.map(cell => cell.isFilled)),
      g: this.countFilled(grid),
      h: initialH,
      f: this.countFilled(grid) + initialH
    };

    // Min-heap priority queue (f-value)
    const openSet = new MinHeap<AStarState>((a, b) => a.f - b.f);
    openSet.push(initialState);

    const visited = new Set<string>();
    let iterations = 0;
    const MAX_ITER = 50_000;

    while (!openSet.isEmpty() && iterations < MAX_ITER) {
      iterations++;
      const current = openSet.pop()!;

      const stateKey = this.serializeState(current.paths, current.gridSnapshot);
      if (visited.has(stateKey)) continue;
      visited.add(stateKey);

      // Goal check
      if (current.h === 0 && this.checkAllFilledSnapshot(current.gridSnapshot)) {
        return this.extractNextStep(currentPaths, current.paths);
      }

      // Expand: thêm 1 ô cho 1 incomplete path
      const incompletePairs = level.pairs.filter(p => {
        const path = current.paths.get(p.color);
        if (!path) return true;
        const head = path[path.length - 1];
        return head[0] !== p.end[0] || head[1] !== p.end[1];
      });

      if (incompletePairs.length === 0) continue;

      const pair = incompletePairs[0]; // Xử lý 1 pair tại 1 thời điểm
      const path = current.paths.get(pair.color) ?? [pair.start];
      const head = path[path.length - 1];

      const neighbors: [number, number][] = [
        [head[0]-1, head[1]], [head[0]+1, head[1]],
        [head[0], head[1]-1], [head[0], head[1]+1]
      ];

      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nc < 0 || nr >= level.gridSize || nc >= level.gridSize) continue;
        if (current.gridSnapshot[nr][nc] && !(nr === pair.end[0] && nc === pair.end[1])) continue;

        const newPath = [...path, [nr, nc] as [number, number]];
        const newPaths = new Map(current.paths);
        newPaths.set(pair.color, newPath);

        const newSnapshot = current.gridSnapshot.map(row => [...row]);
        newSnapshot[nr][nc] = true;

        const newG = current.g + 1;
        const newH = this.computeHeuristic(level.pairs, this.pathsToGamePaths(newPaths), grid);

        openSet.push({
          paths: newPaths,
          gridSnapshot: newSnapshot,
          g: newG,
          h: newH,
          f: newG + newH
        });
      }
    }

    return null;
  }

  // Heuristic cho A*: tổng Manhattan distance của tất cả incomplete paths
  // Admissible vì Manhattan distance <= actual path length
  private computeHeuristic(
    pairs: DotPair[],
    currentPaths: GamePath[],
    grid: Cell[][]
  ): number {
    let h = 0;

    for (const pair of pairs) {
      const path = currentPaths.find(p => p.color === pair.color);
      if (path?.isComplete) continue;

      const head = path?.cells[path.cells.length - 1] ?? pair.start;
      const manhattan =
        Math.abs(head[0] - pair.end[0]) + Math.abs(head[1] - pair.end[1]);
      h += manhattan;
    }

    // Thêm penalty cho empty cells (chưa fill)
    const emptyCount = grid.reduce((sum, row) =>
      sum + row.filter(cell => cell.isActive && !cell.isFilled).length, 0
    );
    h += emptyCount * 0.5; // weight < 1 để giữ admissibility

    return h;
  }

  // Extract "next step" từ solved solution
  private extractNextStep(
    currentPaths: GamePath[],
    solution: Map<Color, [number, number][]>
  ): HintResult | null {

    for (const [color, solutionPath] of solution) {
      const current = currentPaths.find(p => p.color === color);
      const currentLen = current?.cells.length ?? 1;
      const solutionLen = solutionPath.length;

      // Tìm màn chưa complete và solutionPath còn dài hơn current
      if (currentLen < solutionLen) {
        const nextCell = solutionPath[currentLen]; // ô tiếp theo
        return {
          color,
          nextCell,
          // Reveal 2 ô tiếp theo cho grids lớn (UX tốt hơn)
          extendedHint: level.gridSize >= 12
            ? solutionPath.slice(currentLen, currentLen + 2)
            : [nextCell]
        };
      }
    }
    return null;
  }
}

export interface HintResult {
  color: Color;
  nextCell: [number, number];
  extendedHint: [number, number][];
}
```

### 5.3 MinHeap cho A*

```typescript
// src/utils/MinHeap.ts
export class MinHeap<T> {
  private heap: T[] = [];
  constructor(private compareFn: (a: T, b: T) => number) {}

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return min;
  }

  isEmpty(): boolean { return this.heap.length === 0; }
  size(): number { return this.heap.length; }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compareFn(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2*i+1, right = 2*i+2;
      if (left < n && this.compareFn(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < n && this.compareFn(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else break;
    }
  }
}
```

---

## 6. Thuật toán Solver — Validate nghiệm duy nhất

Đây là bước **quan trọng nhất** đảm bảo chất lượng puzzle. Một puzzle tốt có đúng 1 nghiệm.

### 6.1 Tại sao cần validate?

Generator tạo ra solution ngẫu nhiên. Nhưng có thể tồn tại solution thứ 2 mà generator không biết. Nếu có 2 nghiệm → puzzle "lỏng", user không cần logic để giải, chỉ cần may mắn.

### 6.2 Constraint Propagation trước khi Backtrack

Trước khi chạy backtracking đếm nghiệm, áp dụng Constraint Propagation để thu hẹp không gian tìm kiếm:

```typescript
// src/generator/steps/ConstraintPropagator.ts

export class ConstraintPropagator {
  // Arc Consistency: loại bỏ các moves không thể dẫn đến solution
  propagate(grid: Cell[][], pairs: DotPair[]): boolean {
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 100) {
      changed = false;
      iterations++;

      // Rule 1: Ô chỉ có 1 neighbor trống → bắt buộc phải có đường đi qua
      // Rule 2: Dot bị bao vây bởi walls và đường khác màu → vô nghiệm
      // Rule 3: Ô trống bị cô lập (0 neighbors trống) mà không phải dot → vô nghiệm
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          const cell = grid[r][c];
          if (!cell.isActive || cell.isFilled) continue;

          const emptyNeighbors = this.getEmptyNeighbors(grid, r, c);

          // Rule 3: isolated empty cell
          if (emptyNeighbors.length === 0 && cell.type !== 'dot') {
            return false; // infeasible
          }

          // Rule 1: forced path
          if (emptyNeighbors.length === 1 && cell.type === 'empty') {
            // This cell MUST be part of the path through the only neighbor
            // → Can prune paths that don't go through here
            changed = true;
          }
        }
      }
    }

    return true; // feasible
  }

  private getEmptyNeighbors(grid: Cell[][], r: number, c: number): Cell[] {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    return dirs
      .map(([dr, dc]) => grid[r+dr]?.[c+dc])
      .filter(cell => cell?.isActive && !cell.isFilled && cell.type !== 'wall');
  }
}
```

### 6.3 Uniqueness Check với Early Termination

```typescript
// Chỉ cần biết "có nhiều hơn 1 solution không?"
// → Dừng ngay khi tìm được solution thứ 2
const count = validator.countSolutions(levelData, 2);
// count === 0: puzzle vô nghiệm (generator bug)
// count === 1: VALID ✓
// count >= 2: invalid, regenerate
if (count !== 1) {
  // Thử lại với seed khác hoặc điều chỉnh constraints
  return null;
}
```

---

## 7. Hệ thống Adaptive Difficulty (tự động hóa)

Đây là tính năng phân biệt game này với Flow Free thông thường. Toàn bộ hệ thống chạy tự động, không cần can thiệp.

### 7.1 Tổng quan kiến trúc

```
PlayerProfile
  ├── skillLevel: number (0..100)          ← cập nhật sau mỗi level
  ├── performanceWindow: Record[10]         ← rolling window 10 sessions
  └── adaptationState: AdaptationState     ← trạng thái điều chỉnh hiện tại

AdaptiveEngine
  ├── recordSession(session: GameSession)   ← gọi sau mỗi level
  ├── getNextLevelConfig(): LevelConfig     ← gọi trước mỗi level
  └── selectLevel(config): LevelData       ← chọn level phù hợp

LevelConfig
  ├── gridSize: number
  ├── targetDifficulty: number (0..100)
  ├── allowedMechanics: Mechanic[]
  └── hintBudget: number                   ← số hints trước khi suggest ads
```

### 7.2 Performance Scoring

```typescript
// src/adaptive/PerformanceScorer.ts

export interface ScoringWeights {
  timeWeight: number;        // 0.3
  hintWeight: number;        // 0.25
  undoWeight: number;        // 0.15
  restartWeight: number;     // 0.2
  efficiencyWeight: number;  // 0.1
}

export class PerformanceScorer {

  private readonly DEFAULT_WEIGHTS: ScoringWeights = {
    timeWeight: 0.30,
    hintWeight: 0.25,
    undoWeight: 0.15,
    restartWeight: 0.20,
    efficiencyWeight: 0.10
  };

  // Tính PerformanceScore (0..100) cho 1 session
  // 100 = perfect (par moves, không hints, không undo, nhanh)
  // 0 = terrible (nhiều hints, nhiều restarts, rất chậm)
  score(session: GameSession, level: LevelData): number {

    const weights = this.DEFAULT_WEIGHTS;

    // ── Time Score (0..100) ──────────────────────────────────────────────────
    // par time dựa trên estimatedSolveTime của level
    const timeRatio = session.completionTime
      ? session.completionTime / 1000 / level.estimatedSolveTime
      : 3.0; // chưa hoàn thành = penalty max
    // timeRatio = 1.0 → đúng expected time → score 80
    // timeRatio = 0.5 → nhanh gấp đôi → score 100
    // timeRatio = 3.0 → chậm gấp 3 → score 0
    const timeScore = Math.max(0, Math.min(100,
      100 - (timeRatio - 0.5) * 40
    ));

    // ── Hint Score (0..100) ──────────────────────────────────────────────────
    // 0 hints = 100, 1 hint = 70, 2 hints = 40, 3+ hints = 0
    const hintScore = Math.max(0, 100 - session.hintsUsed * 30);

    // ── Undo Score (0..100) ──────────────────────────────────────────────────
    // 0 undos = 100, mỗi undo trừ 10 điểm
    const undoScore = Math.max(0, 100 - session.undosUsed * 10);

    // ── Restart Score (0..100) ───────────────────────────────────────────────
    // 0 restarts = 100, 1 = 60, 2 = 20, 3+ = 0
    const restartScore = Math.max(0, 100 - session.restarts * 40);

    // ── Move Efficiency Score (0..100) ───────────────────────────────────────
    // moves === par = 100, mỗi extra move trừ 5
    const moveRatio = session.moves / level.par;
    const efficiencyScore = Math.max(0, Math.min(100,
      100 - (moveRatio - 1.0) * 50
    ));

    // ── Weighted Average ─────────────────────────────────────────────────────
    const finalScore =
      timeScore       * weights.timeWeight +
      hintScore       * weights.hintWeight +
      undoScore       * weights.undoWeight +
      restartScore    * weights.restartWeight +
      efficiencyScore * weights.efficiencyWeight;

    return Math.round(finalScore);
  }
}
```

### 7.3 Skill Level Update

```typescript
// src/adaptive/SkillTracker.ts

export class SkillTracker {
  private readonly WINDOW_SIZE = 10;         // rolling window
  private readonly LEARNING_RATE = 0.15;     // tốc độ cập nhật skill
  private readonly DIFFICULTY_BONUS = 0.3;   // bonus nếu level khó mà vẫn làm tốt

  updateSkill(profile: PlayerProfile, newRecord: PerformanceRecord): PlayerProfile {
    const window = [...profile.performanceHistory, newRecord]
      .slice(-this.WINDOW_SIZE);

    // Weighted average: records gần đây có weight cao hơn
    const weights = window.map((_, i) => Math.pow(1.5, i)); // exponential weights
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const weightedAvgPerf = window.reduce((sum, record, i) =>
      sum + record.performanceScore * weights[i], 0
    ) / totalWeight;

    // Difficulty-adjusted performance
    // Nếu làm tốt trên level khó → skill tăng nhiều hơn
    const difficultyFactor = newRecord.difficultyScore / 50; // normalize to ~1.0
    const adjustedPerf = weightedAvgPerf * (1 + this.DIFFICULTY_BONUS * (difficultyFactor - 1));

    // Exponential Moving Average để smooth skill changes
    // skill[t] = (1 - lr) * skill[t-1] + lr * adjustedPerf
    const newSkill = Math.round(
      (1 - this.LEARNING_RATE) * profile.skillLevel +
      this.LEARNING_RATE * Math.min(100, adjustedPerf)
    );

    // Tính trend: skill đang tăng hay giảm?
    const recentAvg = window.slice(-3).reduce((s, r) => s + r.performanceScore, 0) / 3;
    const oldAvg = window.slice(0, Math.min(3, window.length))
      .reduce((s, r) => s + r.performanceScore, 0) / Math.min(3, window.length);
    const trend: SkillTrend = recentAvg - oldAvg > 10 ? 'rising'
                            : recentAvg - oldAvg < -10 ? 'falling'
                            : 'stable';

    return {
      ...profile,
      skillLevel: newSkill,
      performanceHistory: window,
      adaptationState: {
        trend,
        consecutiveEasyWins: trend === 'rising'
          ? (profile.adaptationState?.consecutiveEasyWins ?? 0) + 1
          : 0,
        consecutiveHardFails: trend === 'falling'
          ? (profile.adaptationState?.consecutiveHardFails ?? 0) + 1
          : 0
      }
    };
  }
}

type SkillTrend = 'rising' | 'stable' | 'falling';
```

### 7.4 Adaptive Level Selection

```typescript
// src/adaptive/AdaptiveEngine.ts

export class AdaptiveEngine {
  private scorer = new PerformanceScorer();
  private tracker = new SkillTracker();

  // Gọi sau mỗi level complete/fail
  recordSession(
    session: GameSession,
    level: LevelData,
    profile: PlayerProfile
  ): PlayerProfile {
    const perfScore = this.scorer.score(session, level);
    const record: PerformanceRecord = {
      levelId: level.id,
      gridSize: level.gridSize,
      difficultyScore: level.difficultyScore,
      performanceScore: perfScore,
      timestamp: Date.now()
    };
    return this.tracker.updateSkill(profile, record);
  }

  // Tính target difficulty cho level tiếp theo
  getTargetDifficulty(profile: PlayerProfile): number {
    const skill = profile.skillLevel;
    const state = profile.adaptationState;

    // Zone of Proximal Development (ZPD):
    // Level tốt nhất = hơi khó hơn skill hiện tại một chút
    // target = skill + offset (dựa trên trend)

    let offset: number;

    if (state?.consecutiveEasyWins >= 3) {
      // Đang win quá dễ → tăng mạnh
      offset = 15;
    } else if (state?.consecutiveHardFails >= 2) {
      // Đang fail liên tục → giảm mạnh
      offset = -15;
    } else if (state?.trend === 'rising') {
      // Đang tiến bộ → tăng nhẹ
      offset = 8;
    } else if (state?.trend === 'falling') {
      // Đang thoái lui → giảm nhẹ
      offset = -5;
    } else {
      // Stable → target = skill + small positive offset (luôn thách thức nhẹ)
      offset = 5;
    }

    return Math.max(1, Math.min(100, skill + offset));
  }

  // Chọn level tiếp theo từ pool
  selectNextLevel(
    profile: PlayerProfile,
    availableLevels: LevelData[],
    completedLevelIds: Set<string>
  ): LevelData | null {

    const targetDiff = this.getTargetDifficulty(profile);
    const targetGridSize = this.getAppropriateGridSize(profile);

    // Filter: chưa chơi, đúng grid size
    const candidates = availableLevels.filter(l =>
      !completedLevelIds.has(l.id) &&
      l.gridSize === targetGridSize
    );

    if (candidates.length === 0) {
      // Không còn level trong grid size này → unlock grid tiếp theo
      return this.selectFromAdjacentGrid(profile, availableLevels, completedLevelIds);
    }

    // Tìm level có difficultyScore gần targetDiff nhất
    candidates.sort((a, b) =>
      Math.abs(a.difficultyScore - targetDiff) -
      Math.abs(b.difficultyScore - targetDiff)
    );

    // Chọn random trong top 3 để tránh lặp lại
    const topK = candidates.slice(0, Math.min(3, candidates.length));
    return topK[Math.floor(Math.random() * topK.length)];
  }

  // Xác định grid size phù hợp với skill hiện tại
  private getAppropriateGridSize(profile: PlayerProfile): number {
    // Mapping skill → grid size
    // skill 0-10 → 3x3
    // skill 10-20 → 4x4
    // ...
    // skill 90-100 → 19x19 or 20x20
    const skillToGrid = [3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,
                         13,13,14,14,15,15,16,16,17,17,18,18,19,19,20,20];
    // Each 3 skill points = 1 grid size up
    const idx = Math.min(Math.floor(profile.skillLevel / 3), skillToGrid.length - 1);
    const suggestedGrid = skillToGrid[idx];

    // Không vượt quá highest unlocked
    return Math.min(suggestedGrid, profile.highestUnlockedGrid);
  }

  private selectFromAdjacentGrid(
    profile: PlayerProfile,
    all: LevelData[],
    completed: Set<string>
  ): LevelData | null {
    // Try current grid ± 1
    for (const delta of [+1, -1, +2, -2]) {
      const targetSize = profile.currentGridSize + delta;
      const candidates = all.filter(l =>
        l.gridSize === targetSize && !completed.has(l.id)
      );
      if (candidates.length > 0) {
        const targetDiff = this.getTargetDifficulty(profile);
        candidates.sort((a, b) =>
          Math.abs(a.difficultyScore - targetDiff) -
          Math.abs(b.difficultyScore - targetDiff)
        );
        return candidates[0];
      }
    }
    return null;
  }
}
```

---

## 8. Difficulty Scoring Formula

DifficultyScore (0..100) được tính **tự động** cho mỗi puzzle sau khi generate.

### 8.1 Các yếu tố ảnh hưởng

```typescript
// src/generator/DifficultyScorer.ts

export class DifficultyScorer {

  score(level: LevelData): number {
    // ── Factor 1: Grid complexity (0..30) ──────────────────────────────────
    // gridSize^2 tỷ lệ với số ô → đóng góp tuyến tính vào độ khó
    const gridFactor = Math.min(30,
      (level.gridSize * level.gridSize) / (20 * 20) * 30
    );

    // ── Factor 2: Color density (0..20) ────────────────────────────────────
    // Tỷ lệ số màu / gridSize
    // Nhiều màu hơn trong cùng grid = khó hơn
    const colorDensity = level.pairs.length / level.gridSize;
    const colorFactor = Math.min(20, colorDensity * 15);

    // ── Factor 3: Path length variance (0..15) ─────────────────────────────
    // Nếu các paths có độ dài rất khác nhau → khó hơn
    // (user khó đoán được path nào dài)
    const pathLengths = level.solution.map(s => s.path.length);
    const avgLen = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;
    const variance = pathLengths.reduce((sum, l) =>
      sum + Math.pow(l - avgLen, 2), 0
    ) / pathLengths.length;
    const varianceFactor = Math.min(15, Math.sqrt(variance) * 2);

    // ── Factor 4: Mechanic count và loại (0..20) ───────────────────────────
    const mechanicScores: Record<Mechanic, number> = {
      wall: 3,
      mixer: 5,
      teleport: 5,
      lock: 4,
      shaped_grid: 3,
      speed: 4,
      chain_mixer: 7,
      multi_teleport: 6,
      gravity: 8
    };
    const mechanicFactor = Math.min(20,
      level.mechanics.reduce((sum, m) => sum + (mechanicScores[m] ?? 0), 0)
    );

    // ── Factor 5: Solution uniqueness tightness (0..15) ────────────────────
    // Đo bằng: sau khi fix 1 path → số nghiệm còn lại giảm bao nhiêu?
    // Nếu puzzle "tight" (chỉ có 1 cách) → score cao
    // Proxy: (par_length / gridSize^2) — path càng "full" grid càng tight
    const fillRatio = level.par / (level.gridSize * level.gridSize);
    const tightnessFactor = Math.min(15, fillRatio * 15);

    // ── Tổng cộng ──────────────────────────────────────────────────────────
    const rawScore = gridFactor + colorFactor + varianceFactor +
                     mechanicFactor + tightnessFactor;

    // Normalize về 0..100
    return Math.round(Math.min(100, Math.max(0, rawScore)));
  }

  // Label cho UX
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
```

### 8.2 Bảng difficulty score theo grid size

| Grid | Levels | Diff Score Range | Label Range |
|------|--------|-----------------|-------------|
| 3×3  | 3      | 1–5             | trivial |
| 4×4  | 5      | 4–10            | trivial |
| 5×5  | 10     | 8–18            | trivial → easy |
| 6×6  | 18     | 15–30           | easy |
| 7×7  | 28     | 25–45           | easy → medium |
| 8×8  | 40     | 35–58           | medium → hard |
| 9×9  | 55     | 45–68           | medium → hard |
| 10×10| 70     | 52–72           | hard |
| 11×11| 88     | 58–76           | hard → expert |
| 12×12| 108    | 63–82           | expert |
| 13×13| 130    | 68–86           | expert |
| 14×14| 155    | 72–90           | expert → master |
| 15×15| 182    | 76–92           | master |
| 16×16| 212    | 78–94           | master |
| 17×17| 245    | 80–95           | master |
| 18×18| 280    | 82–96           | master → legendary |
| 19×19| 318    | 84–98           | legendary |
| 20×20| 358    | 86–100          | legendary |

---

## 9. Level Design — 2305 màn (3×3 → 20×20)

### 9.1 Bảng phân phối tổng quan

| Grid  | Màn    | Cumulative | Mechanic mới            | Màu |
|-------|--------|------------|-------------------------|-----|
| 3×3   | 3      | 3          | —                       | 2 |
| 4×4   | 5      | 8          | —                       | 2–3 |
| 5×5   | 10     | 18         | —                       | 3–5 |
| 6×6   | 18     | 36         | **Wall**                | 4–6 |
| 7×7   | 28     | 64         | **Color Mixer**         | 5–7 |
| 8×8   | 40     | 104        | **Teleport**            | 6–8 |
| 9×9   | 55     | 159        | **Lock Cell**           | 6–8 |
| 10×10 | 70     | 229        | **Shaped Grid**         | 7–9 |
| 11×11 | 88     | 317        | **Speed Mode**          | 8–9 |
| 12×12 | 108    | 425        | **Chain Mixer**         | 8–10 |
| 13×13 | 130    | 555        | **Multi-Teleport**      | 9–11 |
| 14×14 | 155    | 710        | **Gravity Mode**        | 10–12 |
| 15×15 | 182    | 892        | Tất cả combo            | 11–13 |
| 16×16 | 212    | 1104       | Tất cả combo            | 11–13 |
| 17×17 | 245    | 1349       | Expert layouts          | 12–14 |
| 18×18 | 280    | 1629       | Master                  | 13–14 |
| 19×19 | 318    | 1947       | Legendary               | 14–15 |
| 20×20 | 358    | 2305       | Grandmaster             | 14–15 |

### 9.2 Trong mỗi Grid Size — Distribution pattern

Với grid N×N có `count` levels:

```
Levels 1..10%          → Warm-up: numColors = minColors, zero mechanics
Levels 11..30%         → Mechanic intro: 1 new mechanic, simple usage
Levels 31..60%         → Development: 1-2 mechanics, increasing complexity
Levels 61..85%         → Challenge: 2-3 mechanics combined
Levels 86..97%         → Expert: max colors, all mechanics, false paths
Levels 98..99%         → Pre-boss: near-impossible for avg player
Level 100% (last)      → Boss: max difficulty, special design
```

### 9.3 Boss Level Policy

Màn cuối của mỗi grid size là boss level. Không generate tự động — thiết kế tay. Đặc điểm:
- Nghiệm đẹp về mặt thẩm mỹ (đường đi tạo pattern)
- Độ khó cao nhất của grid size đó
- Có mechanic twist bất ngờ

### 9.4 Adaptive Unlock Criteria

```typescript
// Grid N+1 unlock khi:
// - Hoàn thành >= 70% levels của grid N, HOẶC
// - SkillLevel >= threshold cho grid N+1

const UNLOCK_THRESHOLDS: Record<number, number> = {
  4: 5,    // skill >= 5 để unlock 4x4
  5: 10,
  6: 18,
  7: 28,
  8: 38,
  9: 48,
  10: 55,
  11: 62,
  12: 68,
  13: 72,
  14: 76,
  15: 80,
  16: 83,
  17: 86,
  18: 89,
  19: 92,
  20: 95
};

function canUnlockGrid(size: number, profile: PlayerProfile): boolean {
  const threshold = UNLOCK_THRESHOLDS[size] ?? 100;
  return profile.skillLevel >= threshold;
}
```

---

## 10. Game Mechanics — Đặc tả đầy đủ

### 10.1 Core — Vẽ đường

Input pipeline:
```
pointerdown → getCellAtPixel() → startPath()
pointermove → getCellAtPixel() → extendPath() hoặc shrinkPath()
pointerup   → finalizePath() → checkWin()
```

Rules:
- 4-directional only (no diagonal)
- Đường mới không đi qua ô đã filled bởi màu khác
- Vẽ ngược lại → undo từng ô (shrinkPath)
- Đường mới cắt đường cũ cùng màu → reset đường cũ từ điểm cắt

### 10.2 Color Mixer — Bảng đầy đủ

```typescript
export const MIXER_TABLE: Map<string, Color> = new Map([
  ['red+yellow',   'orange'],
  ['blue+yellow',  'green'],
  ['red+blue',     'purple'],
  ['blue+white',   'cyan'],
  ['red+white',    'pink'],
  ['green+blue',   'teal'],
  ['red+green',    'lime'],
  ['yellow+white', 'gold'],
]);

// Lookup: thứ tự màu không quan trọng
export function getMixResult(a: Color, b: Color): Color | null {
  const key1 = `${a}+${b}`;
  const key2 = `${b}+${a}`;
  return MIXER_TABLE.get(key1) ?? MIXER_TABLE.get(key2) ?? null;
}
```

### 10.3 Gravity Mode

Sau khi 1 đường hoàn thành → tất cả dots "rơi xuống" theo gravity:
1. Scan từ bottom row lên top
2. Bất kỳ dot nào có ô trống bên dưới → rơi xuống
3. Recalculate win condition

```typescript
function applyGravity(grid: Cell[][]): void {
  const size = grid.length;
  // Scan từng cột
  for (let c = 0; c < size; c++) {
    // Collect non-empty cells từ bottom lên
    const cells = [];
    for (let r = size - 1; r >= 0; r--) {
      if (grid[r][c].isActive && grid[r][c].type !== 'empty') {
        cells.push(grid[r][c]);
      }
    }
    // Refill cột từ bottom
    let fillIdx = size - 1;
    for (const cell of cells) {
      grid[fillIdx][c] = { ...cell, row: fillIdx };
      fillIdx--;
    }
    // Empty cells ở trên
    for (let r = fillIdx; r >= 0; r--) {
      grid[r][c] = { row: r, col: c, type: 'empty', isActive: true, isFilled: false, isLocked: false, mixerFilledA: false, mixerFilledB: false };
    }
  }
}
```

### 10.4 Speed Mode

```typescript
// Countdown timer, lưu vào GameScene state
interface SpeedModeConfig {
  initialSeconds: number;   // 90 cho 11×11, scale theo grid size
  extraSecondsPerAd: number; // +30 khi xem rewarded ad
  warningThreshold: number;  // 15 giây còn lại → timer đỏ + blink
}

// initialSeconds formula:
function getSpeedModeTime(gridSize: number): number {
  // 11×11 → 90s, 20×20 → 180s
  return 90 + (gridSize - 11) * 10;
}
```

### 10.5 Win Condition

```typescript
function checkWin(grid: Cell[][], paths: GamePath[]): boolean {
  // Condition 1: tất cả paths complete
  const allPathsComplete = paths.every(p => p.isComplete);
  if (!allPathsComplete) return false;

  // Condition 2: tất cả active cells đã filled
  const allCellsFilled = grid.every(row =>
    row.every(cell => !cell.isActive || cell.isFilled)
  );
  return allCellsFilled;
}
```

---

## 11. Monetization — AdMob

### Trigger Points

```typescript
// src/ads/AdTriggers.ts
export enum AdTrigger {
  HINT_REQUESTED    = 'hint_req',     // Hết hints miễn phí
  UNDO_REQUESTED    = 'undo_req',     // Hết undos miễn phí
  GRID_UNLOCK       = 'grid_unlock',  // Muốn unlock grid tiếp theo sớm
  STREAK_SAVE       = 'streak_save',  // Bỏ 1 ngày, muốn giữ streak
  SPEED_TIME_UP     = 'speed_time',   // Hết giờ speed mode
  CONTINUE_AFTER_FAIL = 'continue'    // Fail nhiều lần, muốn tiếp tục
}

// Cho mỗi trigger, show rewarded ad nếu user đồng ý
async function handleAdTrigger(
  trigger: AdTrigger,
  onGranted: () => void
): Promise<void> {
  const messages: Record<AdTrigger, string> = {
    [AdTrigger.HINT_REQUESTED]:      'Watch a short video for a free hint?',
    [AdTrigger.UNDO_REQUESTED]:      'Watch a short video for 3 more undos?',
    [AdTrigger.GRID_UNLOCK]:         'Watch a short video to unlock this grid early?',
    [AdTrigger.STREAK_SAVE]:         `Watch a video to save your ${streak}-day streak?`,
    [AdTrigger.SPEED_TIME_UP]:       'Watch a short video for +30 seconds?',
    [AdTrigger.CONTINUE_AFTER_FAIL]: 'Watch a short video to continue from here?'
  };

  // Show dialog với message
  const confirmed = await showAdDialog(messages[trigger]);
  if (!confirmed) return;

  const watched = await AdManager.showRewarded();
  if (watched) onGranted();
}
```

### Interstitial Policy

```typescript
// Show interstitial sau mỗi 5 levels, minimum 3 phút giữa 2 lần
// KHÔNG show sau:
// - Boss level (emotional moment)
// - Milestone achievement (100, 500, 1000...)
// - Ngay sau rewarded ad
```

### Revenue Estimate

```
Tháng 1 (DAU ~80, RPM rewarded $15, RPM interstitial $5):
  Rewarded: 80 × 2/day × 30 × $15/1000 = $72
  Interstitial: 80 × 3/day × 30 × $5/1000 = $36
  Total: ~$108 (~2.7M VND)

Tháng 3 (DAU ~250):
  Rewarded: 250 × 2.5 × 30 × $15/1000 = $281
  Interstitial: 250 × 3 × 30 × $5/1000 = $112
  Total: ~$393 (~9.8M VND)
```

---

## 12. Kiến trúc hệ thống

### File dependencies

```
types/index.ts               ← không import gì
config.ts                    ← import types
utils/MinHeap.ts             ← không import gì
generator/SeededRandom.ts    ← không import gì
generator/steps/PlaceDots.ts ← import types, SeededRandom
generator/steps/BuildSolution.ts ← import types
generator/steps/ValidateUnique.ts ← import types
generator/DifficultyScorer.ts ← import types
generator/PuzzleGenerator.ts ← import tất cả steps + scorer
game/Grid.ts                 ← import types
game/Path.ts                 ← import types, Grid
game/WinChecker.ts           ← import types, Grid, Path
game/MixerLogic.ts           ← import types
game/HintEngine.ts           ← import types, MinHeap, Grid
adaptive/PerformanceScorer.ts ← import types
adaptive/SkillTracker.ts      ← import types
adaptive/AdaptiveEngine.ts    ← import tất cả adaptive/*
storage/GameStorage.ts        ← import types
analytics/Analytics.ts        ← import types
ads/AdManager.ts              ← import (capacitor admob)
scenes/GameScene.ts           ← import game/*, adaptive/*, ads/*, analytics
```

---

## 13. Cấu trúc thư mục

```
color-flow-puzzle/
├── src/
│   ├── types/
│   │   └── index.ts                  ← tạo đây TRƯỚC TIÊN
│   ├── config.ts
│   ├── utils/
│   │   └── MinHeap.ts
│   ├── generator/
│   │   ├── SeededRandom.ts
│   │   ├── steps/
│   │   │   ├── PlaceDots.ts
│   │   │   ├── BuildSolution.ts      ← Backtracking
│   │   │   ├── ValidateUnique.ts     ← Uniqueness check
│   │   │   ├── PlaceMechanics.ts     ← Wall/Mixer/Teleport placement
│   │   │   └── ConstraintPropagator.ts
│   │   ├── DifficultyScorer.ts
│   │   └── PuzzleGenerator.ts        ← orchestrates all steps
│   ├── game/
│   │   ├── Grid.ts
│   │   ├── Path.ts
│   │   ├── WinChecker.ts
│   │   ├── MixerLogic.ts
│   │   ├── HintEngine.ts             ← DFS (small) + A* (large)
│   │   ├── TimerManager.ts
│   │   ├── GravityManager.ts
│   │   └── DailySeed.ts
│   ├── adaptive/
│   │   ├── PerformanceScorer.ts
│   │   ├── SkillTracker.ts
│   │   └── AdaptiveEngine.ts
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MenuScene.ts
│   │   ├── GridSelectScene.ts
│   │   ├── LevelSelectScene.ts
│   │   ├── GameScene.ts              ← màn chơi chính
│   │   ├── WinScene.ts
│   │   ├── DailyScene.ts
│   │   └── SettingsScene.ts
│   ├── levels/
│   │   ├── index.ts                  ← lazy loader registry
│   │   ├── grid_03/index.json        ← 3 levels
│   │   ├── grid_04/index.json        ← 5 levels
│   │   └── ... grid_20/index.json   ← 358 levels
│   ├── storage/
│   │   └── GameStorage.ts
│   ├── analytics/
│   │   └── Analytics.ts
│   ├── ads/
│   │   ├── AdManager.ts
│   │   └── AdTriggers.ts
│   ├── audio/
│   │   └── AudioManager.ts
│   └── main.ts
├── scripts/
│   ├── generate-all-levels.ts        ← chạy 1 lần
│   └── validate-all-levels.ts
├── capacitor.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## 14. Roadmap 20 tuần

### Phase 1 — Core (Tuần 1–3)

**Tuần 1 — Setup & Grid Rendering**
- Ngày 1: Cài môi trường, tạo project
- Ngày 2: `types/index.ts` và `config.ts` — tạo đây trước tất cả
- Ngày 3: Phaser setup, vẽ lưới N×N tự scale theo màn hình (3×3 đến 20×20)
- Ngày 4: Render dots, load level từ JSON
- Ngày 5: Auto-zoom cho grids 15×15+ (`Phaser.Cameras.Scene2D`)
- Milestone: 3×3 và 20×20 đều hiển thị đúng, tự fit màn hình

**Tuần 2 — Input & Path Drawing**
- Ngày 1: `utils/MinHeap.ts`
- Ngày 2: `game/Grid.ts` — getCellAtPixel, neighbor lookup
- Ngày 3: `game/Path.ts` — addCell, shrinkPath, validation
- Ngày 4: Render đường realtime, conflict detection
- Ngày 5: `game/WinChecker.ts`
- Milestone: Vẽ đường được, win condition hoạt động

**Tuần 3 — Level System**
- Ngày 1–2: `generator/SeededRandom.ts`, level JSON format, loader
- Ngày 3: Scenes: GridSelect, LevelSelect cơ bản
- Ngày 4: `storage/GameStorage.ts` — save/load progress
- Ngày 5: Test end-to-end: load level → chơi → lưu progress
- Milestone: Chơi được 3 levels tạo tay, progress lưu

---

### Phase 2 — Generator (Tuần 4–6)

**Tuần 4 — Backtracking Solver**
- Ngày 1–2: `generator/steps/PlaceDots.ts`
- Ngày 3–4: `generator/steps/BuildSolution.ts` — Backtracking
- Ngày 5: Test: generate puzzle 5×5, verify manually
- Milestone: Backtracking tìm được solution cho grids 3×3–8×8

**Tuần 5 — Uniqueness & Difficulty**
- Ngày 1–2: `generator/steps/ValidateUnique.ts`
- Ngày 3: `generator/steps/ConstraintPropagator.ts`
- Ngày 4: `generator/DifficultyScorer.ts`
- Ngày 5: `generator/PuzzleGenerator.ts` — orchestrator
- Milestone: Generator tạo puzzle valid, có đúng 1 nghiệm, có difficulty score

**Tuần 6 — Generate 2305 levels**
- Ngày 1: `scripts/generate-all-levels.ts`
- Ngày 2–3: Chạy script, fix bugs
- Ngày 4: `scripts/validate-all-levels.ts` — xác nhận toàn bộ
- Ngày 5: Fix bất kỳ level failed validation
- Milestone: 2305 file JSON tồn tại, tất cả validated

---

### Phase 3 — Adaptive System (Tuần 7–8)

**Tuần 7 — Performance & Skill Tracking**
- Ngày 1–2: `adaptive/PerformanceScorer.ts` — công thức scoring
- Ngày 3–4: `adaptive/SkillTracker.ts` — EMA skill update
- Ngày 5: Unit tests cho cả 2 modules
- Milestone: Cho vào các session giả → skill tăng/giảm đúng

**Tuần 8 — Adaptive Engine**
- Ngày 1–2: `adaptive/AdaptiveEngine.ts` — level selection
- Ngày 3: Tích hợp vào GameScene: record session sau mỗi level
- Ngày 4: Test E2E: simulate 20 sessions → verify adaptation behavior
- Ngày 5: Edge cases: mới bắt đầu, master player, stuck player
- Milestone: Engine tự chọn level khó vừa cho mỗi user

---

### Phase 4 — Mechanics (Tuần 9–11)

**Tuần 9 — Wall, Mixer, Teleport**
- `game/MixerLogic.ts`
- Cập nhật Grid.ts: wall, mixer, teleport cells
- Cập nhật generator để place mechanics
- Regenerate grid_06, grid_07, grid_08

**Tuần 10 — Lock, Shaped Grid, Speed**
- Lock/unlock dependency system
- Shaped grid masks, disabled cells
- `game/TimerManager.ts`
- Regenerate grid_09, grid_10, grid_11

**Tuần 11 — Chain Mixer, Multi-Teleport, Gravity**
- Chain mixer logic
- Multi-teleport chains
- `game/GravityManager.ts`
- Regenerate grid_12, grid_13, grid_14

---

### Phase 5 — Hint Engine (Tuần 12)

**Tuần 12 — DFS + A* Hint Engine**
- Ngày 1–2: DFS solver cho grids ≤10×10
- Ngày 3–4: A* solver cho grids >10×10
- Ngày 5: Test: verify hint luôn đúng, không timeout
- Milestone: Hint luôn ra kết quả trong <500ms trên mọi grid size

---

### Phase 6 — Polish (Tuần 13–14)

**Tuần 13 — UI/UX**
- Main menu, GridSelect (18 grid sizes với progress bars)
- Level Select: stars, lock state, difficulty indicator
- In-game HUD: timer, moves, skill-adapted hint budget
- Win screen: stars, score, performance breakdown

**Tuần 14 — Audio, Haptics, Accessibility**
- `audio/AudioManager.ts` với Howler.js
- Haptic feedback
- Color blind mode: shapes trên dots
- Settings screen

---

### Phase 7 — Monetize & Ship (Tuần 15–20)

**Tuần 15 — Capacitor + AdMob**
- `npx cap add android`
- `ads/AdManager.ts` + `ads/AdTriggers.ts`
- Test trên thiết bị thật

**Tuần 16 — Firebase + Daily Challenge**
- `analytics/Analytics.ts` — track key events
- `game/DailySeed.ts` + DailyScene
- Streak system

**Tuần 17 — Pinch-to-Zoom**
- Camera controller cho grids 14×14+
- Pinch = zoom, swipe = pan khi đang zoom
- Double-tap = reset zoom

**Tuần 18 — Performance & Compatibility**
- 60fps trên Snapdragon 660
- Test API 26, 28, 30, 33
- Test màn hình 5", 6", 6.7"
- Profile memory: 20×20 grid không lag

**Tuần 19 — Store Assets & Beta**
- Icon, screenshots, store listing
- Build release APK
- Internal Testing track

**Tuần 20 — Launch**
- Production submit
- Marketing: Reddit, TikTok, Facebook
- Monitor day-1 data

---

## 15. Thứ tự tạo file

> Làm tuần tự từ 01 → 68. Không skip. Không tạo file N+1 trước khi file N xong và test.

```
=== PHASE 1: FOUNDATION ===
01. src/types/index.ts              ← ĐÂY TRƯỚC TIÊN — mọi file khác import từ đây
02. src/config.ts
03. src/utils/MinHeap.ts
04. public/index.html
05. src/main.ts
06. src/scenes/BootScene.ts
07. src/scenes/MenuScene.ts

=== PHASE 2: GAME CORE ===
08. src/game/Grid.ts
09. src/game/Path.ts
10. src/game/WinChecker.ts
11. src/scenes/GameScene.ts         ← import 08, 09, 10
12. src/storage/GameStorage.ts
13. src/scenes/GridSelectScene.ts
14. src/scenes/LevelSelectScene.ts
15. src/scenes/WinScene.ts

=== PHASE 3: GENERATOR ===
16. src/generator/SeededRandom.ts
17. src/generator/steps/PlaceDots.ts
18. src/generator/steps/BuildSolution.ts    ← Backtracking
19. src/generator/steps/ValidateUnique.ts
20. src/generator/steps/ConstraintPropagator.ts
21. src/generator/steps/PlaceMechanics.ts
22. src/generator/DifficultyScorer.ts
23. src/generator/DifficultyScaler.ts
24. src/generator/PuzzleGenerator.ts
25. scripts/generate-all-levels.ts
26. scripts/validate-all-levels.ts
27. src/levels/grid_03/index.json   ← generated by script
28. src/levels/grid_04/index.json
29. ...
44. src/levels/grid_20/index.json
45. src/levels/index.ts             ← lazy loader registry

=== PHASE 4: ADAPTIVE SYSTEM ===
46. src/adaptive/PerformanceScorer.ts
47. src/adaptive/SkillTracker.ts
48. src/adaptive/AdaptiveEngine.ts
49. Cập nhật GameScene.ts: gọi AdaptiveEngine

=== PHASE 5: MECHANICS ===
50. src/game/MixerLogic.ts
51. Cập nhật Grid.ts: wall, mixer, teleport, lock, shaped
52. src/game/TimerManager.ts
53. src/game/GravityManager.ts
54. Regenerate grid_06 → grid_20 với mechanics

=== PHASE 6: HINT ENGINE ===
55. src/game/HintEngine.ts          ← DFS + A*
56. Cập nhật GameScene.ts: tích hợp HintEngine

=== PHASE 7: POLISH ===
57. src/audio/AudioManager.ts
58. src/game/DailySeed.ts
59. src/scenes/DailyScene.ts
60. src/scenes/SettingsScene.ts
61. Cập nhật tất cả scenes: UI polish

=== PHASE 8: MONETIZE ===
62. capacitor.config.ts
63. src/ads/AdManager.ts
64. src/ads/AdTriggers.ts
65. src/analytics/Analytics.ts
66. Cập nhật GameScene.ts: AdTriggers + Analytics

=== PHASE 9: ADVANCED ===
67. src/game/CameraController.ts    ← pinch-to-zoom cho large grids
68. Cập nhật GameScene.ts: CameraController
```

---

## 16. Checklist Launch

### Algorithms
- [ ] Backtracking solver: test trên tất cả 18 grid sizes, không timeout
- [ ] Uniqueness validator: 100% trong 2305 levels có đúng 1 nghiệm
- [ ] DFS hint: test grids 3×3–10×10, luôn ra hint trong <200ms
- [ ] A* hint: test grids 11×11–20×20, luôn ra hint trong <500ms
- [ ] Adaptive engine: simulate 100 sessions, verify convergence

### Performance
- [ ] 60fps stable trên Snapdragon 660 (Android 8.0)
- [ ] 20×20 grid không lag khi vẽ đường
- [ ] Hint engine không block UI thread (chạy trong Web Worker nếu cần)
- [ ] Memory: không leak sau 30 phút chơi liên tục

### Technical
- [ ] Test API 26, 28, 30, 33
- [ ] Test màn hình 5", 6", 6.7"
- [ ] Pinch-to-zoom hoạt động với grids 14×14+
- [ ] Touch hit zone >= 14px dù ô nhỏ hơn
- [ ] Ads dùng REAL Ad Unit IDs
- [ ] Progress lưu đúng khi kill app

### Store
- [ ] App icon 512×512 PNG (không alpha)
- [ ] Feature graphic 1024×500 PNG
- [ ] 5 screenshots: Menu, GridSelect, 5×5 gameplay, 15×15 gameplay, Win
- [ ] Privacy Policy URL (bắt buộc vì AdMob + Firebase)
- [ ] Content rating đã điền
- [ ] Keystore backup ở 2+ nơi

---

*Version 3.0 — Bổ sung: Backtracking Solver, DFS/A* Hint Engine, Adaptive Difficulty System với EMA skill tracking, Constraint Propagation, Difficulty Scoring Formula tự động.*
*Model thực thi: bắt đầu từ file 01 trong mục 15, làm tuần tự, không skip bước.*
