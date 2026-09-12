# Báo Cáo Phát Hành (Release Report) — Kho Từ Vựng Giáo Trình (Curriculum Vocabulary)

**Ngày lập báo cáo:** `2026-09-10`  
**Phiên bản:** `1.0.0-rc1`  
**Nhiệm vụ:** Task T07 — Tích hợp, hiệu năng, accessibility và release gate  
**Trạng thái Release Gate:** **PASSED / SẴN SÀNG PHÁT HÀNH**

---

## 1. Mục Tiêu & Phạm Vi Phát Hành

Dự án hoàn tất chuỗi nhiệm vụ từ **T01 đến T07** nhằm xây dựng hệ thống **Kho Giáo Trình Từ Vựng (Curriculum Vocabulary)** cho Kotodama:
- Số hóa, chuẩn hóa và kiểm soát bản quyền toàn bộ kho học liệu tiếng Nhật từ nguồn tổng hợp sơ cấp đến cao cấp (N5 – N1).
- Xây dựng mô hình dữ liệu quan hệ chặt chẽ: `courses` → `units` → `course_terms` ↔ `terms` kèm bảng audit `curriculum_import_runs`.
- Cung cấp API đọc dữ liệu có kiểm soát phân trang, bảo mật bản quyền nghiêm ngặt (`rights_status`).
- Thiết kế giao diện tra cứu & học tập phong cách giấy kem, lưới mảnh, phác tay tối giản; đồng bộ dark/light mode qua design tokens.
- Tích hợp học từ vựng bài học, thẻ Flashcard xoay chiều đa trang, và lưu kho ôn tập ngắt quãng SRS với cơ chế idempotency theo `(user_id, type, term, source_context)`.

---

## 2. Ma Trận Đối Chiếu Dữ Liệu Import vs Audit (Data Reconciliation Matrix)

| Hạng mục dữ liệu | Số liệu Audit (T01) | Số liệu Canonical (T02) | Số liệu DB Ingest (T03) | Đánh giá đối chiếu |
| :--- | :---: | :---: | :---: | :--- |
| **Tổng số record đầu vào** | 9.411 | 9.411 | 9.411 | Khớp 100% tệp `all_vocabulary_master.json` |
| **Số bản ghi bị loại bỏ (Reject)** | 1 | 1 | 1 | Bản ghi rác `(ミルク)` (index 1775: trống cả reading & meaning) |
| **Số bản ghi hợp lệ chuẩn hóa** | 9.410 | 9.410 | 9.410 | Tỷ lệ thành công 99.99% |
| **Số mục từ độc lập (`terms`)** | 7.005 (thô) | 8.616 (canonical) | 8.616 | Gộp 794 trùng lặp đồng thuận; bảo toàn 2.342 homonyms |
| **Số quan hệ bài học (`course_terms`)** | — | 9.410 | 9.410 | Bảo toàn 100% vị trí bài học và thứ tự ordinal |
| **Số khóa học (`courses`)** | 10 nguồn | 19 khóa | 19 khóa | Phân loại chuẩn hóa theo từng cấp độ và bộ sách |
| **Số bài học (`units`)** | 362 bài | 268 bài | 268 bài | Trích xuất theo cấu trúc tự nhiên của giáo trình |
| **Hash SHA-256 artifact canonical** | — | `7d874ccd...674dd` | `7d874ccd...674dd` | Khớp tuyệt đối SHA-256 bytes file artifact lưu trong DB |

### Phân bố khóa học theo cấp độ (Level Breakdown)
- **N5 (5 khóa):** `minna-n5-standard` (914 terms), `minna-nihongo-n5` (2.735 terms), `sekai-n5-aanime` (1.240 terms), `speed-master-n5` (175 terms), `mazii-vocab-n5` (37 terms).
- **N4 (4 khóa):** `minna-nihongo-n4` (1.528 terms), `vnjp-grammar-vocab-n4` (314 terms), `speed-master-n4` (46 terms), `mazii-vocab-n4` (25 terms).
- **N3 (4 khóa):** `soumatome-goi-n3` (577 terms), `speed-master-n3` (214 terms), `vnjp-grammar-vocab-n3` (127 terms), `mazii-vocab-n3` (54 terms).
- **N2 (4 khóa):** `soumatome-goi-n2` (772 terms), `speed-master-n2` (269 terms), `vnjp-grammar-vocab-n2` (156 terms), `mazii-vocab-n2` (35 terms).
- **N1 (2 khóa):** `vnjp-grammar-vocab-n1` (133 terms), `mazii-vocab-n1` (59 terms).

