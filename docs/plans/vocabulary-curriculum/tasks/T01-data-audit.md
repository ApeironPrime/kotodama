# T01 — Audit dữ liệu, độ phủ và provenance

## Phạm vi

Chỉ đọc `D:\Project\data\tong_hop_khoa_hoc_tu_vung`. Tạo báo cáo dữ liệu; không đổi UI, API, database, dữ liệu gốc hay file source học liệu.

## Việc cần làm

1. Tạo script read-only `scripts/curriculum/audit-source.mjs` nhận `--source-root` và xuất manifest JSON có: đường dẫn tương đối, SHA-256, kích thước, định dạng, số record, schema phát hiện được.
2. Tạo `docs/plans/vocabulary-curriculum/data-audit.md`: độ phủ theo A1/A2/N5…N1/SE, nguồn, giáo trình, số bài, số từ unique, duplicate, trường thiếu và record lỗi.
3. Tạo `docs/plans/vocabulary-curriculum/provenance.csv` (dataset-level, không liệt kê nội dung): `dataset_id, source_name, local_path, rights_status, allowed_use, action_required`.
4. Gắn nhãn `unknown` cho mọi nguồn chưa có bằng chứng quyền sử dụng. Không suy diễn rằng dữ liệu crawler được phép tái phân phối.

## Không được làm

- Không import DB, không render UI, không sửa master JSON/CSV/Markdown/ảnh.
- Không gọi web/crawler/OCR; không tải nội dung mới.

## Acceptance

- Chạy lại script cho cùng source root cho manifest có hash ổn định.
- Báo cáo phân biệt rõ **số record**, **số từ unique** và **số bài học**.
- Không có diff nào ngoài script + hai báo cáo này (và test script nếu có).

## Bàn giao bắt buộc

`git diff --stat`, lệnh audit, đường dẫn output, bảng các nguồn `unknown`, và test/lint đã chạy.

