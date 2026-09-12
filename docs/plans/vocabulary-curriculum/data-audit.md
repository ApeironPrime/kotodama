# Báo cáo Audit Dữ liệu Kho Từ vựng Giáo trình

**Thời điểm audit thực tế (Report Timestamp):** `2026-09-10T12:32:53.921Z`  
**Thư mục nguồn:** `D:\Project\data\tong_hop_khoa_hoc_tu_vung`  
**Manifest SHA-256 (Tất định từ nội dung tệp):** `8f0a695f7590d7ad6da567e84ccff0b0bbba988b7fb8fb65067aef3bbe662e1b`  
**Tổng số file kiểm kê:** **1318** file  

---

## 1. Tổng quan phân loại tệp tin nguồn

| Định dạng | Ý nghĩa & Vai trò | Số lượng | Tổng số record phát hiện |
| :--- | :--- | :--- | :--- |
| `.md` | Giáo trình học liệu Markdown (**1082** bài học giáo trình + **1** tệp README mục lục gốc) | **1083** | **4.765** dòng bảng từ vựng |
| `.json` | CSDL JSON (Master & từng cấp độ N5..N1, Mazii, NhaiKanji) | **8** | **20.568** record cấu trúc |
| `.csv` | CSDL CSV (Master & từng cấp độ N5..N1, PassJapanese full) | **7** | **19.932** dòng dữ liệu |
| `.jpg` | Ảnh minh họa ngữ cảnh tình huống đời sống (Tsunagaru A1/A2) | **220** | — |
| **Tổng cộng** | | **1318** | — |

---

## 2. Phân biệt Số Record, Số Từ Unique, Số Bài Học và Tổng Tệp Markdown

> [!IMPORTANT]
> **Quy tắc phân biệt số liệu cốt lõi & Giải thích 1.082 bài học vs 1.083 tệp Markdown:**
> - **Số record dữ liệu (Master JSON):** **9.411** bản ghi từ vựng.
> - **Số từ vựng unique (Kanji/Kana độc lập):** **7.005** từ.
> - **Số cặp (từ + cách đọc) unique:** **8.241** mục.
> - **Số bài học cấu trúc trong Master JSON:** **362** bài/unit.
> - **Số bài học Markdown đối chiếu thực tế:** **1.082** bài học (.md) (phân bổ: A1: 12, A2: 40, N5: 213, N4: 225, N3: 365, N2: 195, N1: 18, SE: 14).
> - **Tệp README mục lục tổng thể tại thư mục gốc:** **1** tệp (`README.md`), là tài liệu giới thiệu hệ thống, không phải bài học từ vựng.
> - **Tổng số tệp `.md` có trong thư mục nguồn:** **1.083** tệp (`1.082 bài học + 1 README gốc = 1.083 tệp Markdown`).

---

## 3. Độ phủ theo Cấp độ (Levels)

| Cấp độ | Số bài Markdown | Số record (Master DB) | Tỷ lệ record | Nguồn / Giáo trình tiêu biểu | Đánh giá độ phủ & Hiện trạng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A1** | 12 bài (Scene) | 0 *(chỉ có Markdown)* | 0% | Tsunagaru Nihongo Level 1 (Bunka-cho) | 12 Scene tình huống thực tế kèm ảnh minh họa JPG; chưa được nạp vào Master JSON. |
| **A2** | 40 bài (Scene) | 0 *(chỉ có Markdown)* | 0% | Tsunagaru Nihongo Level 2 & 3 | 40 Scene (A2.1: 19 Scene + A2.2: 21 Scene) giao tiếp thực tế; chưa có trong Master JSON. |
| **N5** | 213 bài | **5.102** | 54.2% | Minna 1-25, PassJP 100 ngày, Sekai N5, Tango 1000, Speed Master | Độ phủ rất dày, dồi dào từ vựng nền tảng; chiếm hơn 50% toàn kho master. |
| **N4** | 225 bài | **1.913** | 20.3% | Minna 26-50, PassJP 100 ngày, Shinkanzen N4, Speed Master | Độ phủ hoàn chỉnh toàn bộ sơ cấp; đầy đủ Minna sơ cấp 2. |
| **N3** | 365 bài | **972** | 10.3% | Mimi Kara N3, Shinkanzen N3, Soumatome N3, Speed Master | Số lượng bài Markdown lớn nhất (365 bài), nhưng record master chỉ có 972 mục. |
| **N2** | 195 bài | **1.232** | 13.1% | Mimi Kara N2, Soumatome N2, Speed Master N2, Tango 2500 | 1.232 record chất lượng từ Mimi Kara và Soumatome. (Gồm 92 Mimi Kara + 73 Soumatome + 26 Speed Master + 4 Tango = 195 bài). |
| **N1** | 18 bài | **192** | 2.0% | Mimi Kara N1, Tango 3000 N1 | 192 record; cần bổ sung thêm ở các giai đoạn sau nếu muốn phủ sâu N1. (Gồm 11 Mimi Kara + 7 Tango = 18 bài). |
| **SE (Chuyên ngành)** | 14 bài | 0 *(chỉ có Markdown)* | 0% | Từ vựng chuyên đề Xây dựng, Thời tiết, Y tế... | Nằm trong mục `00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/02_Tu_Vung_Giao_Tiep_Chuyen_De`. |
| **Tổng bài học Markdown** | **1.082** | **9.411** | **100%** | | *(Kho nguồn có thêm 1 README gốc, tổng cộng 1.083 file .md)* |

---

## 4. Chi tiết các Nguồn & Giáo trình trong Master Dataset (`all_vocabulary_master.json`)

