# T03 — Persistence và migration an toàn

## Phụ thuộc

T02 phải được `ACCEPTED`.

## Phạm vi

Đưa canonical contract vào persistence layer hiện hữu, có migration idempotent và seed/ingest chạy chủ động.

## Việc cần làm

1. Thêm migration tạo bảng course, unit, term, course_term, import_run và index cho lookup `level`, `course_code`, `unit`, normalized word.
2. Thêm command ingest explicit, transactional theo một import run. Lỗi validation phải rollback toàn run; không được xóa dữ liệu đang live trước khi run thành công.
3. Quy tắc upsert phải dựa trên stable id/hash và không ghi đè manually-curated fields.
4. Ghi provenance và version import cho mọi record.

## Ràng buộc

- Migration chỉ tiến (forward-only); không drop/alter bảng SRS, auth, dictionary, JLPT hiện có.
- Không chạy migration hay ingest trên Neon/production trong task này.
- Không dùng JSON blob cho toàn course; cần bảng quan hệ truy vấn được.

## Acceptance

- Integration test trên database test: migrate mới, ingest 2 lần không nhân bản, record lỗi rollback.
- `EXPLAIN`/test chứng minh browse theo course/unit không full scan master data.
- Có hướng dẫn rollback bằng migration mới hoặc disable visibility, không dùng xóa dữ liệu.

## Trạng thái thực hiện & Kết quả nghiệm thu (T03)

- **Trạng thái:** `COMPLETED (READY FOR APPROVAL)`
- **Tệp Migration PostgreSQL mới:** `server/db/migrations/008_curriculum_tables.sql` (chỉ tiến, tạo 5 bảng quan hệ và 7 index tra cứu).
- **Persistence Adapter & Ingest Engine:** `server/db/curriculum-persistence.mjs` (hỗ trợ cả PostgreSQL và SQLite, quản lý transaction nguyên tử và cờ `is_curated`, tính/nhận hash chuẩn từ file artifact).
- **Lệnh Ingest Explicit:** `npm run curriculum:ingest` (`scripts/curriculum/ingest.mjs`), có chốt chặn an toàn (safety guard) ngăn chặn tuyệt đối việc ghi nhầm vào Neon production. Truyền SHA-256 bytes của file artifact trực tiếp vào `curriculum_import_runs.dataset_hash`.
- **Tài liệu Hướng dẫn Rollback:** `docs/plans/vocabulary-curriculum/rollback-guide.md` (hướng dẫn ẩn visibility và đánh dấu run rollback mà không xóa dữ liệu).
- **Kết quả Kiểm thử Tự động:**
  - `node --test scripts/curriculum/*.test.mjs`: **32/32 passed** (100% pass across 3 suites: audit, normalize, persistence).
  - Test hash match: Ingest từ tệp thật `tmp/curriculum/canonical-dataset.json`, assert `curriculum_import_runs.dataset_hash` trong DB đúng bằng `7d874ccd847c6b368803e1f7a1f4d14acf6eeb2333d6134740ed7844d07674dd` (khớp 100% SHA-256 của file artifact).
  - Test idempotence: nạp 2 lần liên tiếp không làm tăng số lượng records (19 courses, 268 units, 8.616 terms, 9.410 course_terms).
  - Test atomic rollback mid-transaction: Sử dụng SQLite trigger giả lập lỗi DB tại bảng `curriculum_terms` (sau khi đã insert import run, courses, units); assert transaction rollback sạch sẽ, để lại 0 import runs và 0 orphan records.
  - Test curated protection: các trường chỉnh sửa thủ công (`is_curated = 1`) không bị ghi đè.
  - Test EXPLAIN query plan: 100% truy vấn browse và search sử dụng index, không bị full table scan.
- **Typecheck & Linter:** `npm run typecheck` (0 errors) và `npx oxlint` (0 warnings, 0 errors).