---

## 3. Cơ Chế Tuân Thủ Bản Quyền & Bảo Vệ Dữ Liệu (Rights Compliance)

1. **Rào chắn quyền sử dụng cấp độ API (Task T04):**
   - 100% (19/19) khóa học nhập khẩu hiện tại được gắn `visibility = 'internal'` và `rights_status = 'unknown'`.
   - Endpoint công khai `/api/v1/curriculum/catalog` áp dụng bộ lọc nghiêm ngặt:
     ```sql
     visibility IN ('public', 'unlisted') AND rights_status IN ('verified', 'public_domain', 'licensed')
     ```
     -> Kết quả: Catalog trả về mảng rỗng `[]` kèm thông báo kiểm định quyền sử dụng thân thiện trên UI.
   - Các endpoint đọc chi tiết `/courses/:courseCode`, `/courses/:courseCode/units/:unitKey`, `/courses/:courseCode/units/:unitKey/terms` lập tức trả mã lỗi `403 COURSE_RESTRICTED` nếu khóa học chưa được phê duyệt quyền sử dụng.
   - Tuyệt đối không rò rỉ metadata, tiêu đề bài hay nội dung từ vựng ra ngoài internet.
2. **Kiểm tra rò rỉ Bundle:**
   - Đã quét toàn bộ bundle `dist/assets/*.js`: hoàn toàn không chứa chuỗi đường dẫn cục bộ máy tính cá nhân (`D:\Project\data`), không chứa file master JSON hay CSV dữ liệu thô.

---

## 4. Kiểm Toán Bảo Mật & Môi Trường (Security & Environment Audit)

1. **Tách bạch cấu hình lưu trữ:**
   - Biến môi trường tường minh `CURRICULUM_STORAGE=sqlite|postgres`.
   - Local development mặc định sử dụng SQLite độc lập thông qua biến `CURRICULUM_SQLITE_PATH` (giá trị mặc định trong project: `tmp/curriculum/curriculum.db`, hoặc đường dẫn cấu hình tùy chỉnh qua biến môi trường).
   - Không tự ý fallback ngầm giữa hai nguồn; tránh hoàn toàn lỗi 500 khi PostgreSQL local chưa chạy migration.
2. **Bảo vệ cơ sở dữ liệu production:**
   - Safety guard trong mã nguồn tự động ngắt kết nối nếu phát hiện URL chứa máy chủ Neon/Production khi chạy lệnh ingest hoặc migration từ môi trường dev.
   - Neon/production PostgreSQL giữ nguyên trạng thái an toàn, không bị ảnh hưởng.

---

## 5. Kiểm Toán Hiệu Năng & Kích Thước Bundle (Performance & Bundle Audit)

1. **Chiến lược nạp dữ liệu phân tầng:**
   - **Catalog Overview:** Chỉ tải metadata tóm tắt của các khóa học hợp lệ (`limit: 100`), không tải danh sách bài hay từ vựng.
   - **Course Detail:** Chỉ tải danh sách bài học (unit summary) khi người dùng nhấp chọn khóa học cụ thể.
   - **Unit Terms:** Phân trang server-side nghiêm ngặt 20 từ/trang (`limit: 20, page: unitPage`), không tải toàn bộ từ của bài học cùng một lúc.
   - **Flashcard:** Hỗ trợ điều hướng chuyển trang mượt mà khi duyệt đến biên trang mà không tải dồn hàng trăm từ vào bộ nhớ DOM.
2. **Kích thước Bundle Client:**
   - **Ghi chú về Baseline Before/After:** Baseline kích thước bundle cụ thể trước T07 không được thu thập định lượng trước đó (trước T05, trang Từ Vựng chỉ là mockup tĩnh / placeholder không chứa logic routing hay state giáo trình). Do không có baseline trước T07 được đo lường chính thức, báo cáo công bố chính xác số đo hiện tại sau khi hoàn tất T07 mà không đưa ra số so sánh before/after suy diễn:
     * Chunk lazy-load `VocabularyPage`: **29.98 kB** (nén gzip: **8.64 kB**).
     * Chunk stylesheet `index.css`: **177.76 kB** (nén gzip: **29.00 kB**).
     * Tổng kích thước JavaScript client trên toàn ứng dụng: ~**1.44 MB** (chưa nén).
     * Toàn bộ 9.410 từ vựng và 268 bài học nằm 100% trên server API/SQLite, không nhúng dữ liệu vào bundle client.

---

## 6. Kiểm Toán Trợ Năng (Accessibility - a11y)

