# Báo Cáo Khắc Phục Lỗi Hệ Thống (10/04/2026)

Tài liệu này ghi lại chi tiết các lỗi kỹ thuật và vi phạm tiêu chuẩn Code Standard đã được phát hiện và xử lý trong hệ thống generator của Color Flow Puzzle.

## 1. Lỗi Logic và Định Nghĩa (Definition Errors)

### Lỗi: Undefined Property `maxCalls`
- **Mô tả**: Trong class `BacktrackingSolver` (file `BuildSolution.ts`), code thực hiện gán giá trị và kiểm tra thuộc tính `this.maxCalls` nhưng thuộc tính này chưa được khai báo trong định nghĩa class.
- **Hệ quả**: Gây lỗi TypeScript `Property 'maxCalls' does not exist on type 'BacktrackingSolver'`.
- **Cách xử lý**: Đã thêm khai báo `private maxCalls = 0;` vào cấu trúc class và xóa hằng số `MAX_CALLS` không còn sử dụng.

## 2. Lỗi Module Resolution (Import/Export)

### Lỗi: Illegal `.ts` Extension in Imports
- **Mô tả**: Các file import thường xuyên bao gồm đuôi `.ts` (ví dụ: `import { ... } from '../../types.ts'`).
- **Hệ quả**: Khi chạy ở chế độ ES Modules (ESM) mà không có loader phù hợp, Node.js và `tsc` sẽ báo lỗi không tìm thấy module vì đuôi `.ts` không được hỗ trợ chính thức trong đường dẫn import tiêu chuẩn của ESM.
- **Cách xử lý**:
    - Chuyển tất cả import từ dạng `path/to/file.ts` sang `path/to/file` (omitted extension) hoặc `path/to/file.js` (nếu bắt buộc).
    - Sử dụng `tsx` thay cho `ts-node` để thực thi các script độc lập. `tsx` hỗ trợ tự động giải quyết các module TS mà không cần can thiệp sâu vào đuôi file.

## 3. Vi phạm Tiêu chuẩn Code Standard (Rule R1)

### Lỗi: Method Length Overload
- **Mô tả**: Nhiều phương thức cốt lõi như `solve`, `backtrack`, `findAllPaths`, `placeDots`, và `place` vượt quá giới hạn **20 dòng** quy định trong quy tắc global R1.
- **Hệ quả**: Code khó đọc, khó bảo trì và vi phạm nghiêm trọng kiến trúc SRP (Single Responsibility Principle).
- **Cách xử lý**: Thực hiện chiết xuất logic (method extraction) ra các helper method chuyên biệt.
    - Ví dụ: `solve` được chia nhỏ thành `initSession`, `sortPairs`, và `formatResult`.
    - Các thuật toán phức tạp như DFS/BFS được tách phần xử lý queue/recursive và phần tìm kiếm lân cận (neighbor finding).

## 4. Lỗi "Dead Code" (Unused Variables)

### Lỗi: Biến và Import không sử dụng
- **Mô tả**: Xuất hiện nhiều biến thừa (`rng`, `createRootIndex`, `statSync`) và các type import không dùng (`LevelData`).
- **Hệ quả**: Báo lỗi linter/compiler khi bật chế độ `noUnusedLocals` và làm bẩn codebase.
- **Cách xử lý**: Đã rà soát và xóa bỏ toàn bộ các khai báo thừa trong `PlaceMechanics.ts`, `Grid.ts`, và các file script.

---

## 💡 Bài học kinh nghiệm cho tương lai:

1.  **Chạy `npm run build` thường xuyên**: Để phát hiện sớm các lỗi type và unused variables.
2.  **Tuân thủ R1 ngay từ đầu**: Không viết hàm quá 20 dòng. Nếu hàm bắt đầu dài, hãy dừng lại và tách nhỏ logic ngay lập tức.
3.  **Hệ thống Import**: Không sử dụng đuôi `.ts` trong đường dẫn import trừ khi có cấu hình loader đặc biệt. Ưu tiên omit extension để đảm bảo tính tương thích giữa Vite và Node.js environments.
4.  **Runtime Loader**: Sử dụng `npx tsx <file>` thay vì `ts-node` để có trải nghiệm ESM + TypeScript mượt mà nhất.
