# 🧩 Color Flow Puzzle — AI Project Context (GEMINI.md)

> Đây là file context bắt buộc phải đọc trước khi thực hiện BẤT KỲ tác vụ nào trong project này.
> AI assistant phải tuân thủ tuyệt đối các rule dưới đây, đặc biệt là các quy định về Generator Pipeline.

---

## 📌 1. PROJECT IDENTITY

| Thuộc tính | Giá trị |
|-----------|---------|
| **Tên game** | Color Flow Puzzle |
| **Thể loại** | Logic Puzzle Game (Nối điểm màu) |
| **Platform** | Web / Mobile (Phaser 3) |
| **Engine** | Phaser 3 + TypeScript + Vite |
| **Đặc trưng** | Có hệ thống tự sinh màn chơi (Procedural Level Generation) |

### Core Concept (1 câu)
> Người chơi nối các điểm (dots) cùng màu trên một lưới (grid) sao cho không đường nào cắt nhau, lấp đầy lưới hoặc vượt qua các chướng ngại vật (walls, teleports, mixers).

---

## 🏗️ 2. KIẾN TRÚC BẮT BUỘC (Violate = Reject)

### 2.1 Layer Architecture (SRP)

```
src/
 ├── scenes/          ← CHỈ render Phaser + handle input. KHÔNG chứa core logic phức tạp.
 │    ├── GameScene.ts
 │    └── LevelSelectScene.ts
 │
 ├── game/            ← Core gameplay logic, Grid validation, Path tracing.
 │    ├── GridLogic.ts
 │    ├── Path.ts
 │    └── WinChecker.ts
 │
 ├── generator/       ← Pipeline tự sinh màn chơi (Brain của project).
 │    ├── PuzzleGenerator.ts
 │    ├── steps/      (PlaceDots, BuildSolution, ValidateUnique, ...)
 │    └── DifficultyScorer.ts
 │
 ├── storage/         ← Quản lý lưu trữ IndexedDB/Local storage.
 ├── utils/           ← Thuần algorithm, Helper function.
 └── types/           ← Chứa TypeScript interfaces.

scripts/              ← Chứa Node.js scripts để sinh level batch (chạy bằng tsx).
```

### 2.2 Hard Rules — Vi phạm là BLOCKER

| Rule | Mô tả |
|------|-------|
| **R-ARCH-01** | File source ≤ 400 dòng. Nếu vượt quá → PHẢI tách file. |
| **R-ARCH-02** | Function/method ≤ 20 dòng. Quá dài → extract ra helper. |
| **R-ARCH-03** | `scenes/` KHÔNG chứa thuật toán pathfinding hay validation. Cần gọi qua `game/` hoặc `utils/`. |
| **R-ARCH-04** | `generator/` phải chạy được cả trên Node.js (via `scripts/`) và Browser. KHÔNG được import Phaser vào `generator/`. |
| **R-ARCH-05** | Luôn tách bạch giữa Level Data (JSON thuần) và Game State (Phaser Objects). |

---

## 🧠 3. GENERATOR PIPELINE — The Heart of the Game

Generator là hệ thống phức tạp nhất. Bất kỳ thay đổi nào cũng phải tuân theo luồng 5 bước:

1. **Place Dots**: Rải các cặp điểm màu lên grid (có heuristic tránh góc kẹt).
2. **Solve (Backtracking)**: Dùng DFS/Backtracking để tìm xem có đường đi hợp lệ nào nối hết các cặp điểm không. Bắt buộc có cơ chế **Timeout** để tránh treo máy.
3. **Place Mechanics**: Bổ sung chướng ngại vật (Walls, Mixers, Teleports, Locks, ShapeMask) dựa trên đường đi giải được.
4. **Validate Unique**: (QUAN TRỌNG) Phải đếm số lượng solution khả thi. Màn chơi hợp lệ CHỈ KHI có đúng 1 solution (Unique). Nếu `solutionCount !== 1`, loại bỏ màn chơi.
5. **Constraint Propagation**: Loại bỏ các tình huống logic sai lầm trước khi chấp nhận màn.

> **DO'S (Điều được làm):**
> - Giữ timeout chặt chẽ cho Solver (ví dụ: grid 7x7 tối đa 3000ms).
> - Ưu tiên trả về `null` sớm nếu phát hiện seed vô nghiệm.

> **DON'TS (Điều KHÔNG ĐƯỢC làm):**
> - KHÔNG bỏ qua bước `ValidateUnique` để tăng tốc độ gen. Màn chơi nhiều nghiệm sẽ phá hỏng logic giải đố.
> - KHÔNG sinh level thẳng trên UI Thread của trình duyệt (sẽ làm freeze trang), sử dụng `GeneratorWorker` hoặc batch Node script.

---

## 🎮 4. GAME MECHANICS — Tính năng In-Game

Các mechanics hỗ trợ:
- **Dot**: Điểm bắt đầu / Kết thúc.
- **Wall**: Ô không thể đi qua.
- **Mixer**: Ô trộn màu.
- **Teleport**: Ô dịch chuyển sang teleport cùng ID.
- **Lock**: Ô bị khóa.

**Validation Rule trong GameScene:**
- Player chỉ bắt đầu vẽ khi tap vào `Dot`.
- Đường đi không được chéo.
- Khi lùi lại trên đường đã vẽ, tự động xóa đoạn đường bị lùi.
- Khi đường mới cắt đường cũ, đoạn bị cắt của đường cũ tự động bị đứt.

---

## 🎨 5. ASSET & CODE STANDARDS

### Naming Convention
- Tên file asset: `[category]_[name].ext` (100% chữ thường, underscore. VD: `bg_main.jpg`, `sfx_click.mp3`).
- File ảnh tĩnh, UI: ưu tiên render bằng code (Phaser Graphics) với màu Hex để tối ưu bộ nhớ.

### Typescript Rules
```json
{
  "strict": true,
  "noImplicitAny": true
}
```
- Không sử dụng `any`. Bắt buộc định nghĩa interface trong thư mục `src/types/`.

---

## 🤖 6. AI BEHAVIOR RULES (BẮT BUỘC)

### Rule A — Surgical Changes
- **Chỉ sửa đúng những gì cần thiết.** Không tự ý format code xung quanh, không "cải thiện" kiến trúc đang chạy ổn định nếu user không yêu cầu.
- Nếu thấy dead code, hãy **mention** (nhắc nhở user), không tự động xóa.

### Rule B — Think Before Coding
1. **State assumptions**: Nếu requirement không rõ, liệt kê các hướng xử lý để chọn.
2. **Performance check**: Khi đụng vào file trong thư mục `generator/`, tự hỏi: *"Code này có làm tăng số nhánh đệ quy theo cấp số nhân không?"* Nếu có, dừng lại và cảnh báo.

### Rule C — Hậu kiểm (Post-Code Bug Check)
Sau khi viết code, tự kiểm tra:
- Hàm gọi đã truyền đúng biến chưa?
- File `package.json` có script để test chưa? (VD: `npm run generate`).
- Có import nhầm thư viện Node.js (`fs`, `path`) vào file chạy trên Browser không?

---
*Generated for Color-flow-puzzle.*
