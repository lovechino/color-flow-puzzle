# Fix Plan: 8×8+ Generation Stuck Issue

**Created:** 13/04/2026  
**Priority:** 🔴 Critical (blocks Phase 5)  
**Estimated effort:** 2-3 hours implementation

---

## 1. Problem Analysis

### Symptoms
- 8×8 generation stuck at bootstrap step
- No output for 30+ minutes
- No error messages (silent failure)

### Root Causes (Ranked by likelihood)

| # | Cause | Impact | Probability |
|---|-------|--------|-------------|
| 1 | **Progressive bootstrap still too hard** — 6 colors on 8×8 is still too many constraints | High | 70% |
| 2 | **Solver timeout** — `generate()` hits maxAttempts (500 for 8×8) and returns null repeatedly | High | 60% |
| 3 | **No logging during bootstrap** — User can't see progress, thinks it's stuck | Medium | 40% |
| 4 | **Memory exhaustion** — Large grids + many attempts → GC pressure | Low | 10% |

### Why Progressive Bootstrap Fails for 8×8

```
8×8 grid = 64 ô
6 colors × 2 dots = 12 dots
52 ô trống cần fill

Solver needs to find paths cho 6 colors đồng thời
Backtracking tree: ~6! × 50^6 nodes = ~10^14 nodes
maxAttempts = 500 → explores ~500 × 100K nodes = 5×10^7 nodes
→ Coverage: 5×10^7 / 10^14 = 0.00005% → gần như không thể tìm được solution
```

---

## 2. Proposed Solutions (3-Phase Approach)

### Phase 1: Quick Fix — Reduce to 3 Colors for Bootstrap (30 min)

**Idea:** Bootstrap với **3 colors** thay vì N-2. Sau khi có seed, mutate lên N colors.

```typescript
// Current (fails):
minColors = max(3, numColors - 2);  // 8×8: 6 colors

// Fix:
minColors = 3;  // Always start with 3 colors
maxColors = 4;  // Max 4 colors for bootstrap
```

**Pros:**
- ✅ Dễ implement (1 dòng thay đổi)
- ✅ 3 colors trên 8×8 = 6 dots + 58 ô trống → nhiều options
- ✅ Success rate ước tính: ~20-30%

**Cons:**
- ⚠️ Level quality có thể không đồng đều (3-color seed → 8-color mutated)
- ⚠️ Mutation từ 3→8 colors có thể fail nhiều

**Implementation:**
```diff
- const [minColors, maxColors] = [Math.max(3, numColors - 2), numColors];
+ const [minColors, maxColors] = [3, Math.min(4, numColors)];
```

**Files to change:**
- `src/generator/PuzzleGenerator.ts` (bootstrap function)

---

### Phase 2: Better Fix — Pre-baked Seed Levels (1 hour)

**Idea:** Tạo sẵn **1 seed level per grid size** bằng tay (hoặc offline generation), commit vào repo. Dùng seeds này để mutate.

**Seed levels cần tạo:**

| Grid | File | Status |
|------|------|--------|
| 7×7 | `src/seeds/g07_seed.json` | ❌ Chưa có |
| 8×8 | `src/seeds/g08_seed.json` | ❌ Chưa có |
| 9×9 | `src/seeds/g09_seed.json` | ❌ Chưa có |
| ... | ... | ❌ |

**Cách tạo seed level:**
1. Chạy generation với 3 colors (Phase 1 fix) để tìm level đầu tiên
2. Validate level đó
3. Save vào `src/seeds/`
4. Commit vào repo

**Cách dùng:**
```typescript
function loadSeed(gridSize: number): LevelData | null {
  const seedPath = join(process.cwd(), 'src', 'seeds', `g${gridSize}_seed.json`);
  if (!existsSync(seedPath)) return null;
  return JSON.parse(readFileSync(seedPath, 'utf8'));
}

function generateByMutation(gridSize, levelCount, ...):
  // Try load pre-baked seed first
  let seed = loadSeed(gridSize);
  
  if (!seed) {
    // Fallback: bootstrap from scratch
    console.log('  🔨 No pre-baked seed, bootstrapping...');
    seed = bootstrapWithRetry(gridSize, 3, 5000); // Try 5000 times with 3 colors
  }
  
  // Then mutate from seed
  ...
```

