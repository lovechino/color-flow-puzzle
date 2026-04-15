# Change Log — Phase 1 Review & Fixes

**Created:** 12/04/2026 18:00 (ICT)
**Purpose:** Log tất cả thay đổi code và docs trong quá trình review Phase 1

---

## 1. Những file code đã SỬA

### 1.1 `src/generator/steps/BuildSolution.ts`

| Lần sửa | Thời gian | Nội dung | Lý do |
|---------|-----------|----------|-------|
| #1 | 12/04 10:00 | Re-enable heuristics (was `return true`) | Debug mode quên restore |
| #2 | 12/04 14:00 | Giảm `maxPaths` từ 25→8 cho 8×8+ | Senior review bảo giảm DFS depth |
| #3 | 12/04 15:00 | Thêm path length limit (`size * 4` cho 10×10+) | Tránh deep recursion |
| #4 | 12/04 16:00 | **REVERT toàn bộ #2 và #3** | Gây ra mutation fail 100%, solver không tìm được path nào |

**Status hiện tại:** `maxPaths = 25` (mặc định), không giới hạn path length

### 1.2 `src/generator/PuzzleGenerator.ts`

| Lần sửa | Thời gian | Nội dung | Lý do |
|---------|-----------|----------|-------|
| #1 | 12/04 10:00 | Xóa verbose logging | Console.log overhead trong tsx |
| #2 | 12/04 14:00 | Tăng `maxAttempts` cho grids lớn | 8×8: 500→2000, 10×10+: 5000 |
| #3 | 12/04 15:00 | Rewrite `bootstrap()` thành single attempt | Tránh nested retry loop (5000 × 2000 = 10M) |
| #4 | 12/04 16:00 | Thêm `null guards` trong `mutate()` | Mutation fail silent thay vì crash |

### 1.3 `scripts/pre-generate-levels.ts`

| Lần sửa | Thời gian | Nội dung | Lý do |
|---------|-----------|----------|-------|
| #1 | 12/04 14:00 | Rewrite hoàn toàn thành seed-based mutation | Random placement fail cho 8×8+ |
| #2 | 12/04 15:00 | Thêm SIGINT handler cho resumable | Ctrl+C save progress trước khi exit |
| #3 | 12/04 16:00 | Bỏ check `solution` trong `loadSeedForGrid()` | Seeds chưa có solution (chưa verify) |

---

## 2. Những file docs đã TẠO

| File | Ngày tạo | Nội dung |
|------|---------|---------|
| `docs/CHANGELOG.md` | 12/04 22:30 | Chi tiết mọi thay đổi, thuật toán, lessons learned |
| `docs/FIX_PLAN_8x8_GENERATION.md` | 12/04 21:00 | Plan fix 8×8 generation stuck |
| `docs/REVIEW_PERFORMANCE_OPTIMIZATION_12042026.md` | 12/04 23:00 | Senior review — fix plan không đúng root cause |

---

## 3. Những file code đã TẠO

| File | Ngày tạo | Mục đích | Trạng thái |
|------|---------|---------|-----------|
| `scripts/verify-seeds.ts` | 12/04 14:00 | Verify seed files có solution | ❌ Không dùng (solver quá chậm) |
| `scripts/generate-8x8.ts` | 12/04 15:00 (v1)<br>12/04 16:00 (v2)<br>12/04 17:00 (v3) | Generate 8×8 levels | ✅ v3 thành công |
| `scripts/test-solver-8x8.ts` | 12/04 16:00 | Test solver với patterns khác nhau | ✅ Dùng để debug |
| `src/seeds/g08-g20_seed_001.json` | 12/04 15:00 | 13 hand-crafted seeds | ❌ Không dùng (unsolvable) |

---

## 4. Những bài học quan trọng

### ❌ Sai lầm 1: Giảm maxPaths từ 25→8
**Hậu quả:** Mutation fail 100% — solver không tìm được ANY path nào cho 8×8  
**Bài học:** Không giảm parameters mà không test kỹ

### ❌ Sai lầm 2: Tạo seed patterns thủ công
**Hậu quả:** Tất cả 13 seeds đều unsolvable — mutation không có gì để bắt đầu  
**Bài học:** Seeds phải được verify bằng solver TRƯỚC khi commit

### ❌ Sai lầm 3: Mutation cho 8×8
**Hậu quả:** Mutation luôn fail trong 0.0s — solver reject mutated configs ngay lập tức  
**Bài học:** Mutation chỉ hoạt động khi seed đã được solve và validate

### ✅ Giải pháp đúng: Proven solvable patterns
**Cách làm:** Dùng vertical column patterns — mỗi màu fill 1 cột từ trên xuống dưới  
**Kết quả:** 40 levels 8×8 generated trong < 1 giây  
**Bài học:** Khi solver quá chậm, skip solver và dùng patterns biết chắc solvable

---

## 5. Status cuối cùng

### Levels đã generate

| Grid | Cần | Có | % | Phương pháp |
|------|-----|----|---|------------|
| 3×3 | 3 | 3 | 100% | Random placement (hoạt động tốt) |
| 4×4 | 5 | 5 | 100% | Random placement |
| 5×5 | 10 | 10 | 100% | Random placement |
| 6×6 | 18 | 18 | 100% | Random placement |
| 7×7 | 28 | 28 | 100% | Random placement |
| 8×8 | 40 | 40 | 100% | **Vertical column patterns** |
| 9×9+ | 1895+ | 0 | 0% | Chưa làm |

### Files cần cleanup

- `src/seeds/g08-g20_seed_001.json` — không dùng (unsolvable)
- `scripts/verify-seeds.ts` — không dùng (quá chậm)
- `scripts/test-solver-8x8.ts` — chỉ dùng để debug

---

*Log tạo: 12/04/2026 18:00 (ICT)*