1. **Ngữ nghĩa Tab (Tab Semantics):**
   - Thanh lọc cấp độ: `role="tablist"` kèm `aria-label="Lọc theo cấp độ giáo trình"`, các nút lọc có `role="tab"`, `aria-selected` và hỗ trợ phím `Enter` / `Space`.
   - Chuyển chế độ học (Danh Sách vs Flashcard): `role="tablist"`, `role="tab"`, `aria-controls` trỏ chính xác vào `role="tabpanel"` tương ứng (`panel-study-list` và `panel-study-flashcard`).
2. **Chỉ báo Focus (Focus Visible):**
   - Đã bổ sung bộ chọn `:focus-visible` với outline tương phản cao (`outline: 2px solid var(--color-accent); outline-offset: 2px`) cho tất cả thẻ khóa học, thẻ bài học, nút bấm, ô tìm kiếm và nút lưu SRS.
3. **Giảm thiểu chuyển động (`prefers-reduced-motion`):**
   - Đã thiết lập `@media (prefers-reduced-motion: reduce)`: vô hiệu hóa toàn bộ hiệu ứng sketch hover transforms, animation xoay lật flashcard và transition đối với người dùng bật tùy chọn trợ năng giảm chuyển động trong hệ điều hành.
4. **Nhãn Screen Reader:**
   - Toàn bộ các icon Lucide đều được gắn `aria-hidden="true"`.
   - Thanh tiến độ bài học có `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` và nhãn đọc chi tiết `aria-label="Tiến độ bài học: X trên Y từ"`.

---

## 7. Kết Quả Kiểm Thử Toàn Diện (QA Matrix)

| Nhóm kiểm thử | Số lượng test | Kết quả | Chi tiết |
| :--- | :---: | :---: | :--- |
| **Frontend Vitest (`npm test`)** | **63 / 63** | **PASS 100%** | Bao gồm test sessionExpired không đá trang public, test 121 terms, test regression Context A/B |
| **Vocabulary Suite (`vocabulary.test.tsx`)** | **19 / 19** | **PASS 100%** | Server pagination, in-unit search, flashcard, context isolation |
| **App Routing Suite (`App.test.tsx`)** | **5 / 5** | **PASS 100%** | Protected route redirection, expired session giữ nguyên `/tra-tu` & `/jlpt` |
| **Curriculum & SRS Tests (`node --test`)** | **53 / 53** | **PASS 100%** | Audit, normalization, persistence, contract API, SRS idempotency |
| **TypeScript Typecheck (`npm run typecheck`)** | Toàn repo | **0 LỖI** | Strict mode, 0 `any`, 0 non-null assertion `!` |
| **Linter (`npm run lint` / `oxlint`)** | 203 files | **0 LỖI / 0 CẢNH BÁO** | Đã xử lý sạch toàn bộ 6 warnings (regex escaping, React hook deps, control characters, extra boolean cast); kết quả quét sạch hoàn toàn: "Found 0 warnings and 0 errors" |
| **Production Build (`npm run build`)** | 26 assets | **THÀNH CÔNG** | Bundle tối ưu, mã băm đảm bảo cache busting |

---

## 8. Các Giới Hạn Đã Biết & Kế Hoạch Tương Lai (Known Limitations & Next Steps)

1. **Trạng thái bản quyền của 19 khóa học:**
   - Hiện tại toàn bộ 19 khóa học đang ở trạng thái `unknown` nên catalog công khai chưa mở rộng rãi cho người dùng đại trà.
   - *Kế hoạch tiếp theo:* Thành lập hội đồng biên tập/pháp lý rà soát để chuyển đổi trạng thái bản quyền (sang `verified` hoặc `licensed`) cho từng bộ giáo trình đạt chuẩn bản quyền hoặc tự biên soạn.
2. **Từ vựng thiếu Furigana/Reading:**
   - 816 mục từ thuần Kana hiện chưa có trường reading riêng biệt trong dữ liệu gốc. Importer đã xử lý an toàn bằng cách không tạo Furigana giả.
   - *Kế hoạch tiếp theo:* Tích hợp tự động đối chiếu từ điển nội bộ Kotodama để bổ sung cách đọc chuẩn xác.
3. **Kho học liệu chuyên ngành & Ảnh tình huống:**
   - 14 bài học tiếng Nhật CNTT (SE) và 220 ảnh minh họa đời sống (Tsunagaru A1/A2) được lưu trữ tại kho tài liệu đối chiếu nội bộ, chưa đưa vào pipeline import tự động của đợt phát hành này.
