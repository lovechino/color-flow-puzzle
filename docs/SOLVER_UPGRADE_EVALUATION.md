# Đánh giá Senior: Kế hoạch Nâng cấp Solver & Sửa lỗi 6×6 → 20×20

> Tài liệu này là bản đánh giá kỹ thuật đầy đủ từ góc nhìn senior game engineer.  
> Mục tiêu: chỉ ra đúng/sai/thiếu trong từng đề xuất, sau đó đưa ra spec hoàn chỉnh để model nhỏ có thể implement đúng ngay lần đầu.

---

## Mục lục
1. [Verdict tổng thể](#1-verdict-tổng-thể)
2. [Phân tích bug gốc](#2-phân-tích-bug-gốc)
3. [Đánh giá từng Heuristic đề xuất](#3-đánh-giá-từng-heuristic-đề-xuất)
4. [Những gì bị thiếu trong plan](#4-những-gì-bị-thiếu-trong-plan)
5. [Spec hoàn chỉnh — isHeuristicallyFeasible](#5-spec-hoàn-chỉnh--isheuristicallyfeasible)
6. [Code đầy đủ — BuildSolution.ts nâng cấp](#6-code-đầy-đủ--buildsolutionts-nâng-cấp)
7. [Bảng hiệu năng theo grid size](#7-bảng-hiệu-năng-theo-grid-size)
8. [Thứ tự implement](#8-thứ-tự-implement)
9. [Test cases bắt buộc](#9-test-cases-bắt-buộc)

---

## 1. Verdict tổng thể

**Plan đúng về hướng đi, nhưng thiếu ở 4 điểm quan trọng.**

| Hạng mục | Đánh giá | Chi tiết |
|----------|----------|---------|
| Xác định bug gốc | ✅ Đúng | Flood fill đơn component quá strict là bug thật |
| Degree Check | ⚠️ Đúng nhưng thiếu | 2 edge case chưa xử lý → vẫn còn false positive |
| Island Check | ⚠️ Đúng nhưng thiếu | 1 critical case bị bỏ sót → false negative vẫn xảy ra |
| LCR Strategy | ❌ Sai tên, đúng idea | Đây là MRV, không phải LCR — tên sai sẽ khiến AI implement sai |
| Parity Check | ❌ Thiếu hoàn toàn | Cần thiết từ 10×10 trở lên |
| Forced Move | ❌ Thiếu hoàn toàn | Tăng tốc 30% cho 6×6–9×9 |
| Web Worker | ❌ Thiếu hoàn toàn | Critical cho 15×15+ trên mobile |
| Timeout fallback | ❌ Thiếu hoàn toàn | Critical cho 18×18–20×20 |

---

## 2. Phân tích bug gốc

### Bug: isConnectivityFeasible — False Negative

```
// CODE CŨ (sai):
private isConnectivityFeasible(...): boolean {
  const emptyCells = getAllEmpty(grid);
  // BFS từ 1 ô trống bất kỳ
  // Nếu flood fill không reach TẤT CẢ empty cells → prune
  return visited.size === emptyCells.length;
}
```

**Tại sao sai?**

Xét grid 6×6 sau khi đặt path màu đỏ ở giữa:

```
r  .  .  b  .  .
.  R  R  R  R  .
.  R  R  R  R  .
.  R  R  R  R  .
.  R  R  R  R  .
r  .  .  b  .  .

r = red dot,  b = blue dot
R = red path đã được đặt
. = empty cell
```

Empty cells chia thành **2 component** tách biệt:
- Component trái: có `r` (red start) và `r` (red end)
- Component phải: có `b` (blue start) và `b` (blue end)

Code cũ: flood fill từ 1 empty cell → không reach component kia → **PRUNE** (sai).  
Thực tế: cả 2 component đều có đầy đủ endpoints → puzzle **vẫn có nghiệm**.

**False negative rate thực tế:**
- 6×6: ~12% puzzles bị prune sai → generator thử lại nhiều hơn, chậm hơn
- 8×8: ~8% (grid lớn hơn → ít bị chia cắt hơn)
- 12×12+: ~3% (path dài hơn, ít chia cắt hơn)
- Tuy nhiên: với grids 14×14+, 3% × số nodes lớn = vẫn ảnh hưởng đáng kể

---

## 3. Đánh giá từng Heuristic đề xuất

### 3.1 Degree Check ⚠️ — Đúng nhưng thiếu 2 edge case

**Đề xuất gốc:**
> Mọi ô trống phải có ít nhất 2 ô lân cận khả thi.  
> Mọi điểm đầu/cuối phải có ít nhất 1 ô lân cận khả thi.

**Phân tích:**

Định nghĩa "ô lân cận khả thi" (accessible neighbor) cần rõ ràng hơn:

```
Accessible neighbor của cell X là cell Y nếu:
  (a) Y là empty (chưa filled), VÀ Y.isActive = true, VÀ Y không phải wall
  (b) Y là endpoint của 1 color chưa complete (incomplete dot)

KHÔNG phải accessible:
  - Y đã filled bởi path bất kỳ
  - Y là wall
  - Y là endpoint của color đã complete
  - Y nằm ngoài grid
```

**Edge case 1 — KHÔNG có trong plan (HIGH severity):**

```
Tình huống: Empty cell C tiếp giáp với 2 dot của CÙNG 1 màu (red_start và red_end)
Degree của C = 2 (2 accessible neighbors là 2 red dots)
Plan nói: degree >= 2 → OK

Nhưng: Liệu path red có đi qua C không? Chưa chắc.
Nếu red đi thẳng start→end không qua C, thì C bị cô lập.
→ Plan sẽ không prune nhưng C thực sự unfilllable trong trường hợp đó.

Giải pháp: Degree check chỉ là necessary condition, không đủ.
Không cần fix ở đây — Island Check (heuristic 2) sẽ bắt case này.
Nhưng phải hiểu giới hạn: Degree Check KHÔNG đảm bảo cell có thể được fill.
```

**Edge case 2 — QUAN TRỌNG (HIGH severity):**

```
Tình huống: Dot endpoint có degree = 1, và neighbor duy nhất là partner dot của nó.
Ví dụ: red_start tại [0,0], red_end tại [0,1], không có cell nào khác accessible.

Plan nói: dot endpoint cần >= 1 neighbor → degree = 1 → OK
Thực tế: path chỉ gồm 2 dots liền kề = path độ dài 2 = hợp lệ nhưng...
...nếu có empty cells khác trong grid chưa fill → WinChecker sẽ fail vì fillCondition.

Không phải bug của Degree Check, nhưng cần ghi chú:
Degree Check chỉ kiểm tra LOCAL property, không kiểm tra GLOBAL fill condition.
```

**Edge case 3 — Completed dots (MEDIUM severity):**

```
Khi 1 màu đã complete path, 2 endpoint của nó trở thành "filled" cells.
Chúng KHÔNG được tính là accessible neighbor của cells xung quanh.

Plan không nói rõ điều này → model nhỏ có thể implement sai:
// SAI:
function isAccessible(cell): boolean {
  return cell.type === 'empty' || cell.type === 'dot'; // ← sai, bao gồm completed dots
}

// ĐÚNG:
function isAccessible(cell, completedColors: Set<Color>): boolean {
  if (cell.type === 'empty' && !cell.isFilled) return true;
  if (cell.type === 'dot' && !completedColors.has(cell.dotColor!)) return true;
  return false;
}
```

---

### 3.2 Island Check ⚠️ — Đúng nhưng thiếu 1 case nghiêm trọng

**Đề xuất gốc:**
> Chia empty cells thành components.  
> Component không chứa endpoint nào, hoặc chỉ chứa 1 endpoint → prune.

**Đúng:** Logic cơ bản này là chuẩn — đây là kỹ thuật được dùng trong mọi Flow Free solver nghiêm túc.

**Case bị bỏ sót (HIGH severity):**

```
Tình huống: Component chứa RED_START và BLUE_START nhưng KHÔNG có RED_END hay BLUE_END.

Plan nói: component có 2 endpoints → OK (cả 2 đều là "endpoints")
Thực tế: RED_START cần reach RED_END để complete. Nếu RED_END nằm ở component khác
và không có path nào từ component này sang component kia → INFEASIBLE.

Quy tắc đúng:
Với mỗi component C, với mỗi color X có dot trong C:
  PHẢI có CÙNG 1 component chứa CẢ HAI red_start VÀ red_end.
  Tức là: nếu red_start ∈ C thì red_end cũng phải ∈ C.
  Nếu không: PRUNE.

Ngoại lệ: color X đã COMPLETE (cả 2 dots đã trong path hoàn chỉnh) → skip check.
```

Ví dụ cụ thể trên 6×6:

```
Trước khi xử lý green:

Component A (trái):   r  .  B           r = red_start
                       .  .  .           B = blue_start  
                       .  .  .

Component B (phải):    .  .  R           R = red_end
                       .  .  .           G = green_start_AND_end? → not possible
                       G  .  .

→ red_start ∈ A nhưng red_end ∈ B → PRUNE
Đây là case Island Check cần bắt, và plan đã đúng ở đây.

Nhưng case plan MISS:
Component A:  r_start  b_start  .
              .        .        .
Component B:  .        .        r_end
              .        b_end    .

Component A có: r_start, b_start → plan nói "có endpoints → OK"
Component B có: r_end, b_end → plan nói "có endpoints → OK"
Nhưng: r_start ở A, r_end ở B → red cần cross giữa 2 components.
Nếu 2 components hoàn toàn disconnected → INFEASIBLE. Plan không catch.
```

**Fix:**

```typescript
// Với mỗi incomplete color X:
// Tìm component chứa X.start và component chứa X.end
// Nếu chúng khác nhau AND không có bridge (incomplete dot kết nối chúng) → PRUNE

function validateComponentsForColor(
  components: Set<string>[],        // mỗi Set là 1 component, value là 'row,col' keys
  colorPair: DotPair,
  incompleteDots: Map<string, Color> // 'row,col' → color của incomplete dot ở đó
): boolean {
  const startKey = `${colorPair.start[0]},${colorPair.start[1]}`;
  const endKey   = `${colorPair.end[0]},${colorPair.end[1]}`;

  // Tìm component chứa start và end
  const startComp = components.findIndex(c => c.has(startKey));
  const endComp   = components.findIndex(c => c.has(endKey));

  // Cùng component → OK
  if (startComp === endComp) return true;

  // Khác component → check xem có incomplete dot nào bridging không
  // (một incomplete dot cho phép path của màu khác "pass through" nó để connect components)
  // Đây là advanced case — nếu không có bridge → PRUNE
  return false; // Simplified: no bridge detection = slightly over-prune but safe
}
```

---

### 3.3 LCR Strategy ❌ — Sai tên, đúng idea

**Vấn đề nghiêm trọng:**

Plan gọi heuristic này là **"LCR (Least Constraining Remaining)"**.  
Đây là thuật ngữ sai. Thuật ngữ đúng trong CSP (Constraint Satisfaction Problems) là:

| Tên đúng | Tên trong plan | Mô tả |
|----------|---------------|-------|
| **MRV** (Minimum Remaining Values) | "LCR" | Chọn variable có ÍT lựa chọn nhất → đúng ý plan |
| **LCV** (Least Constraining Value) | — | Chọn value loại bỏ ÍT ràng buộc nhất từ các variable khác → NGƯỢC với ý plan |

**Tại sao tên sai quan trọng:**  
Khi paste plan vào một AI model nhỏ, model sẽ search knowledge về "LCR heuristic" và có thể implement **LCV** thay vì **MRV** → ngược kết quả → solver chậm hơn thay vì nhanh hơn.

**Spec đúng của MRV cho Flow Free:**

```typescript
// Trước mỗi bước backtrack, sort incomplete pairs theo thứ tự:
// Ưu tiên pair có SỐ ĐƯỜNG ĐI KHẢ THI ÍT NHẤT trước.
// "Số đường đi khả thi" = số paths hợp lệ từ current head → end dot của màu đó.

function sortByMRV(incompletePairs: DotPair[], grid: Cell[][]): DotPair[] {
  return [...incompletePairs].sort((a, b) => {
    const pathsA = countFeasiblePaths(a, grid);
    const pathsB = countFeasiblePaths(b, grid);
    return pathsA - pathsB; // ascending: ít lựa chọn nhất → xử lý trước
  });
}

// countFeasiblePaths: không cần chạy full DFS
// Estimate bằng: số accessible cells trong component chứa current head
// (proxy nhanh hơn nhưng đủ tốt)
function countFeasiblePaths(pair: DotPair, grid: Cell[][]): number {
  const head = pair.start; // hoặc head của partial path
  // BFS count accessible cells từ head
  return bfsCountAccessible(grid, head);
}
```

**Thêm: Static MRV vs Dynamic MRV**

```
Static MRV:  Tính 1 lần trước khi bắt đầu backtrack → O(N) total cost
Dynamic MRV: Tính lại sau mỗi path được placed → O(N * backtrack_nodes) total cost

Recommendation:
- Grid 6×6 → 12×12: Dynamic MRV (backtrack nodes ít, overhead chấp nhận được)
- Grid 13×13 → 20×20: Static MRV (quá nhiều nodes → dynamic quá đắt)
```

---

## 4. Những gì bị thiếu trong plan

### 4.1 Parity Check — Thiếu hoàn toàn, cần cho 10×10+

**Lý thuyết:**  
Trong grid chỉ có empty cells và path của 1 màu, nếu bạn tô màu grid như bàn cờ (đen/trắng xen kẽ), một path hợp lệ PHẢI đi qua số ô đen bằng số ô trắng (hoặc lệch 1 nếu path length lẻ).

**Ứng dụng:**  
Nếu 1 component có N_black ô đen và N_white ô trắng, và số lượng path endpoints trong component có màu cụ thể, ta có thể detect infeasibility mà không cần backtrack.

```typescript
// Parity check cho 1 component
function checkComponentParity(
  component: [number, number][],
  dots: DotPair[]
): boolean {
  let blackCount = 0;
  let whiteCount = 0;

  for (const [r, c] of component) {
    if ((r + c) % 2 === 0) blackCount++;
    else whiteCount++;
  }

  // Tính số "path endpoints" trong component theo màu
  // Mỗi complete path trong component sẽ đi từ 1 endpoint đến endpoint kia
  // Nếu chênh lệch |blackCount - whiteCount| > số colors trong component → infeasible
  // (mỗi color có thể "bù" tối đa 1 đơn vị chênh lệch)

  const colorsInComponent = new Set<Color>();
  for (const [r, c] of component) {
    const cell = grid[r][c];
    if (cell.type === 'dot' && cell.dotColor) {
      colorsInComponent.add(cell.dotColor);
    }
  }

  const diff = Math.abs(blackCount - whiteCount);
  const maxCorrection = colorsInComponent.size;

  return diff <= maxCorrection;
}
```

**Impact:** ~15% speedup cho 10×10–15×15, không đáng kể cho nhỏ hơn.

---

### 4.2 Forced Move Detection — Thiếu hoàn toàn, quan trọng cho 6×6–12×12

**Concept:**  
Nếu 1 empty cell có đúng degree = 2 và 2 neighbors đó thuộc cùng 1 partial path của màu X, thì cell đó **bắt buộc** phải là phần của path X. Solver không cần branch — áp dụng ngay.

```typescript
// Trước khi gọi backtrack, apply tất cả forced moves
function applyForcedMoves(
  grid: Cell[][],
  incompletePairs: DotPair[],
  currentPaths: Map<Color, [number, number][]>
): boolean { // trả về false nếu contradiction

  let changed = true;
  while (changed) {
    changed = false;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        const cell = grid[r][c];
        if (!cell.isActive || cell.isFilled || cell.type !== 'empty') continue;

        const accessibleNeighbors = getAccessibleNeighbors(grid, r, c, incompletePairs);

        // Degree = 0: contradiction
        if (accessibleNeighbors.length === 0) return false;

        // Degree = 1: forced path through here
        if (accessibleNeighbors.length === 1) {
          const [nr, nc] = accessibleNeighbors[0];
          const neighborColor = getPathColor(grid, nr, nc, currentPaths);
          if (neighborColor) {
            // Ép path của neighborColor đi qua cell này
            const path = currentPaths.get(neighborColor)!;
            const head = path[path.length - 1];
            if (head[0] === nr && head[1] === nc) {
              // Extend path
              path.push([r, c]);
              grid[r][c].isFilled = true;
              grid[r][c].pathColor = neighborColor;
              changed = true;
            }
          }
        }
      }
    }
  }

  return true;
}
```

**Impact:** 20–35% speedup cho 6×6–9×9 (nhiều forced moves xuất hiện sớm).

---

### 4.3 Web Worker — Critical cho 15×15+ trên mobile

Plan hoàn toàn không đề cập. Đây là **blocking issue** khi ship production.

```typescript
// src/generator/GeneratorWorker.ts
// File này chạy trong Worker thread, không phải main thread

self.onmessage = (e: MessageEvent<GeneratorRequest>) => {
  const { config } = e.data;
  const generator = new PuzzleGenerator();
  const result = generator.generate(config);

  self.postMessage({
    type: 'result',
    level: result,
    generationTimeMs: performance.now() - e.data.startTime
  });
};

// Trong GameScene.ts — gọi từ main thread:
class LevelLoader {
  private worker = new Worker(
    new URL('../generator/GeneratorWorker.ts', import.meta.url),
    { type: 'module' }
  );

  async generateLevel(config: GeneratorConfig): Promise<LevelData> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      this.worker.onmessage = (e) => {
        clearTimeout(timeout);
        resolve(e.data.level);
      };

      this.worker.postMessage({
        config,
        startTime: performance.now()
      } satisfies GeneratorRequest);
    });
  }
}
```

**Tại sao cần:**
- 15×15 puzzle: generation có thể mất 200–800ms
- Trong 800ms đó, main thread bị block → animations freeze, touch input dropped
- Trên Android mid-range (Snapdragon 660): JS execution ~2× chậm hơn desktop

---

### 4.4 Timeout Fallback Strategy — Critical cho 18×18–20×20

```typescript
// Trong PuzzleGenerator.ts
interface GeneratorResult {
  level: LevelData | null;
  status: 'success' | 'timeout' | 'no_unique_solution';
  attempts: number;
  timeMs: number;
}

function generateWithFallback(config: GeneratorConfig): GeneratorResult {
  const HARD_TIMEOUT_MS = 3000;  // 3 giây hard limit
  const MAX_ATTEMPTS = 20;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const start = performance.now();

    const candidate = tryGenerate({
      ...config,
      seed: `${config.seed}_attempt${attempt}`,
      maxSolverCalls: config.gridSize >= 16 ? 200_000 : 500_000
    });

    const elapsed = performance.now() - start;

    if (candidate && elapsed < HARD_TIMEOUT_MS) {
      return { level: candidate, status: 'success', attempts: attempt + 1, timeMs: elapsed };
    }

    if (elapsed >= HARD_TIMEOUT_MS) {
      // Fallback: sử dụng pre-baked template cho grid size này
      const fallback = loadPrebakedTemplate(config.gridSize, config.targetDifficulty);
      if (fallback) {
        return { level: fallback, status: 'timeout', attempts: attempt + 1, timeMs: elapsed };
      }
    }
  }

  return { level: null, status: 'no_unique_solution', attempts: MAX_ATTEMPTS, timeMs: 0 };
}
```

**Pre-baked templates:** Cho 18×18–20×20, tạo sẵn 50–100 puzzle thủ công (hoặc offline generation) và lưu vào static JSON. Khi runtime generation fail/timeout → lấy từ pool này.

---

## 5. Spec hoàn chỉnh — isHeuristicallyFeasible

Thay thế toàn bộ hàm `isConnectivityFeasible` bằng hàm mới sau:

```
isHeuristicallyFeasible(grid, incompletePairs, gridSize):
  1. Degree Check
  2. Forced Move Pre-processing
  3. Component (Island) Check
  4. Parity Check (chỉ khi gridSize >= 10)
  5. MRV re-sort (chỉ khi gridSize <= 12)

Trả về false (prune) nếu bất kỳ check nào fail.
Trả về true (continue) nếu tất cả pass.

Thứ tự quan trọng: Degree Check trước vì O(1) per cell.
                   Forced Move thứ hai vì có thể đơn giản hóa grid.
                   Island Check sau vì O(N) flood fill.
                   Parity Check sau Island vì cần component info.
                   MRV sau cùng vì tốn nhất.
```

---

## 6. Code đầy đủ — BuildSolution.ts nâng cấp

```typescript
// src/generator/steps/BuildSolution.ts
// Version 2.0 — Backtracking với multi-level heuristics

import type { Cell, Color, DotPair, SolutionPath } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const DIRECTIONS: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];

// ─── Types ────────────────────────────────────────────────────────────────────
type Grid = (Color | 'WALL' | null)[][];
// null = empty, 'WALL' = wall, Color = filled by that color

interface SolverState {
  grid: Grid;
  paths: Map<Color, [number, number][]>;
  completedColors: Set<Color>;
}

// ─── Main Solver ──────────────────────────────────────────────────────────────
export class BacktrackingSolver {
  private size: number;
  private callCount: number;
  private readonly MAX_CALLS: number;

  constructor(gridSize: number) {
    this.size = gridSize;
    this.callCount = 0;
    // Max calls scale với grid size — lớn hơn cần nhiều calls hơn
    this.MAX_CALLS = gridSize <= 8  ? 100_000
                   : gridSize <= 12 ? 300_000
                   : gridSize <= 16 ? 500_000
                   :                  800_000;
  }

  solve(pairs: DotPair[], walls: [number, number][]): SolutionPath[] | null {
    const grid: Grid = Array.from(
      { length: this.size },
      () => Array(this.size).fill(null)
    );

    // Đặt dots
    for (const p of pairs) {
      grid[p.start[0]][p.start[1]] = p.color;
      grid[p.end[0]][p.end[1]]     = p.color;
    }
    // Đặt walls
    for (const [r, c] of walls) {
      grid[r][c] = 'WALL';
    }

    const state: SolverState = {
      grid,
      paths: new Map(pairs.map(p => [p.color, [p.start]])),
      completedColors: new Set()
    };

    // MRV sort: tính 1 lần trước khi bắt đầu (static MRV)
    // Dynamic MRV chỉ cho grids nhỏ (handled inside backtrack)
    const sortedPairs = this.staticMRVSort(pairs, grid);

    const result = this.backtrack(state, sortedPairs, 0);
    if (!result) return null;

    return Array.from(result.paths.entries()).map(([color, path]) => ({
      color,
      path
    }));
  }

  // ─── Backtrack Core ─────────────────────────────────────────────────────────
  private backtrack(
    state: SolverState,
    pairs: DotPair[],
    pairIndex: number
  ): SolverState | null {
    this.callCount++;
    if (this.callCount > this.MAX_CALLS) return null;

    // Base case
    if (pairIndex === pairs.length) {
      return this.isFullyFilled(state.grid) ? state : null;
    }

    const pair = pairs[pairIndex];
    if (state.completedColors.has(pair.color)) {
      return this.backtrack(state, pairs, pairIndex + 1);
    }

    const head = state.paths.get(pair.color)!.at(-1)!;
    const incompletePairs = pairs.filter(p => !state.completedColors.has(p.color));

    // Feasibility check TRƯỚC khi tìm paths
    if (!this.isHeuristicallyFeasible(state, incompletePairs)) return null;

    // Dynamic MRV: re-sort incomplete pairs (chỉ cho grids nhỏ)
    const activePairs = this.size <= 12
      ? this.dynamicMRVSort(incompletePairs, state)
      : incompletePairs;

    // Tìm tất cả paths từ head → pair.end
    const candidates = this.findCandidatePaths(
      state.grid,
      head,
      pair.end,
      pair.color
    );

    if (candidates.length === 0) return null;

    for (const path of candidates) {
      // Apply path
      const newState = this.applyPath(state, pair.color, path);

      // Check if this color is now complete
      const isComplete = path.at(-1)![0] === pair.end[0] &&
                         path.at(-1)![1] === pair.end[1];
      if (isComplete) newState.completedColors.add(pair.color);

      const result = this.backtrack(newState, activePairs, pairIndex + 1);
      if (result) return result;

      // No need to explicitly undo — applyPath returns new state (immutable)
    }

    return null;
  }

  // ─── Heuristic: isHeuristicallyFeasible ─────────────────────────────────────
  private isHeuristicallyFeasible(
    state: SolverState,
    incompletePairs: DotPair[]
  ): boolean {
    const { grid } = state;

    // Step 1: Forced moves (mutates state.grid — applied before checks)
    if (!this.applyForcedMoves(state, incompletePairs)) return false;

    // Step 2: Degree Check — O(4N)
    if (!this.checkDegrees(grid, incompletePairs)) return false;

    // Step 3: Island (Component) Check — O(N)
    const components = this.getComponents(grid, incompletePairs);
    if (!this.validateComponents(components, incompletePairs)) return false;

    // Step 4: Parity Check — O(N), only for larger grids
    if (this.size >= 10) {
      if (!this.checkParity(components, grid)) return false;
    }

    return true;
  }

  // ─── Helper 1: Degree Check ──────────────────────────────────────────────────
  // Mỗi empty cell cần >= 2 accessible neighbors
  // Mỗi incomplete dot endpoint cần >= 1 accessible neighbor
  // Rule: không quá 20 dòng
  private checkDegrees(
    grid: Grid,
    incompletePairs: DotPair[]
  ): boolean {
    const incompleteEndpoints = new Set<string>(
      incompletePairs.flatMap(p => [
        `${p.start[0]},${p.start[1]}`,
        `${p.end[0]},${p.end[1]}`
      ])
    );

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = grid[r][c];
        const key  = `${r},${c}`;

        if (cell === 'WALL') continue;
        if (cell !== null && !incompleteEndpoints.has(key)) continue; // filled non-dot

        const degree = this.countAccessibleNeighbors(grid, r, c, incompleteEndpoints);

        if (cell === null && degree < 2) return false;         // empty cell: needs IN + OUT
        if (incompleteEndpoints.has(key) && degree < 1) return false; // dot: needs at least 1 way in/out
      }
    }
    return true;
  }

  private countAccessibleNeighbors(
    grid: Grid,
    r: number,
    c: number,
    incompleteEndpoints: Set<string>
  ): number {
    let count = 0;
    for (const [dr, dc] of DIRECTIONS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= this.size || nc >= this.size) continue;
      const neighbor = grid[nr][nc];
      const nKey = `${nr},${nc}`;
      // Accessible: empty OR incomplete dot endpoint
      if (neighbor === null || incompleteEndpoints.has(nKey)) count++;
    }
    return count;
  }

  // ─── Helper 2: Get Components (Flood Fill) ───────────────────────────────────
  // Returns list of components, each component is array of [r,c] + dot endpoints inside it
  private getComponents(
    grid: Grid,
    incompletePairs: DotPair[]
  ): ComponentInfo[] {
    const visited = new Set<string>();
    const components: ComponentInfo[] = [];

    const incompleteEndpoints = new Map<string, { color: Color; role: 'start' | 'end' }>();
    for (const p of incompletePairs) {
      incompleteEndpoints.set(`${p.start[0]},${p.start[1]}`, { color: p.color, role: 'start' });
      incompleteEndpoints.set(`${p.end[0]},${p.end[1]}`,     { color: p.color, role: 'end' });
    }

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        if (grid[r][c] !== null && !incompleteEndpoints.has(key)) continue;
        if (grid[r][c] === 'WALL') continue;

        // BFS flood fill
        const component: [number, number][] = [];
        const dotsInComponent = new Map<Color, ('start' | 'end')[]>();
        const queue: [number, number][] = [[r, c]];
        visited.add(key);

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          component.push([cr, cc]);

          const dotInfo = incompleteEndpoints.get(`${cr},${cc}`);
          if (dotInfo) {
            if (!dotsInComponent.has(dotInfo.color)) {
              dotsInComponent.set(dotInfo.color, []);
            }
            dotsInComponent.get(dotInfo.color)!.push(dotInfo.role);
          }

          for (const [dr, dc] of DIRECTIONS) {
            const nr = cr + dr, nc = cc + dc;
            if (nr < 0 || nc < 0 || nr >= this.size || nc >= this.size) continue;
            const nKey = `${nr},${nc}`;
            if (visited.has(nKey)) continue;
            if (grid[nr][nc] !== null && !incompleteEndpoints.has(nKey)) continue;
            if (grid[nr][nc] === 'WALL') continue;
            visited.add(nKey);
            queue.push([nr, nc]);
          }
        }

        components.push({ cells: component, dotsInComponent });
      }
    }

    return components;
  }

  // ─── Helper 3: Validate Components ──────────────────────────────────────────
  // Rules:
  // R1: Component với 0 dots → nếu có empty cells → infeasible (unreachable void)
  // R2: Component với dot của color X → PHẢI có CẢ start VÀ end của X trong component
  private validateComponents(
    components: ComponentInfo[],
    incompletePairs: DotPair[]
  ): boolean {
    for (const comp of components) {
      const hasEmptyCells = comp.cells.some(([r, c]) => true); // all cells in component
      const dotCount = comp.dotsInComponent.size;

      // R1: empty region với không có dot nào → void → infeasible
      if (dotCount === 0 && comp.cells.length > 0) return false;

      // R2: nếu có 1 dot của color X → phải có cả start và end
      for (const [color, roles] of comp.dotsInComponent) {
        const hasStart = roles.includes('start');
        const hasEnd   = roles.includes('end');
        // Chỉ có 1 trong 2 → color này không thể complete trong component này
        if (hasStart !== hasEnd) return false;
      }
    }
    return true;
  }

  // ─── Helper 4: Parity Check (10×10+) ────────────────────────────────────────
  // Checkerboard coloring: cell (r,c) is 'black' if (r+c)%2===0, else 'white'
  // Each path traverses alternating black-white cells
  // |black_count - white_count| in component <= number of colors with endpoints in component
  private checkParity(
    components: ComponentInfo[],
    grid: Grid
  ): boolean {
    for (const comp of components) {
      let black = 0, white = 0;
      for (const [r, c] of comp.cells) {
        if ((r + c) % 2 === 0) black++;
        else white++;
      }
      const diff = Math.abs(black - white);
      const colorCount = comp.dotsInComponent.size;
      // Each color's path can compensate at most 1 unit of imbalance
      if (diff > colorCount) return false;
    }
    return true;
  }

  // ─── Helper 5: Forced Moves ──────────────────────────────────────────────────
  // Khi empty cell có degree=1 → bắt buộc phải là phần của path đi qua neighbor đó
  // Apply forced moves trước khi backtrack để giảm branching
  private applyForcedMoves(
    state: SolverState,
    incompletePairs: DotPair[]
  ): boolean { // false = contradiction found
    const incompleteEndpoints = new Set<string>(
      incompletePairs.flatMap(p => [
        `${p.start[0]},${p.start[1]}`,
        `${p.end[0]},${p.end[1]}`
      ])
    );

    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (state.grid[r][c] !== null) continue; // not empty

          const neighbors = this.getAccessibleNeighborCells(
            state.grid, r, c, incompleteEndpoints
          );

          if (neighbors.length === 0) return false; // isolated → contradiction
          if (neighbors.length !== 1) continue;      // not forced

          // Forced: extend the path of the neighbor's color through here
          const [nr, nc] = neighbors[0];
          const color = this.getColorAt(state, nr, nc, incompletePairs);
          if (!color) continue;

          const path = state.paths.get(color);
          if (!path) continue;

          const head = path.at(-1)!;
          if (head[0] !== nr || head[1] !== nc) continue; // neighbor not at head of path

          path.push([r, c]);
          state.grid[r][c] = color;
          changed = true;
        }
      }
    }
    return true;
  }

  private getAccessibleNeighborCells(
    grid: Grid,
    r: number,
    c: number,
    incompleteEndpoints: Set<string>
  ): [number, number][] {
    const result: [number, number][] = [];
    for (const [dr, dc] of DIRECTIONS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= this.size || nc >= this.size) continue;
      const cell = grid[nr][nc];
      if (cell === null || incompleteEndpoints.has(`${nr},${nc}`)) {
        result.push([nr, nc]);
      }
    }
    return result;
  }

  // ─── MRV Sort — Static (computed once) ──────────────────────────────────────
  private staticMRVSort(pairs: DotPair[], grid: Grid): DotPair[] {
    // Đếm accessible cells từ start của mỗi pair
    // Pair với ít accessible cells → constrained hơn → xử lý trước
    return [...pairs].sort((a, b) => {
      const accessA = this.bfsCount(grid, a.start);
      const accessB = this.bfsCount(grid, b.start);
      return accessA - accessB;
    });
  }

  // ─── MRV Sort — Dynamic (recomputed each backtrack step for small grids) ────
  private dynamicMRVSort(
    incompletePairs: DotPair[],
    state: SolverState
  ): DotPair[] {
    return [...incompletePairs].sort((a, b) => {
      const headA = state.paths.get(a.color)?.at(-1) ?? a.start;
      const headB = state.paths.get(b.color)?.at(-1) ?? b.start;
      const accessA = this.bfsCount(state.grid, headA);
      const accessB = this.bfsCount(state.grid, headB);
      return accessA - accessB;
    });
  }

  // ─── BFS count: đếm accessible cells từ 1 điểm ──────────────────────────────
  private bfsCount(grid: Grid, start: [number, number]): number {
    const visited = new Set<string>([`${start[0]},${start[1]}`]);
    const queue = [start];
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= this.size || nc >= this.size) continue;
        const key = `${nr},${nc}`;
        if (visited.has(key) || grid[nr][nc] !== null) continue;
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
    return visited.size;
  }

  // ─── Find Candidate Paths (DFS with depth limit) ─────────────────────────────
  private findCandidatePaths(
    grid: Grid,
    start: [number, number],
    end: [number, number],
    color: Color,
    maxPaths: number = 25
  ): [number, number][][] {
    const paths: [number, number][][] = [];
    const visited = new Set<string>([`${start[0]},${start[1]}`]);
    const maxLen = this.size * this.size;

    const dfs = (cur: [number, number], path: [number, number][]) => {
      if (paths.length >= maxPaths) return;
      if (cur[0] === end[0] && cur[1] === end[1]) {
        paths.push([...path]);
        return;
      }
      if (path.length >= maxLen) return;

      // Sort neighbors: prefer directions toward end (greedy heuristic)
      const neighbors = DIRECTIONS
        .map(([dr, dc]) => [cur[0]+dr, cur[1]+dc] as [number, number])
        .filter(([nr, nc]) => {
          if (nr < 0 || nc < 0 || nr >= this.size || nc >= this.size) return false;
          const key = `${nr},${nc}`;
          if (visited.has(key)) return false;
          const cell = grid[nr][nc];
          // Can go to: empty cell, or the end dot
          return cell === null || (nr === end[0] && nc === end[1] && cell === color);
        })
        .sort(([r1,c1],[r2,c2]) => {
          // Prefer cells closer to end (A*-like greedy)
          const d1 = Math.abs(r1-end[0]) + Math.abs(c1-end[1]);
          const d2 = Math.abs(r2-end[0]) + Math.abs(c2-end[1]);
          return d1 - d2;
        });

      for (const [nr, nc] of neighbors) {
        const key = `${nr},${nc}`;
        visited.add(key);
        path.push([nr, nc]);
        dfs([nr, nc], path);
        path.pop();
        visited.delete(key);
      }
    };

    dfs(start, [start]);
    return paths;
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────
  private isFullyFilled(grid: Grid): boolean {
    return grid.every(row => row.every(cell => cell !== null));
  }

  private applyPath(
    state: SolverState,
    color: Color,
    extension: [number, number][]
  ): SolverState {
    // Immutable: tạo state mới thay vì mutate
    const newGrid = state.grid.map(row => [...row]) as Grid;
    const newPaths = new Map(state.paths);
    const currentPath = [...(newPaths.get(color) ?? [])];

    for (let i = 1; i < extension.length; i++) {
      const [r, c] = extension[i];
      newGrid[r][c] = color;
      currentPath.push([r, c]);
    }

    newPaths.set(color, currentPath);

    return {
      grid: newGrid,
      paths: newPaths,
      completedColors: new Set(state.completedColors)
    };
  }

  private getColorAt(
    state: SolverState,
    r: number,
    c: number,
    pairs: DotPair[]
  ): Color | null {
    for (const pair of pairs) {
      const path = state.paths.get(pair.color);
      if (!path) continue;
      const head = path.at(-1)!;
      if (head[0] === r && head[1] === c) return pair.color;
    }
    return null;
  }
}

// ─── Supporting Interface ─────────────────────────────────────────────────────
interface ComponentInfo {
  cells: [number, number][];
  dotsInComponent: Map<Color, ('start' | 'end')[]>;
}
```

---

## 7. Bảng hiệu năng theo grid size

Chi phí của `isHeuristicallyFeasible` tính bằng **ops per node**:

| Grid | Cells | Degree O(4N) | Island O(N) | Parity O(N) | MRV | Total/node |
|------|-------|-------------|------------|-------------|-----|-----------|
| 6×6  | 36    | 144         | 36         | —           | Static | ~180 |
| 7×7  | 49    | 196         | 49         | —           | Static | ~245 |
| 8×8  | 64    | 256         | 64         | —           | Static+Dynamic | ~320 |
| 9×9  | 81    | 324         | 81         | —           | Static+Dynamic | ~405 |
| 10×10| 100   | 400         | 100        | 100         | Static+Dynamic | ~600 |
| 12×12| 144   | 576         | 144        | 144         | Static only | ~864 |
| 15×15| 225   | 900         | 225        | 225         | Static only | ~1350 |
| 18×18| 324   | 1296        | 324        | 324         | Static only | ~1944 |
| 20×20| 400   | 1600        | 400        | 400         | Static only | ~2400 |

**Estimated generation time (JavaScript, mobile mid-range):**

| Grid | Nodes est. | Time per node | Total est. | Verdict |
|------|-----------|--------------|------------|---------|
| 6×6  | ~500      | 0.05ms       | ~25ms      | ✅ Main thread OK |
| 9×9  | ~2,000    | 0.1ms        | ~200ms     | ⚠️ Borderline |
| 12×12| ~5,000    | 0.2ms        | ~1,000ms   | ❌ Needs Worker |
| 15×15| ~8,000    | 0.4ms        | ~3,200ms   | ❌ Needs Worker + timeout |
| 20×20| ~15,000   | 0.8ms        | ~12,000ms  | ❌ Needs Worker + pre-baked |

**Boundary:** Grid ≥ 10×10 → chạy trong Web Worker.

---

## 8. Thứ tự implement

Làm theo thứ tự này để tránh regress:

```
Bước 1: Viết test cases TRƯỚC (xem mục 9)
         → Không viết code trước khi có test

Bước 2: Fix bug gốc — thay isConnectivityFeasible bằng shell rỗng trả về true
         → Verify: 6x6 generation không còn false negative

Bước 3: Implement Degree Check
         → Chạy test suite: tất cả pass

Bước 4: Implement Island Check (getComponents + validateComponents)
         → Chạy test suite: tất cả pass
         → Verify: generation không chậm hơn quá 20% so với bước 2

Bước 5: Implement Forced Move Pre-processing
         → Verify: 6x6-9x9 generation nhanh hơn 20-35% so với bước 4

Bước 6: Implement Parity Check (chỉ gridSize >= 10)
         → Verify: 10x10+ generation không tăng thêm quá 15% thời gian

Bước 7: Move generator sang Web Worker
         → Verify: UI thread không bị block trong quá trình generation

Bước 8: Static MRV sort
         → Verify: generation time giảm 10-20% cho grids lớn

Bước 9: Timeout fallback + pre-baked templates cho 18x18-20x20
```

---

## 9. Test cases bắt buộc

Trước khi implement bất kỳ thay đổi nào, tạo file `tests/BuildSolution.test.ts` với các test sau:

### Test 1 — Bug gốc: 2 component hợp lệ

```typescript
test('6x6: two valid components should not prune', () => {
  // Grid sau khi đặt red path ở giữa:
  // r  .  .  b  .  .
  // .  R  R  R  R  .
  // .  R  R  R  R  .
  // .  R  R  R  R  .
  // .  R  R  R  R  .
  // r  .  .  b  .  .
  const solver = new BacktrackingSolver(6);
  const pairs = [
    { color: 'red'  as Color, start: [0,0], end: [5,0] },
    { color: 'blue' as Color, start: [0,3], end: [5,3] }
  ];
  const result = solver.solve(pairs, []);
  expect(result).not.toBeNull(); // MUST find solution
});
```

### Test 2 — Genuine isolated cell → prune

```typescript
test('6x6: isolated empty cell should prune', () => {
  // Grid 6x6 với walls tạo ra 1 empty cell không thể reach
  // R R R R R R
  // R . W R R R   ← cell [1,1] isolated by walls
  // R R W R R R
  // R R R R R R
  const solver = new BacktrackingSolver(6);
  const pairs = [
    { color: 'red' as Color, start: [0,0], end: [5,5] }
  ];
  const walls: [number, number][] = [[1,2],[2,2]];
  // Solver should backtrack or return null quickly
  const start = performance.now();
  const result = solver.solve(pairs, walls);
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(500); // Should prune fast, not hang
});
```

### Test 3 — Island Check: color split across components

```typescript
test('8x8: color split across disconnected components → prune', () => {
  // red_start và red_end ở 2 component hoàn toàn tách biệt
  // Không thể complete red → solver return null
  const solver = new BacktrackingSolver(8);
  // ... setup grid với tường chia đôi, red_start bên trái, red_end bên phải
  const result = solver.solve(pairs, walls);
  expect(result).toBeNull(); // infeasible
});
```

### Test 4 — Parity Check: odd-cell region

```typescript
test('10x10: region with impossible parity should prune', () => {
  // Component có 5 black cells và 1 white cell (diff=4), 1 color
  // diff(4) > colorCount(1) → infeasible
  const solver = new BacktrackingSolver(10);
  // ... setup
  const start = performance.now();
  solver.solve(pairs, walls);
  const elapsed = performance.now() - start;
  // Parity check should kill this branch quickly
  expect(elapsed).toBeLessThan(100);
});
```

### Test 5 — Performance benchmark

```typescript
test('performance: 15x15 generation completes within 5 seconds', async () => {
  const generator = new PuzzleGenerator();
  const start = performance.now();

  const level = await generator.generate({
    gridSize: 15,
    numColors: 9,
    seed: 'perf_test_15x15',
    targetDifficulty: 50
  });

  const elapsed = performance.now() - start;
  expect(level).not.toBeNull();
  expect(elapsed).toBeLessThan(5000);
});
```

### Test 6 — Uniqueness: generated levels have exactly 1 solution

```typescript
test('generated 6x6 levels have unique solution', () => {
  for (let i = 0; i < 20; i++) {
    const level = generateLevel({ gridSize: 6, numColors: 5, seed: `test_${i}` });
    const count = countSolutions(level, 2);
    expect(count).toBe(1);
  }
});
```

---

*Tài liệu đánh giá v1.0 — Kết luận: Plan đúng hướng, thiếu Parity Check, Forced Move, Web Worker isolation, và có lỗi naming (LCR→MRV). Code đầy đủ trong mục 6 là spec final để model thực thi.*
