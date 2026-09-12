# Hướng dẫn Vận hành và Rollback An toàn — Task T03

Tài liệu này quy định quy trình xử lý sự cố và rollback an toàn cho kho từ vựng giáo trình mà **tuyệt đối không làm mất dữ liệu thô (no data loss)** và không vi phạm toàn vẹn khóa ngoại của hệ thống học tập SRS.

---

## 1. Nguyên tắc Cốt lõi của Rollback

1. **Tuyệt đối không xóa cứng (No Hard Deletes):** Không chạy các lệnh `DROP TABLE`, `TRUNCATE`, hay `DELETE FROM curriculum_*` trên môi trường production.
2. **Bảo tồn liên kết SRS:** Bảng `srs_cards` trong tương lai sẽ tham chiếu tới `curriculum_terms` hoặc `curriculum_course_terms`. Xóa cứng term sẽ làm hỏng dữ liệu học tập và chu kỳ ôn tập Spaced Repetition của người dùng.
3. **Migration chỉ tiến (Forward-only):** Khi cần sửa đổi schema, luôn tạo tệp migration mới (`009_...sql`, `010_...sql`), không chỉnh sửa các tệp migration đã được áp dụng vào database.

---

## 2. Các Kịch bản Rollback Cụ thể

### Kịch bản A: Khóa học phát hiện có vấn đề bản quyền hoặc dữ liệu cần ẩn khẩn cấp

**Phương án tối ưu:** Tắt trạng thái hiển thị (`visibility = 'internal'`). Khóa học sẽ lập tức biến mất khỏi catalog công khai mà không ảnh hưởng tới các tiến trình đang học dở.

```sql
-- 1. Ẩn một khóa học cụ thể
UPDATE curriculum_courses
SET visibility = 'internal', updated_at = now()
WHERE course_code = 'speed-master-n5';

-- 2. Ẩn toàn bộ các khóa học thuộc một nguồn cung cấp
UPDATE curriculum_courses
SET visibility = 'internal', updated_at = now()
WHERE provider_source ILIKE '%SPEED_MASTER%';
```

---

### Kịch bản B: Một đợt Ingest đưa vào dữ liệu lỗi cần vô hiệu hóa

**Phương án tối ưu:** Đánh dấu trạng thái `status = 'rolled_back'` trong bảng theo dõi `curriculum_import_runs`.

```sql
-- 1. Tra cứu các đợt import gần nhất
SELECT run_id, dataset_hash, imported_at, status, total_canonical_terms
FROM curriculum_import_runs
ORDER BY imported_at DESC
LIMIT 5;

-- 2. Đánh dấu đợt import bị rollback
UPDATE curriculum_import_runs
SET status = 'rolled_back'
WHERE run_id = 'run_1789046769448_a561ab7a';

-- 3. Ẩn các khóa học liên quan đến đợt import bị lỗi
UPDATE curriculum_courses
SET visibility = 'internal', updated_at = now()
WHERE course_code IN (
  SELECT DISTINCT course_code
  FROM curriculum_course_terms
  WHERE import_run_id = 'run_1789046769448_a561ab7a'
);
```

---

### Kịch bản C: Rollback có cấu trúc bằng Migration tiến (Forward-only Migration)

Nếu cần áp dụng rollback tự động trên nhiều môi trường qua CI/CD:
1. Tạo migration mới: `server/db/migrations/009_rollback_curriculum_visibility.sql`.
2. Nội dung chỉ cập nhật cờ `visibility` hoặc điều chỉnh ràng buộc, ví dụ:

```sql
-- Migration 009: Emergency visibility rollback for unverified curriculum
UPDATE curriculum_courses
SET visibility = 'internal',
    updated_at = now()
WHERE rights_status = 'unknown' AND visibility = 'public';
```

---

## 3. Quy trình Kiểm tra sau Rollback (Post-Rollback Verification)

1. **Kiểm tra API Catalog:**
   ```bash
   curl -I http://localhost:8892/api/v1/curriculum/catalog?level=N5
   ```
   Xác nhận các khóa học bị ẩn không còn xuất hiện trong danh sách trả về cho người dùng.
2. **Kiểm tra dữ liệu SRS:**
   ```sql
   SELECT count(*) FROM srs_cards;
   ```
   Xác nhận số lượng thẻ SRS và lịch ôn tập của người dùng được bảo toàn 100%.