| Nguồn (Source Label) | Cấp độ | Số record | Số bài học (Lessons) | Đặc điểm dữ liệu |
| :--- | :--- | :--- | :--- | :--- |
| `VNJPClub (MINNA)` | N5, N4 | **4.264** | 118 | Bộ từ vựng Minna đầy đủ, có Hán Việt, một số ít thiếu nghĩa/bị lỗi cột. |
| `VNJPClub (SOMATOME)` | N3, N2 | **1.349** | 40 | Giáo trình Soumatome Go-i theo tuần/ngày ôn thi JLPT. |
| `Sekai N5 Aanime` | N5 | **1.240** | 25 | Bộ từ vựng 25 bài Sekai N5 có câu ví dụ và nghĩa chi tiết. |
| `Minna no Nihongo N5` | N5 | **914** | 23 | Dữ liệu gốc Minna N5 chuẩn có ví dụ tiếng Nhật và tiếng Việt. |
| `VNJPClub (SPEED_MASTER)` | N5, N4, N3, N2 | **704** | 17 | Từ vựng trọng điểm ôn thi Speed Master theo chủ đề. |
| `VNJPClub (GRAMMAR_N4)` | N4 | **314** | 59 | Từ vựng trích xuất từ phần ngữ pháp N4. |
| `Mazii Dictionary` | N5..N1 | **210** | 1 | Tập từ vựng tra cứu chọn lọc từ Mazii. |
| `VNJPClub (GRAMMAR_N2)` | N2 | **156** | 30 | Từ vựng và mẫu câu ngữ pháp N2. |
| `VNJPClub (GRAMMAR_N1)` | N1 | **133** | 27 | Từ vựng cao cấp trích từ tài liệu N1. |
| `VNJPClub (GRAMMAR_N3)` | N3 | **127** | 22 | Từ vựng đi kèm mẫu ngữ pháp N3. |
| **Tổng cộng** | | **9.411** | **362** | |

---

## 5. Phân tích Chất lượng Dữ liệu (Data Quality & Anomalies)

### 5.1. Trùng lặp (Duplicates)
- **Trùng lặp hoàn toàn (Exact identical record):** **79** bản ghi trùng lặp 100% tất cả các trường dữ liệu do gom góp từ nhiều đợt crawl khác nhau.
- **Trùng lặp (Từ + Đọc + Nghĩa) qua các bài/nguồn khác nhau:** **526** bản ghi. (Ví dụ: một từ xuất hiện cả trong Minna N5 và PassJapanese N5 hoặc Soumatome).
- **Từ vựng xuất hiện ở nhiều bản ghi:** **1042** từ vựng (do từ đa nghĩa, hoặc xuất hiện lặp lại ở nhiều cấp độ/giáo trình).
- **Chiến lược chuẩn hóa:** Không tự ý xóa bỏ các bản ghi trùng lặp nếu chúng đại diện cho các giáo trình khác nhau hoặc có câu ví dụ khác nhau; gộp canonical term nhưng giữ nguyên provenance record id (sẽ xử lý ở Task T02).

### 5.2. Trường thiếu (Missing Fields)
- **Thiếu cách đọc (`reading`):** **817** bản ghi (8.7%). Cần fallback hoặc đối chiếu với từ điển ở giai đoạn sau.
- **Thiếu nghĩa tiếng Việt (`meaning`):** **7** bản ghi (0.07%).
- **Thiếu Hán Việt (`han_viet`):** **4499** bản ghi (47.8%). Đây là điều bình thường đối với các từ thuần Nhật (Hiragana), từ mượn Katakana, phó từ và liên từ.
- **Thiếu câu ví dụ (`example` & `example_vi`):** **7257** bản ghi (77.1%). Đa số các nguồn crawler chỉ thu thập từ và nghĩa mà không lấy ví dụ câu.

### 5.3. Danh sách Record lỗi đặc thù cần xử lý ở bước Import (Task T02)
Phát hiện **7 bản ghi** bất thường trong file `all_vocabulary_master.json` thuộc nguồn `VNJPClub (MINNA)`:
1. Record `(ミルク)` (Bài 6): Thiếu hoàn toàn cả reading và meaning.
2. Record `吸います` (Bài 6): Có reading `すいます`, Hán Việt `HẤP` nhưng bỏ trống cột meaning.
3. Record `止 まれ` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt `"dừng lại"`, meaning bị để trống.
4. Record `進入 禁止` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt `"cấm đi vào"`, meaning để trống.
5. Record `一方通行` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt `"đường một chiều"`, meaning để trống.
6. Record `駐車 禁止` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt `"cấm đỗ xe"`, meaning để trống.
7. Record `右折 禁止` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt `"cấm rẽ phải"`, meaning để trống.

---

## 6. Mối quan hệ giữa Master Files và Nguồn Markdown / Ảnh

1. **Master JSON/CSV (`06_Co_So_Du_Lieu_Tong_Hop`):** Là cơ sở dữ liệu có cấu trúc chuẩn hóa cao nhất hiện có với 9.411 record, phục vụ làm đầu vào chính cho Importer ở Task T02.
2. **Hệ thống Markdown (`1.083 file`):** Là nguồn văn bản dùng để đối chiếu cấu trúc giáo trình gốc (mục lục bài học, tiêu đề bài, ngữ cảnh). Tuyệt đối **không nạp toàn bộ Markdown vào database production** nhằm tối ưu kích thước DB và tránh rủi ro bản quyền.
3. **Ảnh minh họa (`220 ảnh JPG`):** Đi kèm giáo trình Tsunagaru Nihongo (Bunka-cho). Tạm thời không đưa vào production DB, chỉ lưu trữ tĩnh phục vụ tham khảo nội bộ.
