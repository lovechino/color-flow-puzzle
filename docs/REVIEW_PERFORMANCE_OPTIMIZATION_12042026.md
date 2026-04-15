# Review Senior: Performance Optimization Plan — Large Grid Generation

**Ngày review:** 12/04/2026  
**Tài liệu được review:** Performance Optimization Plan (15×15 – 20×20)  
**Reviewer:** Senior Engineer

\---

## Verdict tổng thể

> \*\*5 trong 6 thay đổi hoàn toàn an toàn và không ảnh hưởng game.\*\*  
> \*\*1 thay đổi có rủi ro nghiêm trọng ảnh hưởng trực tiếp đến chất lượng và độ khó puzzle.\*\*

|Thay đổi|Ảnh hưởng game?|Mức rủi ro|Verdict|
|-|-|-|-|
|`Uint8Array` grid|❌ Không|🟡 MEDIUM|✅ Proceed — cẩn thận color mapping|
|Mutable state + Undo|❌ Không|🟡 MEDIUM|✅ Proceed — undo phải chính xác tuyệt đối|
|Dynamic MRV|❌ Không|🟢 LOW|✅ Proceed ngay|
|Wall-hugging sort|❌ Không|🟢 LOW|✅ Proceed ngay|
|**ValidateUnique dùng Solver**|**✅ CÓ**|**🔴 HIGH**|**⚠️ Cần fix trước khi implement**|
|Worker Pool|❌ Không|🟢 LOW|✅ Proceed — nhưng sau algorithm opt|

\---

## Mục lục

