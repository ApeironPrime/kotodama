# Kế hoạch: Kho từ vựng theo giáo trình

## Mục tiêu sản phẩm

Thay thế catalog cứng hiện tại bằng kho giáo trình thật, lấy từ `D:\Project\data\tong_hop_khoa_hoc_tu_vung`, nhưng không sao chép nguyên văn hoặc công bố dữ liệu khi chưa xác minh quyền sử dụng. Mục **Từ vựng** trong Từ điển sẽ trở thành một thư viện có thể học: chọn cấp độ → chọn giáo trình → chọn bài/unit → xem danh sách từ → lưu SRS.

Phong cách tham chiếu: nền giấy kem có lưới mảnh, tiêu đề chữ đậm thân thiện, thẻ có viền phác tay; vẫn phải dùng design token hiện có để chế độ màu của người dùng tiếp tục hoạt động. Không dùng emoji hay icon hệ điều hành; chỉ dùng icon Lucide đã có trong dự án.

## Hiện trạng đã kiểm kê (2026-09-10)

- Kho nguồn có 1.092 Markdown, 8 JSON/CSV theo cấp độ và 5 master files. `all_vocabulary_master.json` có **9.411** bản ghi với các trường: `word`, `reading`, `han_viet`, `meaning`, `level`, `lesson`, `source`, `example`, `example_vi`.
- Dữ liệu đã có cấu trúc tốt nhất là master JSON/CSV; các Markdown và ảnh là nguồn đối chiếu, không được coi là dữ liệu import tự động.
- UI hiện tại `src/features/vocabulary/VocabularyPage.tsx` đang hard-code 7 khóa (N3/N2/N1/SE), nên số lượng và tên khóa không phản ánh dữ liệu gốc.
- API hiện tại chỉ có `CurriculumService` cục bộ; chưa có mô hình database chuẩn cho khóa học, unit, provenance hoặc phiên bản import.

## Quy tắc bắt buộc cho mọi task

1. Chỉ làm **một task** theo file `tasks/` trong mỗi lần giao Antigravity; không tự mở rộng phạm vi.
2. Trước khi sửa, chạy `git status --short` và lưu phần diff liên quan của chính task. Worktree hiện có thay đổi chưa commit; tuyệt đối không `reset`, `checkout --`, format toàn repo hoặc ghi đè file không thuộc task.
3. Không sửa hay di chuyển thư mục nguồn `D:\Project\data\tong_hop_khoa_hoc_tu_vung`. Importer chỉ đọc thư mục này; dữ liệu sinh ra phải có thể tái tạo.
4. Không tự tải thêm tài liệu, crawl web, OCR ảnh hay đưa nội dung giáo trình có bản quyền vào production. Mỗi dataset phải có `source`, `license_status`, `imported_at`, `content_hash`.
5. API chỉ trả về phân trang, giới hạn cứng; không gửi master JSON hay toàn bộ kho cho browser.
6. Không hard-code màu mới ngoài token. Card có thể có accent theo JLPT, nhưng accent phải map qua CSS custom property/token và hoạt động ở dark/light/custom theme.
7. Mọi task phải có test mới/chỉnh test phù hợp, chạy `npm run typecheck`, test liên quan và ghi kết quả vào báo cáo task.
8. Không commit, deploy, migrate production hay đổi biến môi trường trừ khi người dùng yêu cầu. Một commit nhỏ, tách biệt chỉ được tạo khi người dùng hoặc người kiểm tra yêu cầu.

## Thứ tự thực hiện

| Thứ tự | Task | Phụ thuộc | Kết quả cần có |
|---|---|---|---|
| 01 | [Data audit & quyền sử dụng](tasks/T01-data-audit.md) | — | manifest, coverage, provenance/risk |
| 02 | [Schema & importer tái lập](tasks/T02-canonical-import.md) | T01 | canonical dataset + validation, chưa ghi DB |
| 03 | [Persistence & migration](tasks/T03-persistence.md) | T02 | schema/migration/seed idempotent |
| 04 | [API thư viện](tasks/T04-api.md) | T03 | API phân trang, filter, contract test |
| 05 | [Catalog UI theo mẫu](tasks/T05-catalog-ui.md) | T04 | tab Từ vựng, level → course → unit |
| 06 | [Học bài & SRS](tasks/T06-learning-srs.md) | T04, T05 | danh sách từ/flashcard/progress |
| 07 | [Tích hợp, hiệu năng & accessibility](tasks/T07-qa.md) | T01–T06 | QA matrix, performance, responsive |

Không làm song song các task 02–06 vì chúng đụng cùng mô hình dữ liệu. Chỉ T01 có thể được làm độc lập.

## Cách giao và cách mình duyệt

Gửi Antigravity **nguyên văn một file task**. Khi nó hoàn tất, nó phải trả: danh sách file đã đổi, lệnh đã chạy + kết quả, ảnh desktop/mobile và `git diff --stat`. Sau đó gửi mình đúng báo cáo đó hoặc để nguyên worktree; mình sẽ:

1. so sánh diff với phạm vi task và baseline;
2. kiểm tra migration/import không phá dữ liệu;
3. đọc API contract và các truy vấn có nguy cơ chậm;
4. chạy typecheck/test/build và mở UI thực tế;
5. chấp nhận, yêu cầu sửa, hoặc rollback **chỉ phần task đó**.

Một task chưa có kết luận `ACCEPTED` của mình thì không được dùng làm nền cho task tiếp theo.

