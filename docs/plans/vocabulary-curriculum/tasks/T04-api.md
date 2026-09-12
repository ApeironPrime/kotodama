# T04 — API thư viện giáo trình

## Phụ thuộc

T03 phải được `ACCEPTED`.

## API cần có

- `GET /api/v1/curriculum/catalog?level=&q=&page=&limit=` — course cards + count.
- `GET /api/v1/curriculum/courses/:courseCode` — metadata và unit summaries.
- `GET /api/v1/curriculum/courses/:courseCode/units/:unitKey/terms?page=&limit=&q=` — term cards phân trang.
- `GET /api/v1/curriculum/courses/:courseCode/units/:unitKey` — metadata unit, không trả toàn bộ term.

## Ràng buộc

- Validate query/path, max `limit=100`, response envelope thống nhất, 404 rõ ràng.
- Browse public chỉ trả field được `rights_status=approved`; item unknown/restricted không lộ nội dung.
- Không trả raw Markdown, ảnh nguồn hay đường dẫn local; không thêm endpoint tải master file.
- SRS mutation tiếp tục dùng API SRS hiện có, không nhân đôi endpoint.

## Acceptance

- Contract tests: pagination, q, level, invalid limit, unknown course, restricted course.
- Không regression endpoint `/api/v1/curriculum/words` cũ cho đến khi T07 quyết định deprecate.
- Mỗi request catalog/unit đọc lượng dữ liệu giới hạn; không N+1 query.

## Trạng thái thực hiện & Kết quả nghiệm thu (T04)

- **Trạng thái:** `COMPLETED (READY FOR APPROVAL)`
- **Tệp Core Service:** `server/curriculum-catalog-service.mjs`
  - Quản trị quyền chặt chẽ (`PUBLIC_VISIBILITIES = ['public', 'unlisted']`, `APPROVED_RIGHTS_STATUSES = ['verified', 'public_domain', 'licensed']`).
  - `/catalog`: Chỉ hiển thị khóa học thỏa mãn đồng thời `visibility IN ('public', 'unlisted')` VÀ `rights_status IN ('verified', 'public_domain', 'licensed')`.
  - Ba endpoint `/courses/:courseCode`, `/units/:unitKey`, `/terms`: Nếu khóa học không thuộc nhóm public & approved, lập tức ném lỗi `403 COURSE_RESTRICTED` trước khi truy vấn metadata, units, hay terms (tuyệt đối không để lộ dữ liệu).
  - Không N+1 query: `unit_count` và `term_count` được gom nhóm và đếm qua một câu SQL đơn.
- **Cập nhật Router Server:** `server/index.mjs` (đăng ký 4 endpoints đọc dữ liệu dưới tiền tố `/api/v1/curriculum/`, bảo toàn 100% các endpoint cũ `/words`, `/grammar`, `/units`, `/lessons`, `/stats`).
- **Bộ Kiểm thử Hợp đồng (Contract Tests):** `scripts/curriculum/catalog-api.test.mjs` (13 tests chuyên sâu):
  - Kiểm thử helper `isCoursePublicAndApproved` và các hằng số.
  - Phân trang chuẩn (`page`, `limit`, `totalPages`, `total`).
  - Bắt lỗi giới hạn (`INVALID_LIMIT`, `INVALID_PAGE`, `INVALID_LEVEL`).
  - Lọc theo cấp độ (`N5`, `N4`, `SE`) và tìm kiếm từ khóa không phân biệt hoa thường (`LOWER(...)`) trên fixture đã approved.
  - Xử lý 404 chuẩn (`COURSE_NOT_FOUND`, `UNIT_NOT_FOUND`).
  - Xử lý khóa học hạn chế 403 (`COURSE_RESTRICTED`) cho các tổ hợp: `internal + unknown`, `public + unknown`, `internal + verified`, `private + unknown`.
  - Bảo vệ dữ liệu thật: Toàn bộ 19 khóa học hiện tại (`internal` + `unknown`) trong DB thật `tmp/curriculum/curriculum.db` trả về 0 khóa học trong `/catalog`, và ném `403 COURSE_RESTRICTED` khi truy vấn trực tiếp vào `minna-n5-standard` hoặc `soumatome-goi-n3`.
  - Không N+1 query: `unit_count` và `term_count` được tính gộp bằng một truy vấn đơn lẻ.
  - Kiểm thử end-to-end HTTP Server độc lập: gọi thật qua `fetch` trên mock server và real db server, xác nhận không regression `/api/v1/curriculum/words`.
- **Kết quả Kiểm thử Toàn bộ Hệ thống:**
  - `node --test scripts/curriculum/*.test.mjs`: **45/45 tests passed** (100% pass trên 4 suites).
  - `npm test`: **43/43 tests passed** (100% pass trên 10 suites Vitest).
  - `npm run typecheck`: 0 errors.
  - `npx oxlint`: 0 warnings, 0 errors.

