# Báo cáo Thẩm định Chuẩn hóa Dữ liệu (Validation Report) — Task T02

**Phiên bản Importer:** `1.0.0`  
**Nguồn Manifest SHA-256:** `8f0a695f7590d7ad6da567e84ccff0b0bbba988b7fb8fb65067aef3bbe662e1b`  
**Thời điểm chuẩn hóa (Report Log):** `2026-09-10T13:27:25.482Z`  
**SHA-256 Tệp Canonical Dataset:** `7d874ccd847c6b368803e1f7a1f4d14acf6eeb2333d6134740ed7844d07674dd`  

---

## 1. Đối chiếu Số lượng Đầu vào & Đầu ra (Input / Output Row Count)

| Chỉ số | Số lượng | Ghi chú & Đánh giá |
| :--- | :--- | :--- |
| **Tổng số record đầu vào (`all_vocabulary_master.json`)** | **9.411** | Tập dữ liệu Master tổng hợp 5 cấp độ N5–N1 |
| **Số bản ghi bị loại bỏ (Reject List)** | **1** | Bản ghi rác không thể khôi phục (xem mục 3) |
| **Số bản ghi hợp lệ đưa vào chuẩn hóa** | **9.410** | Tỷ lệ chấp thuận đạt 99.99% |
| **Số mục từ Canonical độc lập (`terms`)** | **8.616** | Đã hợp nhất từ trùng lặp và tách biệt homonyms |
| **Số quan hệ bài học - từ vựng (`course_terms`)** | **9.410** | Bảo toàn 100% vị trí bài học và thứ tự xuất hiện |
| **Số khóa học chuẩn hóa (`courses`)** | **19** | Phân loại từ 10 nguồn giáo trình chính |
| **Số bài học chuẩn hóa (`units`)** | **268** | Trích xuất theo thứ tự bài tự nhiên |
| **Tổng số cảnh báo dữ liệu (Warnings)** | **2.797** | Chi tiết thiếu cách đọc / nghĩa ở mục 4 |

---

## 2. Chiến lược Xử lý Trùng lặp (Duplicate Strategy)

### 2.1. Trùng lặp hợp lệ (Duplicate đồng thuận)
- **Số lần gộp bản ghi trùng lặp:** **794** lần gộp.
- **Quy tắc:** Khi hai hoặc nhiều bản ghi có cùng chữ viết Nhật (NFC), cùng cách đọc Furigana và cùng định nghĩa tiếng Việt cốt lõi (xuất hiện ở các giáo trình khác nhau, ví dụ Minna N5 và Sekai N5):
  - Gộp thành **1 Canonical Term** duy nhất.
  - Bảo tồn toàn bộ nguồn gốc trong mảng `term.raw_source_references` (lưu vết `source`, `lesson`, `level`, `raw_record_id`).
  - Tự động bổ sung câu ví dụ nếu nguồn mới có câu ví dụ hay hơn hoặc bổ trợ thêm.
  - Tạo đầy đủ các bản ghi liên kết `course_term` cho từng khóa học và bài học tương ứng.

### 2.2. Từ đồng âm khác nghĩa (Homonyms & Polysemy)
- **Số mục từ đồng âm được bảo tồn độc lập:** **2.342** mục từ.
- **Quy tắc:** Tuyệt đối không xóa hay gộp các từ có cùng Kanji nhưng khác cách đọc (ví dụ: `角` đọc là `かど` - góc phố vs `角` đọc là `つの` - sừng thú) hoặc khác biệt cơ bản về trường nghĩa (ví dụ: `かける` - đeo kính vs `かける` - treo áo). Mỗi giác quan ngữ nghĩa được định danh bằng `term_id` riêng biệt theo chuỗi hash `normalizedWord||normalizedReading||primaryMeaning`.

---

## 3. Danh sách Bản ghi bị Loại bỏ (Reject List)

Phát hiện **1** bản ghi vi phạm nghiêm trọng tính toàn vẹn:

| STT | Record Index | Từ hiển thị | Lý do loại bỏ | Chi tiết bản ghi gốc |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `1775` | `(ミルク)` | empty_or_corrupt_entry_no_meaning_no_reading | Trống toàn bộ reading và meaning; không thể khôi phục tự động |

---

## 4. Thống kê Cảnh báo Chất lượng Dữ liệu (Validation Warnings)

