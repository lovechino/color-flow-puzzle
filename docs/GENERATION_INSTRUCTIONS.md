# Hướng dẫn Pre-Generation Levels

## Vấn đề

Script pre-generation **KHÔNG THỂ CHẠY** trong chat session vì:
- Timeout giới hạn 10 phút
- Generation cần 10-60 phút tùy grid size
- Solver success rate thấp (~10%)

## Giải pháp: Chạy trên máy của bạn

### Option 1: Windows Batch Script (Khuyến nghị)

```cmd
# Mở Command Prompt trong thư mục project
generate-levels.bat

# Hoặc chỉ generate grid cụ thể
generate-levels.bat --grid 5
```

Script sẽ:
- Tự động generate levels
- Hiển thị progress real-time
- Có thể pause/resume (Ctrl+C và chạy lại)
- Log đầy đủ để debug

### Option 2: NPM Scripts

```bash
# Generate grids 3x3 - 6x3 (~10 phút)
npm run pre-generate

# Generate grid cụ thể
npm run pre-generate:grid6

# Generate TẤT CẢ grids 3-20 (~28 giờ)
npx tsx scripts/pre-generate-levels.ts
```

### Option 3: Chạy Background (cho grids lớn)

```bash
# Linux/Mac
nohup npx tsx scripts/pre-generate-levels.ts > generation.log 2>&1 &
tail -f generation.log

# Windows (PowerShell)
Start-Process -NoNewWindow -FilePath "npx" -ArgumentList "tsx", "scripts/pre-generate-levels.ts" -RedirectStandardOutput "generation.log" -RedirectStandardError "generation.log"
Get-Content generation.log -Wait
```

---

## Kiểm tra tiến độ

### Xem levels đã có

```bash
# Windows
dir src\levels\grid_*\*.json

# Linux/Mac
find src/levels -name "*.json" | wc -l
```

### Validate levels

```bash
npm run validate
```

Kết quả mong đợi:
```
✅ Grid 3×3: 3/3 valid   (100%)
✅ Grid 4×4: 5/5 valid   (100%)
✅ Grid 5×5: 10/10 valid (100%)
✅ Grid 6×6: 18/18 valid (100%)
```

---

## Xử lý sự cố

### Generation quá chậm

**Triệu chứng:** 1 level mất >5 phút

**Nguyên nhân:** Solver success rate 10%

**Giải pháp:**
1. Đợi thêm - script sẽ retry đến 50 attempts
2. Nếu vẫn fail, giảm color count trong `src/config.ts`
3. Hoặc skip level đó và retry sau

### Level bị invalid sau generation

**Kiểm tra:**
```bash
npm run validate
```

**Fix:**
```bash
# Xóa level invalid
del src\levels\grid_05\g05_XXX.json

# Regenerate
npm run pre-generate:grid5
```

### Out of memory

**Triệu chứng:** Error: JavaScript heap out of memory

**Fix:**
```bash
# Tăng memory limit
node --max-old-space-size=4096 node_modules/.bin/tsx scripts/pre-generate-levels.ts
```

---

## Kết quả mong đợi

### Sau khi generate grids 3×3-6×6

```
src/levels/
├── grid_03/
│   ├── g03_001.json
│   ├── g03_002.json
│   ├── g03_003.json
│   └── index.ts
├── grid_04/ (5 levels)
├── grid_05/ (10 levels)
├── grid_06/ (18 levels)
└── generation-stats.json
```

**Tổng:** 36 levels
**Thời gian:** ~10 phút
**Dung lượng:** ~500KB

### Validation

```
✅ Grid 3×3: 3/3 valid   (100%)
✅ Grid 4×4: 5/5 valid   (100%)
✅ Grid 5×5: 10/10 valid (100%)
✅ Grid 6×6: 18/18 valid (100%)

Total: 36/36 valid (100%)
```

---

## Commit kết quả

Sau khi generation thành công:

```bash
git add src/levels/
git commit -m "Add pre-generated levels for 3×3-6×6 (36 levels)"
```

---

## Next Steps

Sau khi có levels 3×3-6×6:

1. **Phase 4:** Update game để load levels từ JSON
2. **Phase 5:** Generate thêm grids 7×7-10×10 (~1 giờ)
3. **Launch:** Generate grids lớn hơn khi cần

---

*Hướng dẫn được tạo: 11/04/2026*