1. [Thay đổi 1: Uint8Array](#1-uint8array--pure-performance-không-ảnh-hưởng-game)
2. [Thay đổi 2: Mutable State + Undo](#2-mutable-state--undo--đúng-hướng-nhưng-cần-cẩn-thận)
3. [Thay đổi 3: Dynamic MRV](#3-dynamic-mrv--an-toàn-hoàn-toàn)
4. [Thay đổi 4: Wall-hugging sort](#4-wall-hugging-sort--an-toàn-hoàn-toàn)
5. [Thay đổi 5: ValidateUnique dùng Solver — RỦI RO CAO](#5-validateunique-dùng-solver--rủi-ro-cao-ảnh-hưởng-game)
6. [Thay đổi 6: Worker Pool](#6-worker-pool--an-toàn-nhưng-ưu-tiên-thấp)
7. [Trả lời Open Questions](#7-trả-lời-open-questions)
8. [Thứ tự implement an toàn](#8-thứ-tự-implement-an-toàn)

\---

## 1\. Uint8Array — Pure performance, không ảnh hưởng game

### Tại sao nhanh hơn

Vấn đề hiện tại với `string\[]\[]` là **cache locality**. Mỗi ô trong `string\[]\[]` là một pointer trỏ đến object JavaScript ở đâu đó trong heap. Khi solver đọc 4 neighbors của 1 ô, CPU phải chase 4 pointer khác nhau → cache miss liên tục.

`Uint8Array` lưu tất cả ô liền kề nhau trong bộ nhớ:

```
Memory layout string\[]\[]  →  grid\[0]\[0], grid\[0]\[1], grid\[0]\[2]...
  \[ptr1] \[ptr2] \[ptr3]...       ↓        ↓        ↓
     ↓     ↓     ↓           \[obj ở   \[obj ở   \[obj ở
  \[heap] \[heap] \[heap]       0x1000]  0x4200]  0x8800]  ← scattered
  
Memory layout Uint8Array  →  \[0, 1, 2, 3, 4, 5, 6...] ← sequential
  Solver reads 4 neighbors: 1 cache line = 64 bytes = covers all of them
```

|Grid|`string\[]\[]` cache lines|`Uint8Array` cache lines|Speedup est.|
|-|-|-|-|
|10×10|25|2|2–3×|
|15×15|57|4|3–5×|
|20×20|100|7|4–6×|

### Color mapping — cần làm đúng một lần

```typescript
// ✅ ĐÚNG: const enum — TypeScript inline tại compile time, zero runtime cost
export const enum ColorId {
  EMPTY = 0,
  RED   = 1, BLUE   = 2, GREEN  = 3, YELLOW  = 4,  ORANGE = 5,
  PURPLE = 6, CYAN  = 7, PINK   = 8, BROWN   = 9,  WHITE  = 10,
  LIME  = 11, MAGENTA = 12, TEAL = 13, GOLD   = 14, NAVY   = 15,
  WALL  = 255
  // Uint8Array max = 255. 15 màu + WALL = 17 values. Dư dả.
}

// Helper functions — không dùng Map trong hot path
export const COLOR\_NAMES: Record<ColorId, string> = {
  \[ColorId.EMPTY]:   'empty',
  \[ColorId.RED]:     'red',
  // ... 
  \[ColorId.WALL]:    'WALL',
};

// Chuyển đổi chỉ khi I/O (đọc JSON, ghi JSON) — không trong solver loop
export function colorStringToId(color: string): ColorId {
  const idx = COLOR\_LIST.indexOf(color as Color);
  return idx >= 0 ? (idx + 1) as ColorId : ColorId.EMPTY;
}
```

```typescript
// ❌ SAI: Map lookup trong solver inner loop — defeats the purpose
const colorToId = new Map<string, number>(); // Map lookup = \~50ns, defeats cache benefit
```

### Coordinate helper — viết 1 lần, dùng ở mọi nơi

```typescript
// src/generator/GridUtils.ts
export class GridUtils {
  constructor(private readonly size: number) {}

  // Flat index từ (row, col)
  idx(r: number, c: number): number {
    return r \* this.size + c;
  }

  // Row từ flat index
  row(i: number): number {
    return Math.floor(i / this.size);
  }

  // Col từ flat index
  col(i: number): number {
    return i % this.size;
  }

  // 4 neighbors (up, down, left, right) — filter ra ngoài bounds
  neighbors(i: number): number\[] {
    const r = this.row(i), c = this.col(i);
    const result: number\[] = \[];
    if (r > 0)              result.push(i - this.size); // up
    if (r < this.size - 1)  result.push(i + this.size); // down
    if (c > 0)              result.push(i - 1);          // left
    if (c < this.size - 1)  result.push(i + 1);          // right
    return result;
  }

  // Inline version không tạo array — dùng trong hot loop
  forEachNeighbor(i: number, cb: (ni: number) => void): void {
    const r = this.row(i), c = this.col(i);
    if (r > 0)              cb(i - this.size);
    if (r < this.size - 1)  cb(i + this.size);
    if (c > 0)              cb(i - 1);
    if (c < this.size - 1)  cb(i + 1);
  }
}
```

### Ảnh hưởng đến game: Không có

Đây là implementation detail thuần túy. Solver vẫn tìm cùng solutions, validator vẫn đếm cùng số solutions, puzzle output hoàn toàn giống hệt. User không biết và không cảm nhận được sự thay đổi này.

\---

## 2\. Mutable State + Undo — Đúng hướng nhưng cần cẩn thận

### Tại sao mutable nhanh hơn immutable

```typescript
// IMMUTABLE (hiện tại): mỗi backtrack step tạo object mới
applyPath(state: SolverState, color: ColorId, path: number\[]): SolverState {
  const newGrid = state.grid.map(row => \[...row]); // O(N²) copy mỗi step!
  const newPaths = new Map(state.paths);           // O(colors) copy
  // ...
  return { grid: newGrid, paths: newPaths, ... };
}

// MUTABLE (proposed): modify in place, undo khi backtrack
doMove(grid: Uint8Array, path: number\[], color: ColorId): void {
  for (let i = 1; i < path.length - 1; i++) {
    grid\[path\[i]] = color; // O(path.length) — \~10-20 ops cho 15x15
  }
}

undoMove(grid: Uint8Array, path: number\[]): void {
  for (let i = 1; i < path.length - 1; i++) {
    grid\[path\[i]] = ColorId.EMPTY; // restore
  }
}
```

Với 15×15 grid và 10,000 backtrack nodes: immutable tạo ra 10,000 × 225-byte copies = 2.25MB garbage để GC collect. GC pauses trên V8 (Node.js) có thể gây sudden slowdowns. Mutable loại bỏ hoàn toàn GC pressure này.

### 4 edge case undo phải xử lý đúng

**Edge case 1 — Dot endpoints (quan trọng nhất):**

```typescript
// Dots được pre-fill vào grid trước khi solver bắt đầu:
grid\[idx(pair.start)] = color;  // ← đây là "pre-placed"
grid\[idx(pair.end)]   = color;

// doMove chỉ fill INTERMEDIATE cells (index 1 → length-2):
for (let i = 1; i < path.length - 1; i++) { grid\[path\[i]] = color; }

// undoMove cũng chỉ clear intermediate cells:
for (let i = 1; i < path.length - 1; i++) { grid\[path\[i]] = ColorId.EMPTY; }

// ❌ SAI: clear cả endpoint → endpoint biến mất khỏi grid
// ✅ ĐÚNG: chỉ clear intermediate, dots luôn tồn tại trong grid
```

**Edge case 2 — Forced moves phải được tracked:**

Nếu `applyForcedMoves()` mutates grid trước khi backtrack, những mutations đó **phải** được undo sau. Cần track riêng:

```typescript
interface MoveRecord {
  forcedCells: number\[];  // cells filled by forced moves
  pathCells: number\[];    // cells filled by chosen path
}

// doMove trả về record để undoMove biết chính xác cần undo gì
function doMove(grid: Uint8Array, path: number\[], forced: number\[]): MoveRecord {
  const record: MoveRecord = { forcedCells: \[], pathCells: \[] };
  
  // Apply forced moves
  for (const cell of forced) {
    grid\[cell] = determineForcedColor(cell); // phải biết màu nào
    record.forcedCells.push(cell);
  }
  
  // Apply chosen path
  for (let i = 1; i < path.length - 1; i++) {
    grid\[path\[i]] = color;
    record.pathCells.push(path\[i]);
  }
  
  return record;
}

function undoMove(grid: Uint8Array, record: MoveRecord): void {
  // Undo theo thứ tự NGƯỢC (LIFO)
  for (const cell of \[...record.pathCells].reverse()) {
    grid\[cell] = ColorId.EMPTY;
  }
  for (const cell of \[...record.forcedCells].reverse()) {
    grid\[cell] = ColorId.EMPTY;
  }
}
```

**Edge case 3 — Mixer cells:**

Mixer cell cần track 2 trạng thái: `inputAFilled` và `inputBFilled`. Khi undo, phải reset đúng slot:

```typescript
// Cần separate array để track mixer state, không thể encode hết vào Uint8Array
const mixerStateA = new Uint8Array(size \* size); // which color filled slot A
const mixerStateB = new Uint8Array(size \* size); // which color filled slot B

// doMove khi path đi qua mixer:
if (isMixerCell(grid, idx)) {
  if (mixerStateA\[idx] === ColorId.EMPTY) {
    mixerStateA\[idx] = color; // first path through
  } else {
    mixerStateB\[idx] = color; // second path → mixer activates
    const outputColor = getMixResult(mixerStateA\[idx], mixerStateB\[idx]);
    grid\[mixerOutput\[idx]] = outputColor; // fill output cell
  }
}

// undoMove khi undo path qua mixer:
if (isMixerCell(grid, idx)) {
  if (mixerStateB\[idx] === color) {
    grid\[mixerOutput\[idx]] = ColorId.EMPTY; // undo output
    mixerStateB\[idx] = ColorId.EMPTY;
  } else if (mixerStateA\[idx] === color) {
    mixerStateA\[idx] = ColorId.EMPTY;
  }
}
```

**Edge case 4 — Teleport cells:**

```typescript
// doMove khi path đi vào teleport entry:
grid\[teleportExit\[idx]] = color; // fill exit cell luôn
// undoMove: clear exit cell
grid\[teleportExit\[idx]] = ColorId.EMPTY;
```

### Test bắt buộc cho mutable state

Trước khi integrate, viết test này:

```typescript
test('mutable undo: grid identical before and after failed backtrack', () => {
  const solver = new BacktrackingSolver(6);
  const grid = new Uint8Array(36);
  const snapshot = grid.slice(); // copy trước khi solve
  
  // Setup puzzle với 1 invalid configuration (no solution)
  const result = solver.solve(impossiblePairs, \[]);
  
  // Grid phải giống hệt snapshot (tất cả mutations đã được undo)
  expect(grid).toEqual(snapshot);
  expect(result).toBeNull();
});
```

### Ảnh hưởng đến game: Không có — nếu undo đúng

Mutable state là implementation detail. Nếu undo chính xác 100%, solver tìm ra cùng solutions như trước. Nếu undo sai dù 1 cell → solver có thể tìm ra "solution" không hợp lệ → puzzle broken → **ảnh hưởng game nghiêm trọng**. Đây là lý do test là bắt buộc.

\---

## 3\. Dynamic MRV — An toàn hoàn toàn

### Tại sao an toàn

MRV (Minimum Remaining Values) chỉ thay đổi **thứ tự** solver thử các màu. Nếu màu A có 3 khả năng và màu B có 10 khả năng, solver thử A trước. Dù thử theo thứ tự nào, solver vẫn explore **đầy đủ** toàn bộ không gian tìm kiếm (chỉ nhanh hơn vì prune sớm hơn).

```
Không MRV: thử màu theo thứ tự \[A, B, C, D] — có thể mất 1000 nodes
MRV:       thử màu theo thứ tự \[C, A, D, B] — cùng kết quả, chỉ 200 nodes
```

### Chú ý implementation: re-sort phải dùng BFS estimate, không DFS

```typescript
// ✅ ĐÚNG: BFS count từ head của mỗi màu (O(N) per color)
function countAccessibleFromHead(grid: Uint8Array, head: number, gu: GridUtils): number {
  const visited = new Uint8Array(grid.length);
  let count = 0;
  const queue = \[head];
  visited\[head] = 1;
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    count++;
    gu.forEachNeighbor(curr, ni => {
      if (!visited\[ni] \&\& grid\[ni] === ColorId.EMPTY) {
        visited\[ni] = 1;
        queue.push(ni);
      }
    });
  }
  return count;
}

// ❌ SAI: full DFS để count paths — O(N!) = defeats purpose
function countPathsDFS(grid, head, end): number { /\* recursive DFS = too slow \*/ }
```

### Ảnh hưởng đến game: Không có

Puzzle output giống hệt. Chỉ generation nhanh hơn.

\---

## 4\. Wall-hugging sort — An toàn hoàn toàn

### Concept

Khi solver đang extend path, ưu tiên các ô liền kề với walls hoặc ô đã filled. Lý do: ô ở góc/cạnh có ít lựa chọn hơn → nên fill sớm để tránh isolated pocket về sau.

```typescript
function sortNeighborsByWallHugging(
  neighbors: number\[],
  grid: Uint8Array,
  gu: GridUtils
): number\[] {
  return neighbors.sort((a, b) => {
    const wallNeighborsA = countOccupiedNeighbors(grid, a, gu);
    const wallNeighborsB = countOccupiedNeighbors(grid, b, gu);
    // Ưu tiên ô có nhiều neighbors đã occupied nhất (wall-hugging)
    return wallNeighborsB - wallNeighborsA;
  });
}

function countOccupiedNeighbors(grid: Uint8Array, idx: number, gu: GridUtils): number {
  let count = 0;
  gu.forEachNeighbor(idx, ni => {
    if (grid\[ni] !== ColorId.EMPTY) count++;
  });
  // Thêm penalty cho biên grid (cells ở edge có fewer neighbors = more constrained)
  count += (4 - gu.neighbors(idx).length); // biên = ít neighbors = cao hơn
  return count;
}
```

### Ảnh hưởng đến game: Không có

Đây là heuristic cho solver (generation phase), không phải hint engine. Puzzle output giống hệt. User không cảm nhận được.

\---

## 5\. ValidateUnique dùng Solver — RỦI RO CAO, ẢNH HƯỞNG GAME

Đây là **thay đổi duy nhất trong plan có thể ảnh hưởng trực tiếp đến chất lượng và độ khó game.** Cần phân tích kỹ trước khi implement.

### Tại sao plan đề xuất điều này

Plan muốn tái sử dụng solver với heuristics mạnh (Island Check, Parity) để ValidateUnique chạy nhanh hơn. Logic: heuristics prune nhanh → đếm solutions nhanh hơn.

### Vấn đề cốt lõi: Heuristic admissibility trong count mode

**Admissible** = heuristic **chỉ** prune những branches thực sự infeasible. Nếu heuristic prune một branch mà sẽ dẫn đến valid solution #2 → validator báo puzzle "unique" trong khi thực ra không phải → puzzle bị lọt qua với 2 nghiệm.

**Hậu quả với game:**

* Puzzle có 2 nghiệm trông giống puzzle bình thường
* User giải theo cách B (nghiệm thứ 2) vẫn pass
* Puzzles "lỏng" — không cần logical deduction, chỉ cần fill đủ ô theo cách bất kỳ
* Dễ hơn thiết kế, làm giảm satisfaction khi giải
* User nhận ra pattern sau vài màn → churn

### Phân tích từng heuristic trong count mode

**Degree Check — An toàn:**

```
Nếu ô trống có 0 accessible neighbors → không thể fill → genuinely infeasible.
Proof: bất kỳ solution nào cũng phải fill ô đó, nhưng không có đường vào → impossible.
→ Admissible. An toàn dùng trong count mode.

Edge case cần xử lý:
  Dot endpoint với degree=1, neighbor duy nhất là partner dot → đây là path độ dài 2, VALID.
  Không được prune case này.
```

**Island Check — CÓ THỂ SAI nếu implement không cẩn thận:**

```
Case nguy hiểm:

State hiện tại: red đã placed đi qua giữa grid
    . . . | R R R | . . .
    . . . | R R R | . . .

Left region:  chứa blue\_start
Right region: chứa blue\_end

Island Check thấy: left region có blue\_start nhưng không có blue\_end
→ Kết luận: left region chỉ có 1 endpoint → PRUNE

NHƯNG: blue path sẽ đi từ left region, qua phía trên/dưới red, sang right region
→ left region KHÔNG bị isolated, chỉ cần đi "quanh" red
→ PRUNE là SAI → false uniqueness

FIX: Island Check phải sử dụng "reachability" thay vì "component membership":
     Kiểm tra xem blue\_start có thể reach blue\_end hay không (BFS/DFS ignoring incomplete pairs).
     Nếu có path từ start đến end → KHÔNG prune.
```

**Parity Check — An toàn:**

```
Mathematical invariant: trong bất kỳ valid solution nào,
mỗi path phải traverse equal số black và white cells (hoặc lệch 1 nếu path length lẻ).

Nếu component có |black - white| > numColors → không tồn tại valid solution.
Proof by pigeonhole principle — chứng minh được toán học.
→ Admissible. An toàn dùng trong count mode.
```

**Forced Moves trong count mode — Cần tracking đặc biệt:**

```
Forced move: cell với degree=1 → path đi qua đó là bắt buộc.

Trong generation (tìm 1 solution): forced moves được apply vĩnh viễn → OK.

Trong count mode (đếm solutions): sau khi đếm xong 1 branch, cần UNDO forced moves
để branch tiếp theo bắt đầu từ trạng thái sạch.

Nếu forced moves không được undo → count mode báo sai số solutions.
```

**Dynamic MRV sort trong count mode — An toàn với điều kiện:**

```
MRV chỉ thay đổi ORDER explore, không skip bất kỳ branch nào
→ An toàn, với điều kiện: explore ĐẦY ĐỦ tất cả paths (không bị cut bởi maxPaths).

NGUY HIỂM nếu: maxPaths=20 + MRV ưu tiên solution A trước
→ 20 paths đầu tiên đều là variations của A
→ Không bao giờ explore solution B
→ Validator sai
```

### Fix cụ thể cho ValidateUnique

Nếu vẫn muốn dùng solver heuristics trong count mode, áp dụng đúng như sau:

```typescript
// src/generator/steps/ValidateUnique.ts

export class UniquenessValidator {
  countSolutions(
    level: LevelData,
    maxCount: number = 2 // Dừng khi tìm maxCount solutions
  ): number {

    const grid = new Uint8Array(level.gridSize \* level.gridSize);
    // ... setup grid

    return this.countRecursive(level.pairs, 0, grid, maxCount);
  }

  private countRecursive(
    pairs: DotPair\[],
    pairIdx: number,
    grid: Uint8Array,
    maxCount: number
  ): number {

    if (pairIdx === pairs.length) {
      return this.isFullyFilled(grid) ? 1 : 0;
    }

    const pair = pairs\[pairIdx];

    // ✅ SAFE: Degree Check — mathematically admissible
    if (!this.checkDegrees(grid, pairs.slice(pairIdx))) return 0;

    // ✅ SAFE: Parity Check — mathematically admissible
    if (this.size >= 10 \&\& !this.checkParity(grid, pairs.slice(pairIdx))) return 0;

    // ⚠️ CAREFUL: Island Check — only use reachability version, not component version
    if (!this.checkReachability(grid, pairs.slice(pairIdx))) return 0;

    // ❌ DO NOT USE: Forced Moves — too risky to undo correctly in count mode
    // Skip forced moves in validator for safety

    // Enumerate ALL paths (no maxPaths limit in count mode!)
    const allPaths = this.findAllPaths(
      grid,
      pair.start,
      pair.end,
      pair.color,
      999 // No limit — must explore everything for correct count
    );

    let count = 0;
    for (const path of allPaths) {
      this.applyPath(grid, path, pair.color);
      count += this.countRecursive(pairs, pairIdx + 1, grid, maxCount);
      this.undoPath(grid, path);

      if (count >= maxCount) return count; // Early exit
    }
    return count;
  }

  // ✅ Reachability check — thay thế Island Check thông thường
  // Kiểm tra: với mỗi incomplete pair, start có thể reach end không?
  private checkReachability(grid: Uint8Array, incompletePairs: DotPair\[]): boolean {
    for (const pair of incompletePairs) {
      const startIdx = this.gu.idx(pair.start\[0], pair.start\[1]);
      const endIdx   = this.gu.idx(pair.end\[0],   pair.end\[1]);

      if (!this.bfsCanReach(grid, startIdx, endIdx)) return false;
    }
    return true;
  }

  private bfsCanReach(grid: Uint8Array, from: number, to: number): boolean {
    if (from === to) return true;
    const visited = new Uint8Array(grid.length);
    const queue = \[from];
    visited\[from] = 1;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      this.gu.forEachNeighbor(curr, ni => {
        if (ni === to) { queue.length = 0; visited\[to] = 1; return; }
        if (!visited\[ni] \&\& grid\[ni] === ColorId.EMPTY) {
          visited\[ni] = 1;
          queue.push(ni);
        }
      });
      if (visited\[to]) return true;
    }
    return false;
  }
}
```

### Test bắt buộc cho ValidateUnique

```typescript
// Test 1: Puzzle với 2 solutions phải bị detect
test('validator correctly identifies non-unique puzzle', () => {
  // Setup: 4x4 grid với 2 solutions đã biết
  const level = createKnownNonUniquePuzzle();
  expect(validator.countSolutions(level, 2)).toBe(2);
});

// Test 2: Puzzle với 1 solution unique phải pass
test('validator correctly identifies unique puzzle', () => {
  const level = createKnownUniquePuzzle();
  expect(validator.countSolutions(level, 2)).toBe(1);
});

// Test 3: Sau khi optimize, kết quả phải giống validator cũ
test('optimized validator matches original on 100 random puzzles', () => {
  for (let i = 0; i < 100; i++) {
    const level = generateRandomPuzzle(6);
    const originalCount = originalValidator.countSolutions(level, 2);
    const newCount = newValidator.countSolutions(level, 2);
    expect(newCount).toBe(originalCount); // Must match exactly
  }
});
```

### Ảnh hưởng đến game: CÓ, nếu implement sai

|Scenario|Kết quả|
|-|-|
|Validator đúng|Puzzle luôn có 1 nghiệm → user phải dùng logic → satisfying|
|Validator sai (false uniqueness)|Puzzle có 2 nghiệm lọt qua → user giải bằng cách B → "easy" và "cheap"|

**Với 2305 levels, nếu 10% bị false uniqueness = 230 levels bị lỏng. Người dùng sẽ cảm nhận được sau 30–40 levels đầu tiên → reviews tiêu cực về "the puzzles are too easy and feel random".**

\---

## 6\. Worker Pool — An toàn nhưng ưu tiên thấp

### Tại sao an toàn

Mỗi worker là independent process với state riêng. Worker A generate level 15×15 #1, Worker B generate #2 — chúng không share state. Kết quả hoàn toàn deterministic nếu dùng seeded random (mỗi worker dùng seed khác nhau).

```typescript
// worker\_pool.ts — đơn giản nhất có thể làm đúng

import { Worker, isMainThread, parentPort, workerData } from 'worker\_threads';
import \* as os from 'os';

if (!isMainThread) {
  // Worker mode: nhận config, generate 1 level, trả về
  const { gridSize, levelIndex, seed } = workerData;
  const generator = new PuzzleGenerator();
  const level = generator.generate({ gridSize, seed: `${gridSize}\_${levelIndex}\_${seed}` });
  parentPort!.postMessage({ levelIndex, level });
  return;
}

// Main thread: distribute work across N workers
export async function generateBatch(
  configs: GeneratorConfig\[],
  onProgress: (done: number, total: number) => void
): Promise<LevelData\[]> {
  const numWorkers = Math.min(os.cpus().length - 1, 6); // leave 1 core for main
  const results: LevelData\[] = new Array(configs.length);
  let nextIdx = 0;
  let completed = 0;

  return new Promise(resolve => {
    const workers: Worker\[] = \[];

    const assignWork = (worker: Worker) => {
      if (nextIdx >= configs.length) return;
      const idx = nextIdx++;
      worker.postMessage({ ...configs\[idx], levelIndex: idx });
    };

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(\_\_filename);
      worker.on('message', ({ levelIndex, level }) => {
        results\[levelIndex] = level;
        completed++;
        onProgress(completed, configs.length);
        assignWork(worker); // Give next task
        if (completed === configs.length) {
          workers.forEach(w => w.terminate());
          resolve(results);
        }
      });
      workers.push(worker);
      assignWork(worker);
    }
  });
}
```

### Trả lời Open Question 1: Làm ngay hay thuật toán trước?

**Làm thuật toán trước.** Lý do:

```
Bottleneck hiện tại: solver tốn 500ms-3s cho 15×15

Sau Uint8Array + Mutable + MRV:
  Solver tốn \~100-500ms → 3-6x faster

Time cho 182 levels 15×15:
  Before: 182 × 3s = 546s = 9 phút
  After:  182 × 0.8s = 146s = 2.5 phút

Workers thêm vào sau đó:
  4 cores × 2.5 phút = \~40 giây

Nếu 2.5 phút là chấp nhận được → Workers không cần thiết
Workers chỉ cần cho 18×18-20×20 (nếu vẫn còn chậm sau algo opt)
```

Workers cũng thêm complexity: race conditions, inter-process communication, error handling khi 1 worker crash. Thuật toán optimization có ROI cao hơn và risk thấp hơn.

\---

## 7\. Trả lời Open Questions

### Open Question 1: Worker Threads bây giờ hay sau?

**Trả lời: Sau.** Thứ tự:

1. Implement Uint8Array + Mutable + MRV trước
2. Benchmark thực tế 15×15 và 18×18
3. Nếu 18×18 vẫn > 30 phút tổng → thêm Workers
4. 15×15 sau optimization sẽ đủ nhanh mà không cần Workers

### Open Question 2: Hash table cho color mapping

**Trả lời: Dùng `const enum`, không dùng Map.**

```typescript
// ✅ const enum — compile-time inlining, zero runtime overhead
export const enum ColorId {
  EMPTY = 0,
  RED = 1, BLUE = 2, GREEN = 3, YELLOW = 4, ORANGE = 5,
  PURPLE = 6, CYAN = 7, PINK = 8, BROWN = 9, WHITE = 10,
  LIME = 11, MAGENTA = 12, TEAL = 13, GOLD = 14, NAVY = 15,
  WALL = 255
}
```

Map lookup trong solver inner loop = \~50ns per lookup × millions of calls = significant overhead. Const enum là zero-cost abstraction trong TypeScript.

\---

## 8\. Thứ tự implement an toàn

Làm theo thứ tự này để tránh introduce bugs:

```
Bước 1 (30 phút): Uint8Array + GridUtils helper
  → Test: grid operations cho đúng kết quả như string\[]\[]
  → Benchmark: solver speed improvement

Bước 2 (1 giờ): Mutable state + Undo
  → Test BẮT BUỘC: grid identical before/after failed backtrack
  → Test: solver tìm cùng solution như trước

Bước 3 (30 phút): Dynamic MRV
  → Test: puzzle output giống hệt, chỉ nhanh hơn

Bước 4 (30 phút): Wall-hugging sort
  → Test: puzzle output giống hệt

Bước 5 (2 giờ): ValidateUnique safe version
  → KHÔNG dùng Forced Moves
  → Dùng Reachability Check thay Island Check
  → Test bắt buộc: so sánh với original validator trên 100 puzzles

Bước 6 (sau khi benchmark): Worker Pool nếu cần
```

\---

## Tóm tắt cuối

**5 thay đổi không ảnh hưởng game** — chỉ là optimization infrastructure. Implement tự tin, test kỹ undo logic.

**1 thay đổi có thể ảnh hưởng game** — `ValidateUnique` dùng solver heuristics. Không implement theo plan gốc. Dùng `Reachability Check` (BFS can-reach) thay vì `Island Check` (component membership), không dùng Forced Moves trong count mode, và bỏ `maxPaths` limit. Chạy regression test 100 puzzles so với validator cũ trước khi dùng.

\---

*Review: 12/04/2026 — Điểm cốt lõi: optimization không làm thay đổi game, nhưng ValidateUnique cần implementation đặc biệt so với plan gốc để bảo vệ puzzle quality.*