**Pros:**
- ✅ Bootstrap chỉ chạy 1 lần (sau đó commit seed vào repo)
- ✅ Mutation từ valid seed → success rate cao (~50-70%)
- ✅ Reproducible: cùng seed → cùng levels

**Cons:**
- ⚠️ Cần tạo seeds cho 14 grid sizes (7×7 → 20×20)
- ⚠️ Seeds có thể không cover hết difficulty range

**Files to create:**
- `src/seeds/` directory
- `g07_seed.json`, `g08_seed.json`, ... `g20_seed.json`
- Update `scripts/pre-generate-levels.ts` để load seeds

---

### Phase 3: Ultimate Fix — Smart Bootstrap with Heuristics (2-3 hours)

**Idea:** Thay vì random placement, dùng **constraint-based placement** để tạo configuration có khả năng solvable cao.

**Thuật toán:**

```
1. Place dots theo pattern (không random):
   - Đảm bảo mỗi color có start và end ở các quadrants khác nhau
   - Tránh clustering dots vào 1 khu vực
   - Đảm bảo有足够的 empty cells giữa các dots

2. Verify placement bằng fast check:
   - Chạy BFS từ mỗi dot → check nếu reach được end dot
   - Nếu không reach → retry placement

3. Solve với relaxed constraints:
   - Tăng maxAttempts lên 2000 cho 8×8
   - Giảm difficulty target để dễ pass hơn
```

**Implementation chi tiết:**

```typescript
function smartBootstrap(gridSize, numColors, ...):
  for attempt in 0..maxAttempts:
    // Step 1: Pattern-based placement
    pairs = placeDotsWithPattern(gridSize, numColors, attempt);
    
    // Step 2: Fast BFS check
    if (!canReachAllEndpoints(pairs, gridSize)) continue;
    
    // Step 3: Solve
    solution = solver.solve(gridSize, pairs);
    if (solution) return { pairs, solution };
  
  return null;

function placeDotsWithPattern(gridSize, numColors, seed):
  rng = SeededRandom(seed);
  pairs = [];
  
  // Place dots in a spiral pattern from center
  // This ensures good spread and solvability
  positions = generateSpiralPositions(gridSize);
  
  for i in 0..numColors:
    start = positions[i * 2];
    end = positions[i * 2 + 1];
    pairs.push({ color: COLORS[i], start, end });
  
  return pairs;
```

**Pros:**
- ✅ Success rate cao nhất (~30-50%)
- ✅ Level quality tốt hơn (pattern-based placement)
- ✅ Scalable cho grids lớn hơn

**Cons:**
- ⚠️ Complex implementation
- ⚠️ Cần testing kỹ cho mỗi grid size

---

## 3. Recommended Approach

**Phase 1 ngay** → Giải quyết vấn đề trước mắt cho 8×8  
**Phase 2 trong tuần này** → Tạo seeds cho 7×7-12×12  
**Phase 3 khi có thời gian** → Improve cho grids 13×13+

### Implementation Order

```
[Step 1] Fix bootstrap minColors (5 min)
   ↓
[Step 2] Test 7×7 generation (15 min)
   ↓
[Step 3] Test 8×8 generation (30 min)
   ↓
[Step 4] If works → save seeds for Phase 2 (10 min)
   ↓
[Step 5] Document in CHANGELOG.md (15 min)
```

**Total time for Steps 1-3:** ~1 giờ

---

## 4. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Phase 1 still fails for 8×8 | High | 30% | Fall back to Phase 2 |
| Mutation quality degrades (3-color seed → 8-color level) | Medium | 40% | Acceptable trade-off |
| Seeds become outdated/inconsistent | Low | 10% | Regenerate periodically |
| Smart bootstrap too complex | Medium | 20% | Phase 3 only, not urgent |

---

## 5. Success Criteria

- [ ] 7×7 generates 28/28 levels in < 1 hour
- [ ] 8×8 generates 40/40 levels in < 2 hours
- [ ] All generated levels pass `npm run validate`
- [ ] No crashes or hangs during generation
- [ ] Difficulty distribution is reasonable (10-60 range)

---

## 6. Rollback Plan

Nếu Phase 1 không hoạt động:

1. Revert bootstrap changes: `git checkout HEAD~1 -- src/generator/PuzzleGenerator.ts`
2. Skip 8×8 for now, focus on 7×7
3. Implement Phase 2 (pre-baked seeds) thay thế

---

*Plan created: 13/04/2026*  
*For review — do not implement without approval*