- **Thiếu cách đọc (`MISSING_READING`):** **816** bản ghi. Đa số là các từ viết hoàn toàn bằng Kana (như `こんにちは`, `ちょっと`, v.v.) trong crawler không có cột Furigana riêng.
- **Thiếu nghĩa tiếng Việt (`MISSING_MEANING`):** **6** bản ghi (Ví dụ: record `吸います` ở Bài 6 VNJPClub).
- **Cột reading chứa tiếng Việt (`READING_CONTAINS_VIETNAMESE`):** **1.975** bản ghi (Bộ biển báo giao thông Minna Bài 23: `止 まれ` có reading là `"dừng lại"`, `進入 禁止` có reading là `"cấm đi vào"`...). Importer đã chuyển nghĩa này sang trường meaning và không tạo Furigana giả mạo.

---

## 5. Bảng Độ phủ Khóa học & Bài học (Course & Unit Coverage)

| Mã Khóa học (`course_code`) | Cấp độ | Tên Khóa học | Số bài học (`units`) | Số từ (`course_terms`) | Trạng thái Bản quyền |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mazii-vocab-n1` | **N1** | Từ vựng Tuyển chọn Mazii N1 | 1 | 59 | `unknown` |
| `mazii-vocab-n2` | **N2** | Từ vựng Tuyển chọn Mazii N2 | 1 | 35 | `unknown` |
| `mazii-vocab-n3` | **N3** | Từ vựng Tuyển chọn Mazii N3 | 1 | 54 | `unknown` |
| `mazii-vocab-n4` | **N4** | Từ vựng Tuyển chọn Mazii N4 | 1 | 25 | `unknown` |
| `mazii-vocab-n5` | **N5** | Từ vựng Tuyển chọn Mazii N5 | 1 | 37 | `unknown` |
| `minna-n5-standard` | **N5** | Minna no Nihongo Sơ cấp 1 (N5 Chuẩn) | 23 | 914 | `unknown` |
| `minna-nihongo-n4` | **N4** | Minna no Nihongo Từ vựng N4 (VNJPClub) | 23 | 1.528 | `unknown` |
| `minna-nihongo-n5` | **N5** | Minna no Nihongo Từ vựng N5 (VNJPClub) | 25 | 2.735 | `unknown` |
| `sekai-n5-aanime` | **N5** | Giáo trình Sekai N5 (Aanime) | 25 | 1.240 | `unknown` |
| `soumatome-goi-n2` | **N2** | Nihongo Soumatome Từ vựng N2 | 6 | 772 | `unknown` |
| `soumatome-goi-n3` | **N3** | Nihongo Soumatome Từ vựng N3 | 6 | 577 | `unknown` |
| `speed-master-n2` | **N2** | Speed Master Từ vựng N2 | 5 | 269 | `unknown` |
| `speed-master-n3` | **N3** | Speed Master Từ vựng N3 | 5 | 214 | `unknown` |
| `speed-master-n4` | **N4** | Speed Master Từ vựng N4 | 2 | 46 | `unknown` |
| `speed-master-n5` | **N5** | Speed Master Từ vựng N5 | 6 | 175 | `unknown` |
| `vnjp-grammar-vocab-n1` | **N1** | Từ vựng theo Ngữ pháp N1 (VNJPClub) | 27 | 133 | `unknown` |
| `vnjp-grammar-vocab-n2` | **N2** | Từ vựng theo Ngữ pháp N2 (VNJPClub) | 30 | 156 | `unknown` |
| `vnjp-grammar-vocab-n3` | **N3** | Từ vựng theo Ngữ pháp N3 (VNJPClub) | 22 | 127 | `unknown` |
| `vnjp-grammar-vocab-n4` | **N4** | Từ vựng theo Ngữ pháp N4 (VNJPClub) | 58 | 314 | `unknown` |

---

## 6. Tính Tất định & Toàn vẹn Dữ liệu (Determinism & Integrity)

- **Nguyên tắc sắp xếp:** Toàn bộ mảng `courses`, `units`, `terms`, `course_terms` được sắp xếp thứ tự từ điển chuẩn trước khi ghi ra đĩa.
- **Tính tái lập (Reproducibility):** Chạy lại importer với cùng tệp nguồn sinh ra cùng mã SHA-256: `7d874ccd847c6b368803e1f7a1f4d14acf6eeb2333d6134740ed7844d07674dd`.
- **Ranh giới:** Chưa nạp vào cơ sở dữ liệu PostgreSQL/SQLite; artifact xuất ra tại `tmp/curriculum/canonical-dataset.json` (nằm trong `.gitignore`).
