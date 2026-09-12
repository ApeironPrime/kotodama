# T02 — Canonical schema và importer tái lập

## Phụ thuộc

T01 phải được `ACCEPTED`.

## Phạm vi

Thiết kế canonical dataset có thể tái tạo từ manifest đã audit. Chưa ghi PostgreSQL/SQLite production và chưa thay UI.

## Canonical contract tối thiểu

- `course`: stable `course_code`, title, level (`A1|A2|N5…N1|SE`), provider/source, visibility, rights status.
- `unit`: stable `course_code + unit_key`, ordinal, title, topic.
- `term`: normalized Japanese key, display word/reading, meanings, han-viet, examples; không mất raw source reference.
- `course_term`: membership, unit, ordinal, source record id, provenance.
- `import_run`: source manifest hash, importer version, imported time, warning/error count.

## Việc cần làm

1. Viết schema TypeScript/Zod hoặc JSON schema và fixtures nhỏ, độc lập với DB.
2. Viết importer CLI deterministic: `npm run curriculum:normalize -- --source-root ... --out ...`; output bị gitignore nếu là artifact lớn.
3. Normalize Unicode (NFC), trim, dedupe có lý do; duplicate không được tự xóa nếu khác nghĩa/đọc/nguồn.
4. Tạo validation report: row count input/output, reject list, duplicate strategy, course/unit coverage.

## Ràng buộc

- Master JSON 9.411 records là input, không phải sự thật tuyệt đối: trường thiếu phải warning, không bịa nghĩa/đọc.
- Giữ raw record reference để truy vết ngược.
- Không nạp ảnh hoặc Markdown nguyên văn vào database.

## Acceptance

- Cùng input + cùng version importer => byte-stable output hoặc sort-stable output có hash không đổi.
- Unit tests cho NFC, field thiếu, duplicate hợp lệ, duplicate mâu thuẫn và source unknown.
- Không đụng `server/index.mjs`, UI hay migration ở task này.

## Trạng thái thực hiện & Kết quả nghiệm thu (T02)

- **Trạng thái:** `COMPLETED (READY FOR APPROVAL)`
- **SHA-256 Source Manifest:** `8f0a695f7590d7ad6da567e84ccff0b0bbba988b7fb8fb65067aef3bbe662e1b`
- **SHA-256 Canonical Dataset (`tmp/curriculum/canonical-dataset.json`):** `7d874ccd847c6b368803e1f7a1f4d14acf6eeb2333d6134740ed7844d07674dd` (100% tất định, hoàn toàn không chứa timestamp).
- **Bộ chuẩn hóa và kiểm chứng Canonical Schema toàn diện:**
  1. **Validate đầy đủ object lồng nhau:** `examples` (ja, vi), `raw_source_references` (source, raw_record_id, lesson, level), `provenance` (source, rights_status, raw_level, raw_lesson), và `source_record_id` (chỉ chấp nhận string/number, từ chối object rỗng `{}`).
  2. **Bắt buộc unique:** kiểm tra tính đơn nhất (uniqueness) cho `course_code`, `unit_id`, `term_id`, và cặp vị trí bài học `course_code + unit_id + ordinal`.
  3. **Đối chiếu số đếm import_run với mảng thực tế:** kiểm tra chéo các tổng `total_courses`, `total_units`, `total_canonical_terms`, `total_course_terms`, `warning_count`, `error_count` phải khớp tuyệt đối 100% với độ dài mảng dữ liệu thực tế.
  4. **Loại bỏ reading tiếng Việt:** Chuyển 1.975 reading tiếng Việt sang `meanings`, đặt `display_reading = ""`, gỡ bỏ `_` ở đầu từ (`おじぎをする`). 0 term nào có reading chứa Latin/tiếng Việt.
  5. **Loại bỏ `imported_at` khỏi dataset:** Dataset không còn metadata timestamp giả mạo.
- **Bộ kiểm thử tự động:** 24/24 test pass (`node --test scripts/curriculum/*.test.mjs`), bao gồm các test case cố tình làm hỏng cả 4 nhóm trường hợp trên. Typecheck (`tsc -b`) và Oxlint (0 errors, 0 warnings).

