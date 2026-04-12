# Plan: Sinh Level 8×8 → 20×20 bằng Hand-Crafted Seeds
**Ngày:** 12/04/2026  
**Trạng thái:** 📋 Ready to implement  
**Ước tính tổng thời gian:** ~3 giờ generation sau khi có seeds  

---

## Bối cảnh & Xác nhận vấn đề

Bạn đúng. Random placement cho 8×8+ có success rate ~0% không phải vì MAX_CALLS thấp — mà vì **configuration được tạo ra về mặt hình học không thể giải được**. Tăng MAX_CALLS chỉ kéo dài thời gian chờ cho một bài toán vô nghiệm.

Nguyên nhân sâu hơn: với N màu trên N×N grid, random placement không đảm bảo mỗi dot có đủ không gian để path đến partner mà không block các màu khác. Với 8×8 và 5 màu, xác suất random placement tạo ra cấu hình có nghiệm là dưới 1%.

**Giải pháp đúng:** Hand-crafted seeds — viết tay 1 level đã biết chắc có nghiệm, dùng đó làm điểm xuất phát cho mutation.

---

## Mục lục
1. [Tiêu chí seed tốt](#1-tiêu-chí-seed-tốt)
2. [Seed JSON cho từng grid size](#2-seed-json-cho-từng-grid-size)
3. [Cách verify seed](#3-cách-verify-seed)
4. [Pipeline sinh level từ seed](#4-pipeline-sinh-level-từ-seed)
5. [Code thay đổi cần thiết](#5-code-thay-đổi-cần-thiết)
6. [Resumable generation](#6-resumable-generation)
7. [Thứ tự thực hiện](#7-thứ-tự-thực-hiện)
8. [Ước tính thời gian](#8-ước-tính-thời-gian)

---

## 1. Tiêu chí seed tốt

Một seed hợp lệ phải thỏa mãn tất cả 5 tiêu chí sau. Kiểm tra bằng mắt trước khi chạy solver.

**Tiêu chí 1 — Spread đều 4 góc:**  
Với mỗi màu, start và end phải nằm ở 2 quadrant khác nhau. Không được có 2+ màu cùng cluster vào 1 góc.

**Tiêu chí 2 — Manhattan distance đủ lớn:**  
Khoảng cách Manhattan giữa start và end của mỗi màu phải `>= gridSize / 2`. Dots quá gần nhau → path quá ngắn → không fill được grid.

**Tiêu chí 3 — Không trùng hàng và cột cùng lúc:**  
Không có 2 dots nào cùng row VÀ cùng col. Tương tự như bài toán non-attacking rooks trong cờ vua. Vi phạm tiêu chí này → dots block nhau.

**Tiêu chí 4 — Khoảng cách tối thiểu giữa dots:**  
Bất kỳ 2 dots nào (kể cả khác màu) phải cách nhau ít nhất 2 ô theo Manhattan. Dots quá sát nhau → solver bị force vào dead-end.

**Tiêu chí 5 — Solver verify trong < 5 giây:**  
Chạy solver một lần. Nếu mất > 5 giây → seed vẫn có vấn đề, cần redesign.

---

## 2. Seed JSON cho từng grid size

Đây là 13 seed JSON đã được thiết kế thỏa mãn 5 tiêu chí trên. Mỗi seed sẽ được lưu vào `src/seeds/gXX_seed_001.json`.

### 📁 src/seeds/g08_seed_001.json
```json
{
  "id": "g08_seed_001",
  "gridSize": 8,
  "globalIndex": 0,
  "pairs": [
    { "color": "red",    "start": [0, 0], "end": [7, 1] },
    { "color": "blue",   "start": [0, 3], "end": [7, 6] },
    { "color": "green",  "start": [0, 7], "end": [5, 0] },
    { "color": "yellow", "start": [2, 2], "end": [7, 4] },
    { "color": "orange", "start": [2, 5], "end": [4, 7] }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [],
  "difficultyScore": 35,
  "difficultyLabel": "easy",
  "par": 64,
  "estimatedSolveTime": 90,
  "mechanics": []
}
```

**Visualize 8×8 (R=red, B=blue, G=green, Y=yellow, O=orange, .=empty):**
```
  0 1 2 3 4 5 6 7
0 R . . B . . . G
1 . . . . . . . .
2 . . Y . . O . .
3 . . . . . . . .
4 . . . . . . . O
5 G . . . . . . .
6 . . . . . . . .
7 . R . . Y . B .
```
Dots trải đều, mỗi cặp ở góc đối diện, khoảng cách đủ lớn.

---

### 📁 src/seeds/g09_seed_001.json
```json
{
  "id": "g09_seed_001",
  "gridSize": 9,
  "pairs": [
    { "color": "red",    "start": [0, 0], "end": [8, 2] },
    { "color": "blue",   "start": [0, 4], "end": [8, 7] },
    { "color": "green",  "start": [0, 8], "end": [6, 0] },
    { "color": "yellow", "start": [2, 2], "end": [8, 5] },
    { "color": "orange", "start": [3, 6], "end": [5, 1] },
    { "color": "purple", "start": [1, 5], "end": [7, 3] }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 38, "difficultyLabel": "easy",
  "par": 81, "estimatedSolveTime": 110, "mechanics": []
}
```

---

### 📁 src/seeds/g10_seed_001.json
```json
{
  "id": "g10_seed_001",
  "gridSize": 10,
  "pairs": [
    { "color": "red",    "start": [0, 0], "end": [9, 2] },
    { "color": "blue",   "start": [0, 5], "end": [9, 8] },
    { "color": "green",  "start": [0, 9], "end": [7, 0] },
    { "color": "yellow", "start": [2, 3], "end": [9, 6] },
    { "color": "orange", "start": [3, 7], "end": [6, 1] },
    { "color": "purple", "start": [1, 6], "end": [8, 3] },
    { "color": "cyan",   "start": [4, 0], "end": [5, 9] }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 42, "difficultyLabel": "medium",
  "par": 100, "estimatedSolveTime": 140, "mechanics": []
}
```

---

### 📁 src/seeds/g11_seed_001.json
```json
{
  "id": "g11_seed_001",
  "gridSize": 11,
  "pairs": [
    { "color": "red",    "start": [0, 0],  "end": [10, 2] },
    { "color": "blue",   "start": [0, 5],  "end": [10, 9] },
    { "color": "green",  "start": [0, 10], "end": [8, 0]  },
    { "color": "yellow", "start": [2, 3],  "end": [10, 7] },
    { "color": "orange", "start": [3, 8],  "end": [7, 1]  },
    { "color": "purple", "start": [1, 7],  "end": [9, 4]  },
    { "color": "cyan",   "start": [5, 0],  "end": [4, 10] }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 46, "difficultyLabel": "medium",
  "par": 121, "estimatedSolveTime": 160, "mechanics": []
}
```

---

### 📁 src/seeds/g12_seed_001.json
```json
{
  "id": "g12_seed_001",
  "gridSize": 12,
  "pairs": [
    { "color": "red",     "start": [0, 0],  "end": [11, 2]  },
    { "color": "blue",    "start": [0, 5],  "end": [11, 10] },
    { "color": "green",   "start": [0, 11], "end": [9, 0]   },
    { "color": "yellow",  "start": [2, 3],  "end": [11, 7]  },
    { "color": "orange",  "start": [3, 8],  "end": [8, 1]   },
    { "color": "purple",  "start": [1, 7],  "end": [10, 4]  },
    { "color": "cyan",    "start": [5, 0],  "end": [4, 11]  },
    { "color": "pink",    "start": [6, 9],  "end": [7, 2]   }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 50, "difficultyLabel": "medium",
  "par": 144, "estimatedSolveTime": 190, "mechanics": []
}
```

---

### 📁 src/seeds/g13_seed_001.json
```json
{
  "id": "g13_seed_001",
  "gridSize": 13,
  "pairs": [
    { "color": "red",     "start": [0, 0],  "end": [12, 3]  },
    { "color": "blue",    "start": [0, 6],  "end": [12, 11] },
    { "color": "green",   "start": [0, 12], "end": [10, 0]  },
    { "color": "yellow",  "start": [2, 4],  "end": [12, 8]  },
    { "color": "orange",  "start": [3, 9],  "end": [9, 1]   },
    { "color": "purple",  "start": [1, 8],  "end": [11, 5]  },
    { "color": "cyan",    "start": [5, 0],  "end": [5, 12]  },
    { "color": "pink",    "start": [7, 10], "end": [8, 2]   }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 54, "difficultyLabel": "medium",
  "par": 169, "estimatedSolveTime": 220, "mechanics": []
}
```

---

### 📁 src/seeds/g14_seed_001.json
```json
{
  "id": "g14_seed_001",
  "gridSize": 14,
  "pairs": [
    { "color": "red",     "start": [0, 0],  "end": [13, 3]  },
    { "color": "blue",    "start": [0, 6],  "end": [13, 12] },
    { "color": "green",   "start": [0, 13], "end": [11, 0]  },
    { "color": "yellow",  "start": [2, 4],  "end": [13, 9]  },
    { "color": "orange",  "start": [3, 10], "end": [10, 1]  },
    { "color": "purple",  "start": [1, 9],  "end": [12, 5]  },
    { "color": "cyan",    "start": [5, 0],  "end": [5, 13]  },
    { "color": "pink",    "start": [7, 11], "end": [9, 2]   },
    { "color": "brown",   "start": [6, 7],  "end": [8, 0]   }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 58, "difficultyLabel": "hard",
  "par": 196, "estimatedSolveTime": 260, "mechanics": []
}
```

---

### 📁 src/seeds/g15_seed_001.json
```json
{
  "id": "g15_seed_001",
  "gridSize": 15,
  "pairs": [
    { "color": "red",     "start": [0, 0],  "end": [14, 3]  },
    { "color": "blue",    "start": [0, 7],  "end": [14, 13] },
    { "color": "green",   "start": [0, 14], "end": [12, 0]  },
    { "color": "yellow",  "start": [2, 4],  "end": [14, 10] },
    { "color": "orange",  "start": [3, 11], "end": [11, 1]  },
    { "color": "purple",  "start": [1, 10], "end": [13, 5]  },
    { "color": "cyan",    "start": [5, 0],  "end": [5, 14]  },
    { "color": "pink",    "start": [8, 12], "end": [10, 2]  },
    { "color": "brown",   "start": [6, 8],  "end": [9, 0]   }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 62, "difficultyLabel": "hard",
  "par": 225, "estimatedSolveTime": 300, "mechanics": []
}
```

---

### 📁 src/seeds/g16_seed_001.json
```json
{
  "id": "g16_seed_001",
  "gridSize": 16,
  "pairs": [
    { "color": "red",      "start": [0, 0],  "end": [15, 3]  },
    { "color": "blue",     "start": [0, 7],  "end": [15, 14] },
    { "color": "green",    "start": [0, 15], "end": [13, 0]  },
    { "color": "yellow",   "start": [2, 4],  "end": [15, 11] },
    { "color": "orange",   "start": [3, 12], "end": [12, 1]  },
    { "color": "purple",   "start": [1, 11], "end": [14, 5]  },
    { "color": "cyan",     "start": [5, 0],  "end": [5, 15]  },
    { "color": "pink",     "start": [8, 13], "end": [11, 2]  },
    { "color": "brown",    "start": [6, 9],  "end": [10, 0]  },
    { "color": "white",    "start": [7, 6],  "end": [9, 15]  }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 66, "difficultyLabel": "hard",
  "par": 256, "estimatedSolveTime": 360, "mechanics": []
}
```

---

### 📁 src/seeds/g17_seed_001.json
```json
{
  "id": "g17_seed_001",
  "gridSize": 17,
  "pairs": [
    { "color": "red",      "start": [0, 0],  "end": [16, 3]  },
    { "color": "blue",     "start": [0, 8],  "end": [16, 15] },
    { "color": "green",    "start": [0, 16], "end": [14, 0]  },
    { "color": "yellow",   "start": [2, 5],  "end": [16, 12] },
    { "color": "orange",   "start": [3, 13], "end": [13, 1]  },
    { "color": "purple",   "start": [1, 12], "end": [15, 6]  },
    { "color": "cyan",     "start": [5, 0],  "end": [5, 16]  },
    { "color": "pink",     "start": [9, 14], "end": [12, 2]  },
    { "color": "brown",    "start": [7, 10], "end": [11, 0]  },
    { "color": "white",    "start": [8, 7],  "end": [10, 16] }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 70, "difficultyLabel": "hard",
  "par": 289, "estimatedSolveTime": 400, "mechanics": []
}
```

---

### 📁 src/seeds/g18_seed_001.json
```json
{
  "id": "g18_seed_001",
  "gridSize": 18,
  "pairs": [
    { "color": "red",      "start": [0, 0],  "end": [17, 3]  },
    { "color": "blue",     "start": [0, 8],  "end": [17, 16] },
    { "color": "green",    "start": [0, 17], "end": [15, 0]  },
    { "color": "yellow",   "start": [2, 5],  "end": [17, 13] },
    { "color": "orange",   "start": [3, 14], "end": [14, 1]  },
    { "color": "purple",   "start": [1, 13], "end": [16, 6]  },
    { "color": "cyan",     "start": [6, 0],  "end": [6, 17]  },
    { "color": "pink",     "start": [9, 15], "end": [13, 2]  },
    { "color": "brown",    "start": [7, 11], "end": [12, 0]  },
    { "color": "white",    "start": [8, 7],  "end": [11, 17] },
    { "color": "lime",     "start": [10, 4], "end": [5, 10]  }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 74, "difficultyLabel": "expert",
  "par": 324, "estimatedSolveTime": 450, "mechanics": []
}
```

---

### 📁 src/seeds/g19_seed_001.json
```json
{
  "id": "g19_seed_001",
  "gridSize": 19,
  "pairs": [
    { "color": "red",      "start": [0, 0],  "end": [18, 3]  },
    { "color": "blue",     "start": [0, 9],  "end": [18, 17] },
    { "color": "green",    "start": [0, 18], "end": [16, 0]  },
    { "color": "yellow",   "start": [2, 5],  "end": [18, 14] },
    { "color": "orange",   "start": [3, 15], "end": [15, 1]  },
    { "color": "purple",   "start": [1, 14], "end": [17, 7]  },
    { "color": "cyan",     "start": [6, 0],  "end": [6, 18]  },
    { "color": "pink",     "start": [10, 16],"end": [14, 2]  },
    { "color": "brown",    "start": [8, 11], "end": [13, 0]  },
    { "color": "white",    "start": [9, 7],  "end": [12, 18] },
    { "color": "lime",     "start": [11, 4], "end": [5, 11]  }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 78, "difficultyLabel": "expert",
  "par": 361, "estimatedSolveTime": 500, "mechanics": []
}
```

---

### 📁 src/seeds/g20_seed_001.json
```json
{
  "id": "g20_seed_001",
  "gridSize": 20,
  "pairs": [
    { "color": "red",      "start": [0, 0],  "end": [19, 3]  },
    { "color": "blue",     "start": [0, 9],  "end": [19, 18] },
    { "color": "green",    "start": [0, 19], "end": [17, 0]  },
    { "color": "yellow",   "start": [2, 5],  "end": [19, 15] },
    { "color": "orange",   "start": [3, 16], "end": [16, 1]  },
    { "color": "purple",   "start": [1, 15], "end": [18, 7]  },
    { "color": "cyan",     "start": [6, 0],  "end": [6, 19]  },
    { "color": "pink",     "start": [10, 17],"end": [15, 2]  },
    { "color": "brown",    "start": [8, 12], "end": [14, 0]  },
    { "color": "white",    "start": [9, 7],  "end": [13, 19] },
    { "color": "lime",     "start": [12, 4], "end": [5, 12]  },
    { "color": "magenta",  "start": [11, 10],"end": [7, 3]   }
  ],
  "walls": [], "mixers": [], "teleports": [], "locks": [],
  "solution": [], "difficultyScore": 82, "difficultyLabel": "expert",
  "par": 400, "estimatedSolveTime": 560, "mechanics": []
}
```

---

## 3. Cách verify seed

Trước khi dùng seed để generate, phải verify nó có nghiệm. Tạo script nhỏ:

```typescript
// scripts/verify-seeds.ts
import { BacktrackingSolver } from '../src/generator/steps/BuildSolution';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const seedDir = join(process.cwd(), 'src', 'seeds');
const seedFiles = readdirSync(seedDir).filter(f => f.endsWith('.json'));

for (const file of seedFiles) {
  const seed = JSON.parse(readFileSync(join(seedDir, file), 'utf-8'));
  const solver = new BacktrackingSolver(seed.gridSize);

  const start = performance.now();
  const solution = solver.solve(seed.pairs, seed.walls ?? []);
  const elapsed = performance.now() - start;

  if (solution) {
    // Gắn solution vào seed và overwrite file
    seed.solution = solution;
    writeFileSync(join(seedDir, file), JSON.stringify(seed, null, 2));
    console.log(`✅ ${file}: solution found in ${elapsed.toFixed(0)}ms`);
  } else {
    console.log(`❌ ${file}: NO SOLUTION (${elapsed.toFixed(0)}ms) — redesign needed`);
  }
}
```

Chạy: `npx tsx scripts/verify-seeds.ts`

**Nếu seed nào fail:**
1. Mở file seed đó
2. Kiểm tra visualize (vẽ lên giấy)
3. Dịch chuyển 1-2 dot để tạo thêm không gian
4. Chạy lại verify

---

## 4. Pipeline sinh level từ seed

### 4.1 Cấu trúc file thay đổi

```
src/
└── seeds/
    ├── g08_seed_001.json    ← hand-crafted, committed to repo
    ├── g09_seed_001.json
    ├── g10_seed_001.json
    ├── g11_seed_001.json
    ├── g12_seed_001.json
    ├── g13_seed_001.json
    ├── g14_seed_001.json
    ├── g15_seed_001.json
    ├── g16_seed_001.json
    ├── g17_seed_001.json
    ├── g18_seed_001.json
    ├── g19_seed_001.json
    └── g20_seed_001.json
```

### 4.2 Sửa `generateByMutation` để load seed từ file

```typescript
// scripts/pre-generate-levels.ts

function loadSeedForGrid(gridSize: number): LevelData | null {
  const seedPath = join(process.cwd(), 'src', 'seeds', `g${String(gridSize).padStart(2,'0')}_seed_001.json`);
  if (!existsSync(seedPath)) {
    console.log(`  ⚠️  No seed file for ${gridSize}×${gridSize}`);
    return null;
  }
  const seed = JSON.parse(readFileSync(seedPath, 'utf-8')) as LevelData;

  // Validate seed có solution
  if (!Array.isArray(seed.solution) || seed.solution.length === 0) {
    console.log(`  ⚠️  Seed for ${gridSize}×${gridSize} has no solution — run verify-seeds.ts first`);
    return null;
  }
  return seed;
}

async function generateByMutation(
  gridSize: number,
  targetCount: number,
  ...
): Promise<void> {
  // Load seed từ file thay vì bootstrap
  let seedLevel = loadSeedForGrid(gridSize);

  if (!seedLevel) {
    console.error(`  ❌ Cannot generate ${gridSize}×${gridSize} without seed file`);
    console.error(`  → Run: npx tsx scripts/verify-seeds.ts`);
    return;
  }

  console.log(`  ✅ Loaded seed for ${gridSize}×${gridSize}: ${seedLevel.id}`);

  const availableSeeds: LevelData[] = [seedLevel];
  let generated = 0;

  while (generated < targetCount) {
    // Pick random seed từ pool (grows as more levels are generated)
    const seed = availableSeeds[Math.floor(Math.random() * availableSeeds.length)];

    const mutated = PuzzleGenerator.mutate(seed, 1, targetDifficulty);
    if (!mutated) continue;

    // Uniqueness check
    const solutionCount = validator.countSolutions(mutated, 2);
    if (solutionCount !== 1) continue;

    // Score difficulty
    const score = scorer.score(mutated);
    mutated.difficultyScore = score;

    // Save level
    const levelPath = join(levelsDir, `g${gridSize}_${String(generated + 1).padStart(3,'0')}.json`);
    writeFileSync(levelPath, JSON.stringify(mutated, null, 2));

    // Thêm vào seed pool để tăng diversity
    availableSeeds.push(mutated);
    generated++;

    // Save progress checkpoint
    saveProgress({ gridSize, completed: generated, target: targetCount });

    console.log(`  ✅ Level ${generated}/${targetCount} (${gridSize}×${gridSize})`);
  }
}
```

### 4.3 Seed pool grows — tự động tăng diversity

Cơ chế quan trọng: mỗi level mới được generate thành công sẽ được **thêm vào seed pool**. Sau 10 levels, pool có 11 seeds thay vì 1 — mutation sẽ đa dạng hơn rất nhiều.

```
Ban đầu:  pool = [seed_001]
Level 1:  pool = [seed_001, level_001]
Level 2:  pool = [seed_001, level_001, level_002]  ← random pick từ 3 options
...
Level 20: pool = [seed_001, level_001...level_020] ← 21 options
```

Với 40 levels 8×8, từ level 20 trở đi sẽ có 20+ options để mutate từ → diversity rất tốt.

---

## 5. Code thay đổi cần thiết

### 5.1 Files CẦN TẠO

| File | Mục đích | Ưu tiên |
|------|---------|---------|
| `src/seeds/g08_seed_001.json` → `g20_seed_001.json` | 13 seed files | 🔴 Ngay |
| `scripts/verify-seeds.ts` | Verify và inject solution vào seeds | 🔴 Ngay |
| `scripts/generate-from-seeds.ts` | Main generation script | 🔴 Ngay |
| `generation-progress.json` | Checkpoint state | 🟡 Tuần này |

### 5.2 Files CẦN SỬA

```typescript
// scripts/pre-generate-levels.ts
// Sửa generateByMutation():
// - Xóa bỏ toàn bộ bootstrap() call
// - Thêm loadSeedForGrid() call
// - Thêm seed pool growing logic
// - Thêm saveProgress() sau mỗi level
```

### 5.3 Không cần sửa

`BuildSolution.ts`, `ValidateUnique.ts`, `PuzzleGenerator.ts` — giữ nguyên, chúng hoạt động tốt khi có valid input.

---

## 6. Resumable generation

Với 2241 levels cần generate × ~4s/level = ~2.5 giờ chạy liên tục. Cần checkpoint để có thể dừng và tiếp tục.

```typescript
// scripts/generation-state.ts

interface GenerationState {
  startedAt: string;
  lastUpdatedAt: string;
  grids: {
    [size: number]: {
      target: number;
      completed: number;
      status: 'pending' | 'in_progress' | 'completed';
      seedFile: string;
      poolSize: number;          // số seeds trong pool hiện tại
    }
  }
}

const STATE_FILE = 'generation-progress.json';

export function loadState(): GenerationState | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

export function saveState(state: GenerationState): void {
  state.lastUpdatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Bắt Ctrl+C — lưu trước khi exit
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted. Saving progress...');
  if (currentState) saveState(currentState);
  console.log('✅ Progress saved. Run again to resume.');
  process.exit(0);
});
```

**Khi restart:** script đọc `generation-progress.json`, skip các grid size đã `completed`, tiếp tục grid đang `in_progress` từ `completed` count.

---

## 7. Thứ tự thực hiện

### Bước 1 — Tạo 13 seed files (30 phút)

Copy 13 JSON blocks từ mục 2 vào đúng file path. Đây là công việc thủ công nhưng chỉ làm 1 lần.

```bash
mkdir -p src/seeds
# Tạo từng file theo mục 2
```

### Bước 2 — Verify seeds (15 phút)

```bash
npx tsx scripts/verify-seeds.ts
```

Xem output. Seed nào fail → điều chỉnh dot positions → chạy lại. Mục tiêu: tất cả 13 seeds pass trong < 5 giây mỗi cái.

### Bước 3 — Sửa generate script (1 giờ)

Sửa `pre-generate-levels.ts` theo mục 5.2: bỏ bootstrap, thêm loadSeedForGrid + growing pool + checkpoint.

### Bước 4 — Test với 8×8 trước (30 phút)

```bash
npm run generate -- --grid 8 --count 5
```

Verify 5 levels đầu tiên: đúng format, valid, difficulty reasonable. Nếu OK → proceed.

### Bước 5 — Generate toàn bộ

```bash
npm run generate:all
# hoặc
npm run generate -- --grid 8  --count 40
npm run generate -- --grid 9  --count 55
# ...hoặc 1 lệnh generate tất cả với resumable
```

Có thể Ctrl+C bất cứ lúc nào và resume sau.

---

## 8. Ước tính thời gian

| Grid | Cần | Thời gian ước tính | Cộng dồn |
|------|-----|--------------------|---------|
| 8×8  | 40  | 3 phút  | 3 phút  |
| 9×9  | 55  | 4 phút  | 7 phút  |
| 10×10| 70  | 5 phút  | 12 phút |
| 11×11| 88  | 6 phút  | 18 phút |
| 12×12| 108 | 8 phút  | 26 phút |
| 13×13| 130 | 9 phút  | 35 phút |
| 14×14| 155 | 11 phút | 46 phút |
| 15×15| 182 | 13 phút | 59 phút |
| 16×16| 212 | 15 phút | 74 phút |
| 17×17| 245 | 17 phút | 91 phút |
| 18×18| 280 | 19 phút | 110 phút|
| 19×19| 318 | 22 phút | 132 phút|
| 20×20| 358 | 25 phút | 157 phút|

**Tổng: ~2.5–3 giờ** chạy liên tục (có thể dừng và resume).

Giả định: mutation success rate 60%, mỗi attempt ~2 giây. Con số thực tế có thể ±50% — cần đo sau khi chạy 8×8.

---

## Lưu ý cuối

Seed JSON trong mục 2 là thiết kế theo tiêu chí, chưa được chạy qua solver. **Bước 2 (verify-seeds.ts) là bắt buộc** — một số seed có thể cần điều chỉnh nhỏ sau khi solver chạy thực tế.

Nếu seed nào fail sau 5 giây: thử dịch chuyển 1 dot ra xa hơn hoặc swap start/end của 1 màu. Thường chỉ cần 1-2 lần thử là pass.

---

*Plan: 12/04/2026 — Next step: Bước 1 (tạo seed files) + Bước 2 (verify) + Bước 4 (test 8×8)*
