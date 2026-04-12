# Pre-Generated Levels System

## Tổng quan

Hệ thống này **pre-generate** tất cả puzzle levels offline và lưu dưới dạng JSON files. Runtime sẽ **CHỈ LOAD** các levels có sẵn - KHÔNG generate lúc runtime.

### Lợi ích

✅ **Không còn generation lag** - Runtime chỉ load JSON ( < 10ms)  
✅ **Levels được validate trước** - 100% levels có unique solution  
✅ **Reproducible** - Cùng seed = cùng level  
✅ **Resumable** - Có thể pause/resume generation  
✅ **Progress tracking** - Biết chính xác ETA  

---

## Cấu trúc levels

```
src/levels/
├── grid_03/
│   ├── g03_001.json          # Level 1, grid 3×3
│   ├── g03_002.json
│   ├── g03_003.json
│   └── index.ts              # Metadata index
├── grid_04/
│   ├── g04_001.json
│   ├── ...
│   └── index.ts
├── ...
├── grid_20/
│   ├── g20_001.json
│   ├── ...
│   └── index.ts
└── generation-stats.json      # Progress tracking (auto-generated)
```

### Số lượng levels theo grid size

| Grid Size | Levels | Difficulty Range | Estimated Gen Time |
|-----------|--------|------------------|-------------------|
| 3×3 | 3 | 10-40 (trivial-medium) | 30s |
| 4×4 | 5 | 10-40 | 1m |
| 5×5 | 10 | 10-40 | 2m |
| 6×6 | 18 | 20-60 (easy-hard) | 5m |
| 7×7 | 28 | 20-60 | 10m |
| 8×8 | 40 | 20-60 | 15m |
| 9×9 | 55 | 30-75 (medium-expert) | 25m |
| 10×10 | 70 | 30-75 | 35m |
| 11×11 | 88 | 40-85 (hard-master) | 50m |
| 12×12 | 108 | 40-85 | 1h |
| 13×13 | 130 | 50-95 (expert-legendary) | 1.5h |
| 14×14 | 155 | 50-95 | 2h |
| 15×15 | 182 | 50-95 | 2.5h |
| 16×16 | 212 | 50-95 | 3h |
| 17×17 | 245 | 50-95 | 3.5h |
| 18×18 | 280 | 50-95 | 4h |
| 19×19 | 318 | 50-95 | 5h |
| 20×20 | 358 | 50-95 | 6h |
| **TOTAL** | **2305** | | **~28 hours** |

---

## Sử dụng

### Generate tất cả levels

```bash
npm run pre-generate
```

⚠️ **Lưu ý:** Sẽ mất ~28 giờ để generate toàn bộ 2305 levels!

### Generate grid size cụ thể

```bash
# Chỉ generate 6×6
npm run pre-generate:grid6

# Hoặc dùng script trực tiếp
npx tsx scripts/pre-generate-levels.ts --grid 6
```

### Resume generation

Script tự động resume từ nơi bị gián đoạn. Chỉ cần chạy lại:

```bash
npm run pre-generate
```

Nó sẽ:
1. Load `generation-stats.json`
2. Check levels nào đã tồn tại
3. Skip levels đã generate
4. Tiếp tục từ level chưa có

### Validate levels

```bash
npm run validate
```

Kiểm tra tất cả levels có:
- ✅ Unique solution (count = 1)
- ✅ All dots connected
- ✅ Valid structure

---

## Cách hoạt động

### 1. Generation Pipeline

```
Seed → PlaceDots → Solve → ValidateUnique → PlaceMechanics → ScoreDifficulty → JSON
```

Mỗi level được generate với:
- **Deterministic seed**: `g06_015_attempt7`
- **Target difficulty**: Spread evenly across range
- **Color count**: Based on grid size & difficulty
- **Mechanics**: Unlocked theo grid size

### 2. Retry Logic

Mỗi level có tối đa **50 attempts**. Nếu fail hết:
- Đánh dấu failed trong stats
- Continue qua level tiếp theo
- Có thể retry sau bằng cách xóa level JSON

### 3. Progress Tracking

File `generation-stats.json` lưu:
```json
{
  "totalLevels": 2305,
  "generatedLevels": 156,
  "failedLevels": 3,
  "startTime": 1712851200000,
  "gridStats": {
    "3": { "total": 3, "generated": 3, "failed": 0, "timeMs": 28456 },
    "6": { "total": 18, "generated": 12, "failed": 1, "timeMs": 285000 }
  }
}
```

---

## Integration với Game

### Load levels từ JSON

```typescript
// src/scenes/LevelSelectScene.ts
import { levels as grid03 } from '../levels/grid_03/index';
import { levels as grid06 } from '../levels/grid_06/index';

function loadLevel(levelId: string): LevelData {
  const gridKey = levelId.substring(1, 3); // "03", "06", etc.
  const levels = gridLevels[gridKey];
  return levels[levelId];
}
```

### Runtime KHÔNG generate

```typescript
// ❌ SAO - Runtime generation
const level = generator.generate({ gridSize: 15, ... });

// ✅ ĐÚNG - Load pre-generated
const level = loadLevel('g15_042');
```

---

## Best Practices

### 1. Commit levels vào Git

```bash
git add src/levels/
git commit -m "Add pre-generated levels for 3×3-10×10"
```

### 2. Generate incremental

Đừng generate tất cả cùng lúc. Làm theo từng batch:

```bash
# Week 1: Small grids
npm run pre-generate:grid3
npm run pre-generate:grid4
npm run pre-generate:grid5

# Week 2: Medium grids
npm run pre-generate:grid6
npm run pre-generate:grid7
npm run pre-generate:grid8

# etc.
```

### 3. Validate sau khi generate

```bash
npm run validate
```

Sửa ngay nếu có level invalid.

### 4. Backup generation stats

```bash
cp src/levels/generation-stats.json backups/
```

Để có thể resume sau nếu delete local.

---

## Troubleshooting

### Generation quá chậm

**Nguyên nhân:** Solver success rate thấp (10-20%)

**Giải pháp:**
1. Tăng `maxRetries` trong script (hiện tại: 50)
2. Giảm color count cho grid đó
3. Adjust difficulty range

### Level bị invalid

**Kiểm tra:**
```bash
npm run validate
```

**Fix:**
1. Xóa level JSON bị invalid
2. Chạy lại generation cho grid đó
3. Script sẽ regenerate từ đầu

### Out of memory

Grid lớn (15×15+) có thể tốn RAM.

**Giải pháp:**
- Close apps khác
- Tăng Node.js memory: `node --max-old-space-size=4096`

---

## Migration từ Old System

Nếu đã có levels từ `generate-all-levels.ts`:

1. Script pre-generation sẽ **tự động skip** levels đã tồn tại
2. Không cần xóa gì cả
3. Chỉ cần chạy `npm run pre-generate`

---

## Future Improvements

- [ ] Parallel generation (worker threads)
- [ ] Cloud generation (AWS Lambda)
- [ ] Auto-regenerate failed levels
- [ ] Level quality scoring
- [ ] Player feedback integration

---

*Tài liệu được tạo: 11/04/2026*
