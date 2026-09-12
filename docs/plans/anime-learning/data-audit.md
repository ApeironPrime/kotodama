# Báo Cáo Kiểm Toán Dữ Liệu & Nguồn Gốc (Data Audit & Provenance) — Anime Learning

**Ngày thực hiện kiểm toán:** `2026-09-11T14:11:37.048Z`  
**Nguồn dữ liệu kiểm toán (Read-only Source):** `D:\Project\data\aanime_scraper`  
**Nhiệm vụ:** Task T01 — Data audit, coverage và provenance  
**Trạng thái nghiệm thu:** **HOÀN THÀNH KIỂM TOÁN NGUỒN TẤT ĐỊNH & ĐỐI CHIẾU HAI CHIỀU**

---

## 1. Tổng Quan Cây Dữ Liệu Nguồn (Source Manifest Summary)

Hệ thống đã thực hiện duyệt tất định (deterministic traversal) toàn bộ 100% tệp trong thư mục nguồn:
- **Tổng số tệp nguồn:** **5.213 tệp**
- **Tổng dung lượng:** **2229.45 MB** (2.18 GB)
- **Mã băm tổng thể (Overall Manifest SHA-256):** `6ddaf0bf0adf0a8d2fdb2cd57767e14295e4d8f0a1d3f547f788bb786d1f7d0f`
- **Tính tất định:** Danh sách tệp được sắp xếp alphabet chuẩn POSIX, mã băm tính theo nội dung bytes; không chứa thời gian thực thi runtime trong phần tính băm.

### Bảng phân bố định dạng tệp (Format Breakdown)

| Định dạng mở rộng | Số lượng tệp | Tổng dung lượng (Bytes) | Tỷ trọng dung lượng |
| :--- | :---: | :---: | :---: |
| `.json` | 2.202 | 2.187.854.423 | 93.59% |
| `.vtt` | 1.502 | 71.772.158 | 3.07% |
| `.srt` | 1.502 | 71.757.138 | 3.07% |
| `.csv` | 6 | 6.360.019 | 0.27% |
| `.md` | 1 | 2.825 | 0.00% |

---

## 2. Giải Thích Sai Lệch Số Liệu: README Cũ (2026-08-20) vs Master Dataset (2026-09-11)

Báo cáo giải trình rõ nguyên nhân chênh lệch giữa số liệu trong tệp `README.md` cũ và số liệu thực tế trong tệp master:

| Chỉ số dữ liệu | README cũ (2026-08-20) | Master Dataset (2026-09-11) | Chênh lệch thực tế | Nguyên nhân kỹ thuật |
| :--- | :---: | :---: | :---: | :--- |
| **Nguồn cào (Domain)** | `https://aanime.tv/` | `https://akaiwa.tv/` | Đổi tên miền | Dịch vụ Sekai Watch rebrand sang Akaiwa |
| **Tổng số Series** | **141** | **143** | **+2** | Bổ sung 2 phim điện ảnh mới: *Đứa Con Của Thời Tiết* (`dua-con-cua-thoi-tiet`) và *Mẫu Tử Lầm Lỡ* (`mau-tu-lam-lo`) |
| **Tổng tập phim (Episodes)** | **2.513** | **2.528** | **+15** | 2 tập từ 2 movie mới + 13 tập cập nhật các series ongoing |
| **Tổng Playlists** | **129** | **128** | **-1** | Gộp/loại bỏ 1 playlist trùng lặp trên kênh học tập |
| **Video trong Playlist** | **1.598** | **1.596** | **-2** | 2 video bị xóa trên YouTube hoặc loại khỏi danh sách phát |
| **Bài học Sekai N5** | 25 | 25 | 0 | Đồng nhất 100% |
| **Từ vựng N5 trích xuất** | 1.240 | 1.240 | 0 | Đồng nhất 100% |
| **Ngữ pháp N5 trích xuất** | 132 | 132 | 0 | Đồng nhất 100% |

> [!NOTE]
> Báo cáo chính thức và các task tiếp theo (T02–T08) lấy số liệu động chuẩn xác theo Master Dataset hiện tại: **143 series, 2.528 tập, 128 playlist, 1.596 video playlist**.

---

## 3. Đối Chiếu Hai Chiều Master Metadata & Episodes CSV (Two-Way Reconciliation)

### 3.1. Đối chiếu hai chiều Series: `all_data.series` ↔ `series.json`
Hệ thống đã thực hiện đối chiếu hai chiều theo cả ID và Slug giữa hai tập tin JSON master:
- **Số lượng Series:** `all_data.series` có **143 series**, `series.json` có **143 series**.
- **Đối chiếu ID hai chiều:** 
  * Có trong `all_data` nhưng thiếu trong `series.json`: **0 ID**.
  * Có trong `series.json` nhưng thiếu trong `all_data`: **0 ID**.
  * Trùng lặp ID trong `all_data`: **0**. Trùng lặp ID trong `series.json`: **0**.
- **Đối chiếu Slug hai chiều:**
  * Có trong `all_data` nhưng thiếu trong `series.json`: **0 slug**.
  * Có trong `series.json` nhưng thiếu trong `all_data`: **0 slug**.
  * Trùng lặp Slug trong `all_data`: **0**. Trùng lặp Slug trong `series.json`: **0**.
- **So sánh trường cốt lõi (Core fields):** Kiểm tra `title_vi`, `title_ja`, `video_source`, `jlpt_level`, `total_episodes`, `poster_url` và `all_episodes.length` $ightarrow$ **0 trường sai lệch**.
- **So sánh episode keys & source fields:** Kiểm tra toàn bộ khóa `(season_slug, ep_number)` và nguồn phát (`youtube_video_id`, `watch_url`) $ightarrow$ **0 khóa lệch**, **0 nguồn lệch**.

### 3.2. Đối chiếu hai chiều Episodes: JSON ↔ `episodes.csv`
Đã xử lý UTF-8 BOM ở header CSV, so sánh hai chiều theo khóa bộ ba `(series_slug, season, ep_number)`:
- **Tổng số bản ghi:** JSON có **2.528 tập**, CSV có **2.528 dòng tập**.
- **Kiểm tra trùng lặp khóa trong CSV:** **0 khóa trùng lặp** (đếm tần suất chính xác).
- **Dư / Thiếu bản ghi hai chiều:**
  * Có trong JSON nhưng thiếu trong CSV (`missingInCsv`): **0 tập**.
  * Có trong CSV nhưng thiếu trong JSON (`extraInCsv`): **0 tập**.
- **So sánh trường nguồn phát (Source Fields Verification):**
  * Sai lệch trường `youtube_video_id`: **0 tập**.
  * Sai lệch trường `watch_url` (`Link xem`): **0 tập**.

### 3.3. ⚠️ Dị Thường Thực Tế Ghi Nhận: 19 Series Lệch Trường "Số Tập" trong `series.csv`
Khi đối chiếu trường `Số tập` của `series.csv` với mảng `all_episodes` trong JSON, phát hiện **19 series có sự chênh lệch**:
- **Bản chất kỹ thuật:** Đây là các series có nhiều phần/mùa (Multi-season).
  * Trong `series.csv` và trường `s.total_episodes`: số liệu ghi nhận số tập của **riêng mùa/phần đó** (ví dụ Attack on Titan Phần 1 là 25 tập, Phần 2 là 12 tập, Phần 3 là 12 tập...).
  * Trong mảng `s.all_episodes` của JSON: bộ thu thập gộp toàn bộ các tập của cả show (ví dụ Attack on Titan gộp đủ 75 tập của cả 5 phần).
- **Trạng thái:** Dị thường cấu trúc phân cấp (Structural multi-season anomaly). Importer T02 phải nhận biết cấu trúc này để lưu trữ quan hệ Season - Episode chính xác.

| STT | Series Slug | Tiêu đề Tiếng Việt | CSV `Số tập` | JSON `total_episodes` | JSON `all_episodes.length` | Bản chất cấu trúc |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `chao-mung-den-lop-hoc-biet-tuot` | Lớp Học Biết Tuốt | **12** | **12** | **38** | Mùa riêng (12) vs Gộp show (38) |
| 2 | `dai-chien-titan-phan-2` | Đại Chiến Titan Phần 2 | **12** | **12** | **75** | Mùa riêng (12) vs Gộp show (75) |
| 3 | `re-zero-phan-2` | Re:Zero (Phần 2) | **11** | **11** | **27** | Mùa riêng (11) vs Gộp show (27) |
| 4 | `re-zero-phan-3` | Re:Zero (Phần 3) | **16** | **16** | **27** | Mùa riêng (16) vs Gộp show (27) |
| 5 | `dai-chien-titan-phan-3` | Đại Chiến Titan (Phần 3) | **12** | **12** | **75** | Mùa riêng (12) vs Gộp show (75) |
| 6 | `vi-so-dau-nen-toi-nang-het-cho-phong-thu` | Vì Sợ Đau | **12** | **12** | **24** | Mùa riêng (12) vs Gộp show (24) |
| 7 | `vi-so-dau-nen-toi-nang-het-cho-phong-thu-phan-2` | VÌ SỢ ĐAU NÊN TÔI NÂNG HẾT CHO PHÒNG THỦ (PHẦN 2) | **12** | **12** | **24** | Mùa riêng (12) vs Gộp show (24) |
| 8 | `nhat-quy-nhi-ma-thu-ba-takagi-mua-1` | Nhất Quỷ Nhì Ma Thứ Ba Takagi | **12** | **12** | **24** | Mùa riêng (12) vs Gộp show (24) |
| 9 | `phuc-lanh-cho-the-gioi-tuyet-voi-nay-phan-2` | PHÚC LÀNH CHO THẾ GIỚI TUYỆT VỜI NÀY (PHẦN 2) | **10** | **10** | **31** | Mùa riêng (10) vs Gộp show (31) |
| 10 | `phuc-lanh-cho-the-gioi-tuyet-voi-nay-phan-3` | PHÚC LÀNH CHO THẾ GIỚI TUYỆT VỜI NÀY (PHẦN 3) | **11** | **11** | **31** | Mùa riêng (11) vs Gộp show (31) |
| 11 | `dai-chien-titan-phan-4` | Đại Chiến Titan (Phần 4) | **10** | **10** | **75** | Mùa riêng (10) vs Gộp show (75) |
| 12 | `dai-chien-titan-phan-1` | Đại Chiến Titan | **25** | **25** | **75** | Mùa riêng (25) vs Gộp show (75) |
| 13 | `chao-mung-den-lop-hoc-biet-tuot-phan-3` | Lớp Học Biết Tuốt | **13** | **13** | **38** | Mùa riêng (13) vs Gộp show (38) |
| 14 | `dai-chien-titan-phan-5` | Đại Chiến Titan Phần 5 | **16** | **16** | **75** | Mùa riêng (16) vs Gộp show (75) |
| 15 | `phuc-lanh-cho-the-gioi-tuyet-voi-nay-phan-1` | PHÚC LÀNH CHO THẾ GIỚI TUYỆT VỜI NÀY (PHẦN 1) | **10** | **10** | **31** | Mùa riêng (10) vs Gộp show (31) |
| 16 | `chao-mung-den-lop-hoc-biet-tuot-phan-2` | Lớp Học Biết Tuốt | **13** | **13** | **38** | Mùa riêng (13) vs Gộp show (38) |
| 17 | `khi-cac-te-bao-lam-viec-phan-2` | KHI CÁC TẾ BÀO LÀM VIỆC (PHẦN 2) | **8** | **8** | **21** | Mùa riêng (8) vs Gộp show (21) |
| 18 | `khi-cac-te-bao-lam-viec` | Khi Các Tế Bào Làm Việc | **13** | **13** | **21** | Mùa riêng (13) vs Gộp show (21) |
| 19 | `nhat-quy-nhi-ma-thu-ba-takagi-phan-3` | Nhất Quỷ Nhì Ma Thứ Ba Takagi | **12** | **12** | **24** | Mùa riêng (12) vs Gộp show (24) |

### Phân loại nguồn phát của 230 tập không dùng YouTube:
- **okru (134 tập):** Ví dụ *Doraemon* (20 tập), *Sazae San* (20 tập), *Cô Đi Mà Lấy Chồng Tôi* (10 tập), *Cô Nàng Kiểm Duyệt* (10 tập)...
- **dailymotion (54 tập):** Ví dụ *Silent* (11 tập), *Một Lít Nước Mắt* (11 tập), *Yêu Không Hối Tiếc* (11 tập), *Người Đẹp Thẩm Mỹ* (10 tập)...
- **archive (31 tập):** Ví dụ *Atashin'chi* (27 tập), *Đứa Con Của Thời Tiết* (1 tập), *Dáng Hình Thanh Âm* (1 tập), *Lâu Đài Bay Của Howl* (1 tập)...
- **bilibili (11 tập):** Ví dụ *Từ Hôm Nay Đến Lượt Tôi* (10 tập), *Mẫu Tử Lầm Lỡ* (1 tập).

> [!WARNING]
> Ràng buộc nghiêm ngặt: 230 tập nguồn `archive`, `bilibili`, `dailymotion`, `okru` tuyệt đối **không được xem là stream URL** có thể phát tự do; phải được gán trạng thái `restricted` và chặn hoàn toàn ở chế độ người dùng công khai.

---

## 4. Kiểm Toán Danh Sách Phát Toàn Diện Cả 4 Nguồn (Playlists Full Audit)

Hệ thống đã kiểm toán đồng thời bộ 4 nguồn dữ liệu: `all_data.playlists`, `playlists.json`, `playlists.csv` và `playlist_videos.csv` bằng bảng băm đếm tần suất (không dùng Set làm mất dấu trùng lặp):

### 4.1. Bảng đối chiếu Playlist Metadata:
| Chỉ số kiểm toán Playlists | `all_data.json` | `playlists.json` | `playlists.csv` | Kết quả đối chiếu hai chiều |
| :--- | :---: | :---: | :---: | :--- |
| **Tổng số Playlist** | **128** | **128** | **128** | Khớp hai chiều 100% giữa cả 3 nguồn |
| **Trùng lặp ID trong từng nguồn** | **0** | **0** | **0** | **0 ID trùng lặp** |
| **Trùng lặp Slug trong từng nguồn** | **0** | **0** | **0** | **0 Slug trùng lặp** |
| **Thiếu / Thừa Playlist theo ID** | 0 | 0 | 0 | `inAllDataNotPlaylistsJsonById: 0`, `inPlaylistsJsonNotCsvById: 0` |
| **Thiếu / Thừa Playlist theo Slug** | 0 | 0 | 0 | `inAllDataNotPlaylistsJsonBySlug: 0`, `inPlaylistsJsonNotCsvBySlug: 0` |
| **ID Mismatch khi cùng Slug** | — | **0** | **0** | **0 sai lệch ID khi cùng Slug** |
| **Slug Mismatch khi cùng ID** | — | **0** | **0** | **0 sai lệch Slug khi cùng ID** |

### 4.2. Đối chiếu hai khóa Video trong `playlist_videos.csv`:
Hệ thống đối chiếu độc lập cả 2 khóa: `(playlist_id, video_id)` và `(playlist_slug, video_id)`:
- **Tổng lượt bản ghi Video:** JSON có **1.596**, CSV có **1.596**.
- **Khớp hoàn hảo cả 2 khóa:** **1.596 / 1.596 bản ghi (100%)**.
- **Khóa ID khớp nhưng Slug sai (`keyMismatchIdMatchesSlugFails`):** **0 bản ghi**.
- **Khóa Slug khớp nhưng ID sai (`keyMismatchSlugMatchesIdFails`):** **0 bản ghi**.
- **Bản ghi video không khớp cả 2 khóa (`missingVideosInJson`):** **0 bản ghi**.
- **Video trong JSON thiếu trong CSV (`missingVideosInCsv`):** **0 bản ghi**.
- **Trùng lặp Video trong nội tại 1 playlist:** **0**.
- **Dòng video trùng lặp trong CSV (`csvDuplicateVideoRows`):** **0**.
- **Video YouTube thực tế duy nhất:** **1.277 video** (319 lượt video dùng chung giữa &ge; 2 playlist).

---

## 5. Đối Chiếu Hai Chiều Từ Điển & Kiểm Toán Phân Mảnh (Dictionary Reconciliation & Sharding)

### 5.1. Đối chiếu hai chiều `dictionary_full.json` ↔ `dictionary_full.csv`
Hệ thống đã thực hiện đối chiếu hai chiều từng ID từ vựng giữa tệp JSON monolith và CSV:
- **Số lượng mục từ trong JSON (`dictionary_full.json`):** **39.516 entries**
- **Số lượng dòng dữ liệu trong CSV (`dictionary_full.csv`):** **39.516 rows**
- **Trùng lặp ID trong tệp CSV:** **0 trùng lặp**
- **Có trong JSON nhưng thiếu trong CSV (`inJsonNotCsv`):** **0 ID**
- **Có trong CSV nhưng thiếu trong JSON (`inCsvNotJson`):** **0 ID**
- **Kết luận:** Hai tập tin này đồng nhất tuyệt đối **39.516 mục từ** (khác con số 59.224 trong `_meta.json`).

### 5.2. Giải trình sự phân tách 3 tập dữ liệu từ điển:
1. **`_meta.json` (`total_words = 59,224`):** Chỉ số thống kê tham chiếu tổng số từ vựng lý thuyết trong toàn bộ hệ sinh thái.
2. **`dictionary_full.json` & `dictionary_full.csv` (**39.516** mục từ):** Tập dữ liệu thực thể từ điển đầy đủ hiện có. Toàn bộ 666 shard cũng chứa chính xác 39.516 từ này. **Tuyệt đối không đồng nhất `dictionary_full` với con số 59.224.**
3. **`word-index.json` (**59.225** khóa từ vựng):**
   * Ánh xạ về **59.224 ID từ vựng duy nhất** (khớp chính xác với con số 59.224 trong `_meta.json`).
   * **Từ đồng âm/trùng ID (Homophone collision):** Phát hiện 1 `word_id` duy nhất là **`3144121485`** đồng thời ánh xạ đến 2 từ: `'アニソン'` (Anisong) và `'柔道家'` (Võ sĩ Judo).
   * **Từ chưa có trong từ điển đầy đủ (Unreferenced IDs):** Có chính xác **19.708 ID** xuất hiện trong chỉ mục `word-index.json` nhưng không có mục từ chi tiết trong `dictionary_full.json` ($59.224 - 39.516 = 19.708$).

### 5.3. Kiểm chứng thuật toán phân mảnh Shard:
Tệp `dictionary/_meta.json` có sự mâu thuẫn giữa công thức và ghi chú:
- **Dòng 6 (`shard_formula`):** `word_id % 1000 → shard-{NN}.json (NN zero-pad 3 digit)`
- **Dòng 10 (`note`):** `Client: cue word_id → fetch shard-(id%100) → entry = shard[String(word_id)]`

**Kết quả kiểm toán thực nghiệm:**
1. **Quy ước tên file:** 100% tệp trong `dictionary/shards/` có tên dạng `shard-NNN.json` (3 chữ số zero-padded từ `000` đến `999`). Có **666 tệp shard** thực tế tồn tại.
2. **Kiểm tra modulo 1000:** Toàn bộ **39.516 từ** trong 666 shard đều thỏa mãn chính xác:
   $$\text{entry.id} \pmod{1000} == \text{shardNumber}$$
   Số lỗi modulo 1000: **0 lỗi (0%)**.
3. **Độ lệch định tuyến khi dùng modulo 100:**
   * Số mục từ có giá trị `id % 100` khác với `id % 1000`: **33.648 từ**.
   * **Tỷ lệ sai lệch định tuyến (Routing mismatch rate): 85.15%** (đã kiểm chứng thực nghiệm trên toàn bộ 39.516 từ).
   * **Đánh giá ảnh hưởng:** Nếu client sử dụng modulo 100 để định tuyến, 85,15% từ vựng sẽ bị tra cứu vào sai shard hoặc gặp lỗi HTTP 404 (tùy theo quy ước định dạng tên file 2 hay 3 chữ số và cơ chế fallback của router máy chủ).

> [!IMPORTANT]
> **Kết luận chuẩn hóa thuật toán Shard:** Client và API **BẮT BUỘC** dùng công thức chuẩn:
> ```javascript
> const shardFilename = `shard-${String(wordId % 1000).padStart(3, '0')}.json`
> ```

---

## 6. Kiểm Toán Phụ Đề & Tính Toàn Vẹn Cấu Trúc (Subtitles Deep Audit)

Hệ thống đã duyệt và kiểm tra toàn bộ cây thư mục phụ đề `subtitles/`:
- **Tổng số thư mục series có phụ đề:** **129 / 143 series** (14 series không có thư mục phụ đề).
- **Tổng số tệp phụ đề:** **4.506 tệp** (1.502 JSON, 1.502 SRT, 1.502 VTT).
- **Bộ ba tệp đầy đủ (Full Triples JSON + SRT + VTT):** **1.502 tập (100%)**.
- **Bộ ba tệp khuyết (Incomplete Triples):** **0 tập**.
- **Lỗi đọc định dạng JSON (JSON Parse Errors):** **0 tệp**.
- **Lỗi cấu trúc mảng cues (Structural Errors):** **0 tệp**.
- **Tổng số Cues đối thoại:** **584.827 cues**
  * Cues có tiếng Nhật (`ja`): **584.827 (100%)**
  * Cues có tiếng Việt (`vi`): **584.827 (100%)**
  * Cues song ngữ đầy đủ cả 2 thứ tiếng: **584.827 (100%)**
- **Tổng số Tokens:** **4.964.487 tokens**
  * Tokens có liên kết `word_id` từ điển: **1.829.910 (36.86%)**
  * Các token không có `word_id` là trợ từ ngữ pháp, dấu câu, ký hiệu âm thanh (`（`, `）`, `…`, `！`).

### Bất thường dòng thời gian ghi nhận trong phụ đề:
1. **Lỗi Timestamp (`end <= start` hoặc âm):** **1 cue duy nhất**
   - Tệp: `smartphone-va-nhung-nguoi-ban/ep10.json` — Cue ID 1: `start: 0, end: 0` (Đoạn text rỗng mở đầu). Importer T02 sẽ có quy tắc tự động bỏ qua cue 0 giây này.
2. **Cue chồng lấn thời gian (`start < prevEnd`):** **565 cues**
   - Hiện tượng tự nhiên trong phim hoạt hình khi có hai nhân vật đối thoại cùng lúc, hoặc thoại nền đè lên nhạc phim/hiệu ứng. Player T06 cần hỗ trợ hiển thị đồng thời nhiều cue tại cùng mốc thời gian.

---

## 7. Ma Trận Quản Lý Quyền & Bảo Vệ Dữ Liệu (Rights Matrix)

Tuân thủ nguyên tắc cốt lõi: **Mặc định đóng (`unknown` / `restricted`), không công khai ra internet khi chưa thẩm định quyền.**

| Phân tầng dữ liệu | Trường dữ liệu | Nguồn gốc (Origin) | Trạng thái quyền | Chính sách phát hành & hiển thị |
| :--- | :--- | :--- | :---: | :--- |
| **Series Metadata** | `title_vi`, `title_ja`, `poster_url`, `genre` | Cào từ Akaiwa/AniList | `unknown` | Chỉ hiển thị trong môi trường local dev của owner |
| **Tập phim YouTube** | `youtube_video_id` (2.298 tập) | YouTube công khai | `restricted` | Chỉ nhúng qua YouTube Player IFrame chuẩn, tuân thủ YouTube TOS |
| **Tập phim Archive** | `watch_url` (230 tập) | Archive / Bilibili / Okru | `restricted` | **CHẶN HOÀN TOÀN** — Không proxy stream, không phát public |
| **Phụ đề tiếng Nhật** | Trường `ja` trong cues | Studios Anime bản quyền | `restricted` | Bảo vệ chống tải hàng loạt; chỉ phục vụ tra cứu học tập local |
| **Phụ đề tiếng Việt** | Trường `vi` trong cues | Fansub / Dịch cào | `unknown` | Bản dịch chưa có giấy phép thương mại; chỉ dùng nội bộ |
| **Từ điển & Shards** | 666 shards, 39.516 mục từ | Dữ liệu biên soạn nguồn mở | `unknown` | Cần ghi nhận nguồn tác giả (Attribution); không expose file 127 MB |
| **Giáo trình Sekai N5** | 25 bài JSON | Sekai Gen tự soạn | `unknown` | Chờ hội đồng pháp lý duyệt trước khi mở catalog công khai |

---

## 8. Bảng Thống Kê Độ Phủ Chi Tiết Theo 143 Series (Series Coverage Table)

| STT | Series Slug | Tiêu đề Tiếng Việt | JLPT | Nguồn video | Tổng tập | YouTube ID | Watch URL | Archive | Sub JSON/SRT/VTT | Triples | Tổng Cues | Tokens có Word ID / Tổng |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `dua-con-cua-thoi-tiet` | Đứa Con Của Thời Tiết | — | archive | 1 | 0 | 1 | 1 | 0/0/0 | 0 | 0 | 0 / 0 |
| 2 | `mau-tu-lam-lo` | Mẫu Tử Lầm Lỡ | — | bilibili | 1 | 0 | 1 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 3 | `dang-hinh-thanh-am` | Dáng Hình Thanh Âm | — | archive | 1 | 0 | 1 | 1 | 0/0/0 | 0 | 0 | 0 / 0 |
| 4 | `tu-hom-nay-den-luot-toi` | Từ Hôm Nay Đến Lượt Tôi | — | bilibili | 10 | 0 | 10 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 5 | `silent` | Silent | — | dailymotion | 11 | 0 | 11 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 6 | `tinh-ta-dep-tua-doa-hoa` | Tình Ta Đẹp Tựa Đóa Hoa | — | okru | 1 | 0 | 1 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 7 | `mot-lit-nuoc-mat` | Một Lít Nước Mắt | — | dailymotion | 11 | 0 | 11 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 8 | `sazae-san` | Sazae San | — | okru | 20 | 0 | 20 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 9 | `lau-dai-bay-cua-howl` | Lâu Đài Bay Của Pháp Sư Howl | — | archive | 1 | 0 | 1 | 1 | 0/0/0 | 0 | 0 | 0 / 0 |
| 10 | `jlpt-n5` | JLPT N5 — Đề Luyện Nghe Hiểu | N5 | youtube | 10 | 10 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 11 | `co-di-ma-lay-chong-toi` | Cô Đi Mà Lấy Chồng Tôi | — | okru | 10 | 0 | 10 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 12 | `ngon-deo-nhan-dang-len-nha-vua` | Ngón Đeo Nhẫn Dâng Lên Nhà Vua | — | dailymotion | 10 | 0 | 10 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 13 | `vi-than-trong-toilet` | Vị Thần Trong Toilet | — | youtube | 1 | 1 | 0 | 0 | 1/1/1 | 1 | 1.296 | 4.292 / 12.493 |
| 14 | `co-nang-kiem-duyet` | Cô Nàng Kiểm Duyệt | — | okru | 10 | 0 | 10 | 0 | 10/10/10 | 10 | 9.039 | 29.928 / 85.796 |
| 15 | `doraemon` | Doraemon | — | okru | 20 | 0 | 20 | 0 | 20/20/20 | 20 | 5.629 | 17.483 / 54.755 |
| 16 | `atashinchi` | Atashin'chi — Chuyện Nhà Mình | — | archive | 27 | 0 | 27 | 27 | 0/0/0 | 0 | 0 | 0 / 0 |
| 17 | `366-ngay` | 366 Ngày | — | dailymotion | 1 | 0 | 1 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 18 | `nguoi-dep-tham-my` | Người Đẹp Thẩm Mỹ | — | dailymotion | 10 | 0 | 10 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 19 | `yeu-khong-hoi-tiec` | Yêu Không Hối Tiếc | — | dailymotion | 11 | 0 | 11 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 20 | `vung-dat-linh-hon` | Vùng Đất Linh Hồn | — | archive | 1 | 0 | 1 | 1 | 0/0/0 | 0 | 0 | 0 / 0 |
| 21 | `nu-hon-tinh-nghich-phan-1` | Nụ Hôn Tinh Nghịch (Phần 1) | N5 | youtube | 16 | 16 | 0 | 0 | 16/16/16 | 16 | 12.560 | 33.942 / 92.658 |
| 22 | `yuusha-kei-ni-shosu` | Tuyên Án Dũng Giả | N2 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 5.805 | 17.515 / 46.697 |
| 23 | `kaina` | Kaina Của Biển Tuyết Vĩ Đại | N2 | youtube | 11 | 11 | 0 | 0 | 11/11/11 | 11 | 4.087 | 10.941 / 31.236 |
| 24 | `ginpachi-sensei` | Thầy Ginpachi | N2 | youtube | 11 | 11 | 0 | 0 | 10/10/10 | 10 | 4.811 | 14.750 / 41.076 |
| 25 | `yuru-camp-s1` | Yuru Camp: Hội Lều Trại | N4 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 26 | `tsumasho` | Vợ Tôi Biến Thành Học Sinh Tiểu Học | N5 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.551 | 11.675 / 33.762 |
| 27 | `torture-princess` | Torture Princess | N2 | youtube | 12 | 12 | 0 | 0 | 10/10/10 | 10 | 3.552 | 12.741 / 31.965 |
| 28 | `takt-op-destiny` | Takt Op. Destiny | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.135 | 11.597 / 38.111 |
| 29 | `seihantai-na-kimi-to-boku` | Em Và Tôi Trái Ngược | N4 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 5.190 | 13.470 / 38.174 |
| 30 | `puniru-kawaii-slime-s1` | Puniru Là Slime Dễ Thương | N3 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 31 | `pseudo-harem` | Hậu Cung Giả Lập | N4 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.711 | 11.887 / 36.443 |
| 32 | `otaku-elf` | Elf Cận Đại | N4 | youtube | 12 | 12 | 0 | 0 | 10/10/10 | 10 | 3.909 | 12.450 / 34.416 |
| 33 | `oblivion-battery` | Oblivion Battery | N2 | youtube | 12 | 12 | 0 | 0 | 10/10/10 | 10 | 5.093 | 12.934 / 39.185 |
| 34 | `no-game-no-life` | No Game No Life | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.786 | 16.032 / 40.086 |
| 35 | `million-lives-s2` | Tôi Đứng Trên 1 Triệu Sinh Mệnh (Phần 2) | N3 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 36 | `mf-ghost-s3` | MF Ghost (Phần 3) | N2 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 37 | `ice-guy` | Chàng Trai Băng Giá Và Nữ Đồng Nghiệp Lạnh Lùng | N5 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.211 | 13.094 / 40.761 |
| 38 | `how-i-attended-mixer` | Đi Hẹn Hò Tập Thể Mà Toàn Con Trai | N5 | youtube | 12 | 12 | 0 | 0 | 9/9/9 | 9 | 4.052 | 9.734 / 28.313 |
| 39 | `highspeed-etoile` | Highspeed Étoile | N1 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 5.081 | 13.738 / 38.538 |
| 40 | `faraway-paladin` | Thánh Kỵ Sĩ Nơi Tận Cùng Thế Giới | N2 | youtube | 12 | 12 | 0 | 0 | 9/9/9 | 9 | 3.930 | 13.508 / 40.388 |
| 41 | `dekin-mogura` | Chú Chuột Chũi Bị Cấm Cửa | N3 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.774 | 17.160 / 42.421 |
| 42 | `condition-called-love` | Hanano Và Căn Bệnh Tình Yêu | N5 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 3.511 | 12.208 / 32.245 |
| 43 | `anyway-falling-in-love-s1` | Cuối Cùng Cũng Yêu Em | N5 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 44 | `angel-next-door-s1` | Thiên Sứ Nhà Bên | N5 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 45 | `girl-i-like` | Cô Gái Tôi Thích Quên Mang Kính | N5 | youtube | 13 | 13 | 0 | 0 | 10/10/10 | 10 | 4.533 | 9.706 / 30.944 |
| 46 | `girl-and-guard-dog` | Tiểu Thư Và Chú Chó Vệ Sĩ | N5 | youtube | 13 | 13 | 0 | 0 | 10/10/10 | 10 | 3.730 | 8.583 / 26.903 |
| 47 | `this-monster-wants-to-eat-me` | Quái Vật Muốn Ăn Thịt Tôi | N3 | youtube | 13 | 13 | 0 | 0 | 12/12/12 | 12 | 4.095 | 11.673 / 30.671 |
| 48 | `sakuna-of-rice-and-ruin` | Sakuna: Nữ Thần Thu Hoạch | N3 | youtube | 13 | 13 | 0 | 0 | 11/11/11 | 11 | 4.659 | 13.052 / 33.598 |
| 49 | `rock-is-a-ladys-modesty` | Rock Là Thú Vui Tao Nhã Của Quý Cô | N2 | youtube | 13 | 13 | 0 | 0 | 10/10/10 | 10 | 4.076 | 11.493 / 32.355 |
| 50 | `metallic-rouge` | Metallic Rouge | N2 | youtube | 13 | 13 | 0 | 0 | 13/13/13 | 13 | 5.000 | 14.232 / 38.179 |
| 51 | `masterful-cat` | Hôm Nay Mèo Cưng Lại Trầm Cảm | N4 | youtube | 13 | 13 | 0 | 0 | 13/13/13 | 13 | 4.790 | 11.602 / 32.891 |
| 52 | `to-your-eternity-s1` | Gửi Đến Cõi Vĩnh Hằng | N3 | youtube | 20 | 20 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 53 | `solo-camping-for-two` | Cắm Trại Đôi | N3 | youtube | 24 | 24 | 0 | 0 | 24/24/24 | 24 | 9.913 | 30.883 / 79.128 |
| 54 | `mashin-creator-wataru` | Mashin Creator Wataru | N2 | youtube | 23 | 23 | 0 | 0 | 22/22/22 | 22 | 10.828 | 25.471 / 77.177 |
| 55 | `asterisk-war` | Cuộc Chiến Asterisk | N3 | youtube | 24 | 24 | 0 | 0 | 23/23/23 | 23 | 9.216 | 30.009 / 81.498 |
| 56 | `trillion-game` | Trillion Game | N2 | youtube | 26 | 26 | 0 | 0 | 22/22/22 | 22 | 9.655 | 27.580 / 71.487 |
| 57 | `tanya` | Tanya Chiến Ký | N1 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.028 | 14.124 / 33.382 |
| 58 | `chibi-maruko` | Nhóc Maruko | — | okru | 56 | 0 | 56 | 0 | 49/49/49 | 49 | 22.332 | 64.242 / 207.652 |
| 59 | `ca-phe-gau-trang` | Cà Phê Gấu Trắng | — | okru | 17 | 0 | 17 | 0 | 16/16/16 | 16 | 5.373 | 14.213 / 36.486 |
| 60 | `co-ban-gai-lai-them-ban-gai` | Có Bạn Gái Lại Thêm Bạn Gái | N3 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 5.187 | 12.560 / 39.543 |
| 61 | `code-geass-phan-1-66d9138d396ce91d1942d95a` | Code Geass (Phần 1) | N2 | youtube | 25 | 25 | 0 | 0 | 23/23/23 | 23 | 10.399 | 32.122 / 90.446 |
| 62 | `cong-chua-ban-yeu` | CÔNG CHÚA BÁN YÊU | N2 | youtube | 24 | 24 | 0 | 0 | 23/23/23 | 23 | 6.780 | 26.764 / 71.973 |
| 63 | `kem-da-63622d75fe76da533b4c7946` | KEM ĐÁ | N3 | youtube | 22 | 22 | 0 | 0 | 22/22/22 | 22 | 10.068 | 33.359 / 85.822 |
| 64 | `love-all-play` | Love All Play | N3 | youtube | 24 | 24 | 0 | 0 | 24/24/24 | 24 | 7.078 | 19.170 / 50.398 |
| 65 | `chao-mung-den-lop-hoc-biet-tuot` | Lớp Học Biết Tuốt | N3 | youtube | 38 | 38 | 0 | 0 | 12/12/12 | 12 | 4.277 | 13.966 / 40.214 |
| 66 | `grand-blue` | Grand Blue | N3 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 5.605 | 16.699 / 50.578 |
| 67 | `handa-kun` | Handa-kun | N4 | youtube | 6 | 6 | 0 | 0 | 6/6/6 | 6 | 2.233 | 7.971 / 21.721 |
| 68 | `jellyfish-can-t-swim-in-the-night` | Jellyfish Can't Swim in the Night | N4 | youtube | 10 | 10 | 0 | 0 | 10/10/10 | 10 | 3.681 | 10.636 / 35.775 |
| 69 | `fairy-tail-nhiem-vu-tram-nam` | Fairy Tail: Nhiệm Vụ 100 Năm | N3 | youtube | 21 | 21 | 0 | 0 | 21/21/21 | 21 | 6.760 | 23.363 / 64.380 |
| 70 | `gia-su-sieu-quay-reborn` | GIA SƯ SIÊU QUẬY REBORN | N4 | youtube | 16 | 16 | 0 | 0 | 16/16/16 | 16 | 6.556 | 16.286 / 58.311 |
| 71 | `huong-vi-ky-la` | HƯƠNG VỊ KỲ LẠ | N5 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 3.000 | 11.176 / 32.399 |
| 72 | `dung-choc-anh-nua-ma-nagatoro` | ĐỪNG CHỌC ANH NỮA MÀ, NAGATORO! | N3 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.946 | 11.722 / 35.343 |
| 73 | `vong-lap-thu-7-nu-phan-dien-tan-huong-cuoc-song-vo-uu-sau-khi-cuoi-ke-thu-truyen-kiep` | VÒNG LẶP THỨ 7: NỮ PHẢN DIỆN TẬN HƯỞNG CUỘC SỐNG VÔ ƯU SAU KHI CƯỚI KẺ THÙ TRUYỀN KIẾP | N3 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 3.486 | 14.261 / 34.615 |
| 74 | `initial-d-first-stage` | Initial D (First Stage) | N3 | youtube | 8 | 8 | 0 | 0 | 7/7/7 | 7 | 2.165 | 7.947 / 23.351 |
| 75 | `frieren-phap-su-tien-tang` | Frieren Pháp Sư Tiễn Táng | N3 | youtube | 25 | 25 | 0 | 0 | 23/23/23 | 23 | 7.530 | 28.174 / 67.107 |
| 76 | `tokyo-revengers` | Tokyo Revengers | N1 | youtube | 24 | 24 | 0 | 0 | 23/23/23 | 23 | 9.244 | 26.080 / 73.761 |
| 77 | `dac-an-cua-than-3125eb90` | ĐẶC ÂN CỦA THẦN (phần 1) | N3 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 3.762 | 14.197 / 36.964 |
| 78 | `nu-vuong-trum-cuoi-tan-doc-can-nguyen-cua-moi-tham-kich-se-doc-suc-vi-nguoi-dan` | NỮ VƯƠNG TRÙM CUỐI TÀN ĐỘC CĂN NGUYÊN CỦA MỌI THẢM KỊCH SẼ DỐC SỨC VÌ NGƯỜI DÂN | N3 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.061 | 12.884 / 35.224 |
| 79 | `shikimori-khong-chi-de-thuong-thoi-dau` | SHIKIMORI KHÔNG CHỈ DỄ THƯƠNG THÔI ĐÂU | N5 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.807 | 11.566 / 33.095 |
| 80 | `toi-la-thuat-thoai-su-ho-tro-cuc-ac-dan-dat-gia-toc-manh-nhat-the-gioi` | TÔI LÀ THUẬT THOẠI SƯ HỖ TRỢ CỰC ÁC DẪN DẮT GIA TỘC MẠNH NHẤT THẾ GIỚI | N2 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.224 | 15.085 / 42.226 |
| 81 | `quai-vat-so-8` | QUÁI VẬT SỐ 8 | N1 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 2.882 | 10.850 / 26.687 |
| 82 | `hay-to-mau-the-gioi-ngay-mai` | Hãy Tô Màu Thế Giới Ngày Mai | N4 | youtube | 13 | 13 | 0 | 0 | 13/13/13 | 13 | 4.479 | 13.787 / 31.482 |
| 83 | `toi-la-nhen-day-co-sao-khong` | TÔI LÀ NHỆN ĐẤY, CÓ SAO KHÔNG | N2 | youtube | 24 | 24 | 0 | 0 | 24/24/24 | 24 | 9.028 | 30.846 / 82.045 |
| 84 | `that-nghiep-chuyen-sinh` | Thất Nghiệp Chuyển Sinh | N4 | youtube | 23 | 23 | 0 | 0 | 23/23/23 | 23 | 7.903 | 25.962 / 66.218 |
| 85 | `uoc-mo-san-xuat-anime` | ƯỚC MƠ SẢN XUẤT ANIME | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 3.907 | 14.621 / 37.180 |
| 86 | `the-kingdom-of-ruin` | The Kingdom of Ruin | N2 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 3.700 | 9.613 / 28.120 |
| 87 | `ngon-ngu-yeu-thuong` | Ngôn Ngữ Yêu Thương | N5 | youtube | 12 | 12 | 0 | 0 | 9/9/9 | 9 | 3.256 | 9.516 / 25.672 |
| 88 | `toi-tu-bo-tu-cach-la-mot-anh-hung` | TÔI TỪ BỎ TƯ CÁCH LÀ MỘT ANH HÙNG | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.788 | 16.196 / 40.662 |
| 89 | `wistoria-truong-va-kiem` | WISTORIA TRƯỢNG VÀ KIẾM | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 2.894 | 11.032 / 28.222 |
| 90 | `tro-choi-tinh-ban` | TRÒ CHƠI TÌNH BẠN | N2 | youtube | 12 | 12 | 0 | 0 | 10/10/10 | 10 | 4.193 | 14.756 / 40.981 |
| 91 | `dai-chien-titan-phan-2` | Đại Chiến Titan Phần 2 | N3 | youtube | 75 | 75 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 92 | `dororo` | Dororo | N3 | youtube | 24 | 24 | 0 | 0 | 22/22/22 | 22 | 7.097 | 20.312 / 52.540 |
| 93 | `ban-gai-thue` | Bạn Gái Thuê | N4 | youtube | 12 | 12 | 0 | 0 | 10/10/10 | 10 | 4.350 | 10.966 / 33.236 |
| 94 | `chuyen-sinh-thanh-that-hoang-tu-toi-quyet-dinh-trau-doi-ma-thuat` | CHUYỂN SINH THÀNH THẤT HOÀNG TỬ, TÔI QUYẾT ĐỊNH TRAU DỒI MA THUẬT | N2 | youtube | 12 | 12 | 0 | 0 | 10/10/10 | 10 | 3.026 | 11.092 / 29.055 |
| 95 | `re-zero-phan-2` | Re:Zero (Phần 2) | N3 | youtube | 27 | 27 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 96 | `re-zero-phan-3` | Re:Zero (Phần 3) | N3 | youtube | 27 | 27 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 97 | `dai-chien-titan-phan-3` | Đại Chiến Titan (Phần 3) | N2 | youtube | 75 | 75 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 98 | `vi-so-dau-nen-toi-nang-het-cho-phong-thu` | Vì Sợ Đau | N2 | youtube | 24 | 24 | 0 | 0 | 12/12/12 | 12 | 3.634 | 12.953 / 31.737 |
| 99 | `vi-so-dau-nen-toi-nang-het-cho-phong-thu-phan-2` | VÌ SỢ ĐAU NÊN TÔI NÂNG HẾT CHO PHÒNG THỦ (PHẦN 2) | N2 | youtube | 24 | 24 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 100 | `nhat-quy-nhi-ma-thu-ba-takagi-mua-1` | Nhất Quỷ Nhì Ma Thứ Ba Takagi | N5 | youtube | 24 | 24 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 101 | `phuc-lanh-cho-the-gioi-tuyet-voi-nay-phan-2` | PHÚC LÀNH CHO THẾ GIỚI TUYỆT VỜI NÀY (PHẦN 2) | N2 | youtube | 31 | 31 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 102 | `phuc-lanh-cho-the-gioi-tuyet-voi-nay-phan-3` | PHÚC LÀNH CHO THẾ GIỚI TUYỆT VỜI NÀY (PHẦN 3) | N3 | youtube | 31 | 31 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 103 | `dai-ma-vuong-manh-nhat-trong-lich-su-chuyen-sinh` | ĐẠI MA VƯƠNG MẠNH NHẤT TRONG LỊCH SỬ CHUYỂN SINH | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.059 | 12.597 / 32.581 |
| 104 | `dai-chien-titan-phan-4` | Đại Chiến Titan (Phần 4) | N2 | youtube | 75 | 75 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 105 | `dai-chien-titan-phan-1` | Đại Chiến Titan | N2 | youtube | 75 | 75 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 106 | `chao-mung-den-lop-hoc-biet-tuot-phan-3` | Lớp Học Biết Tuốt | N3 | youtube | 38 | 38 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 107 | `dai-chien-titan-phan-5` | Đại Chiến Titan Phần 5 | N2 | youtube | 75 | 75 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 108 | `that-hinh-dai-toi-phan-1` | Thất Hình Đại Tội | N3 | youtube | 24 | 24 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 109 | `phuc-lanh-cho-the-gioi-tuyet-voi-nay-phan-1` | PHÚC LÀNH CHO THẾ GIỚI TUYỆT VỜI NÀY (PHẦN 1) | N3 | youtube | 31 | 31 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 110 | `toi-dung-tren-1-trieu-sinh-menh-phan-1` | TÔI ĐỨNG TRÊN 1 TRIỆU SINH MỆNH (PHẦN 1) | N3 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 111 | `chao-mung-den-lop-hoc-biet-tuot-phan-2` | Lớp Học Biết Tuốt | N3 | youtube | 38 | 38 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 112 | `cau-lac-bo-tiep-vien-truong-ouran` | CÂU LẠC BỘ TIẾP VIÊN TRƯỜNG OURAN | N3 | youtube | 26 | 26 | 0 | 0 | 24/24/24 | 24 | 7.493 | 30.811 / 79.485 |
| 113 | `code-geass-phan-2` | Code Geass (Phần 2) | N2 | youtube | 25 | 25 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 114 | `canh-gioi-bi-phuong` | CẢNH GIỚI BỈ PHƯƠNG | N4 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 3.902 | 11.368 / 27.146 |
| 115 | `dandadan` | Dandadan | N4 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 3.459 | 13.386 / 33.445 |
| 116 | `date-a-live-phan-5` | Date A Live (Phần 5) | N3 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 117 | `dr-stone-phan-2` | Dr. Stone (Phần 2) | N2 | youtube | 11 | 11 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 118 | `dead-mount-dead-play` | Dead Mount Death Play | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.438 | 15.043 / 39.688 |
| 119 | `nhat-ky-song-cham-noi-di-gioi-nuoi-con-trong-luc-lam-mao-hiem-gia` | NHẬT KÝ SỐNG CHẬM NƠI DỊ GIỚI: NUÔI CON TRONG LÚC LÀM MẠO HIỂM GIẢ | N4 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.105 | 13.996 / 46.144 |
| 120 | `khi-cac-te-bao-lam-viec-phan-2` | KHI CÁC TẾ BÀO LÀM VIỆC (PHẦN 2) | N1 | youtube | 21 | 21 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 121 | `danganronpa` | Danganronpa | N3 | youtube | 13 | 13 | 0 | 0 | 13/13/13 | 13 | 4.594 | 16.551 / 39.272 |
| 122 | `hanh-trinh-cua-elaina` | HÀNH TRÌNH CỦA ELAINA | N4 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 5.169 | 15.158 / 40.239 |
| 123 | `khi-cac-te-bao-lam-viec` | Khi Các Tế Bào Làm Việc | N1 | youtube | 21 | 21 | 0 | 0 | 13/13/13 | 13 | 4.790 | 18.272 / 44.277 |
| 124 | `nguoi-yeu-sieu-cap` | NGƯỜI YÊU SIÊU CẤP | N5 | youtube | 10 | 10 | 0 | 0 | 9/9/9 | 9 | 3.596 | 11.421 / 28.174 |
| 125 | `cau-be-sieu-nang-luc` | CẬU BÉ SIÊU NĂNG LỰC | N2 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 3.999 | 14.870 / 36.545 |
| 126 | `nhat-quy-nhi-ma-thu-ba-takagi-phan-3` | Nhất Quỷ Nhì Ma Thứ Ba Takagi | N4 | youtube | 24 | 24 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 127 | `chuyen-sinh-thanh-nhan-vat-nu-phan-dien-otome-game-phan-1` | CHUYỂN SINH THÀNH NHÂN VẬT NỮ PHẢN DIỆN OTOME GAME (phần 1) | N4 | youtube | 12 | 12 | 0 | 0 | 0/0/0 | 0 | 0 | 0 / 0 |
| 128 | `de-nhat-sat-thu-chuyen-sinh-thanh-quy-toc` | ĐỆ NHẤT SÁT THỦ CHUYỂN SINH THÀNH QUÝ TỘC | N2 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.580 | 15.150 / 36.020 |
| 129 | `dance-dance-danseur` | Dance Dance Danseur | N3 | youtube | 11 | 11 | 0 | 0 | 8/8/8 | 8 | 2.713 | 8.372 / 24.712 |
| 130 | `choi-choi-nao` | CHƠI, CHƠI NÀO! | N4 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 4.798 | 13.752 / 37.164 |
| 131 | `smartphone-va-nhung-nguoi-ban` | SMARTPHONE VÀ NHỮNG NGƯỜI BẠN | N3 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 5.321 | 15.321 / 40.738 |
| 132 | `bong-ro-danh-cho-moi-nguoi` | BÓNG RỔ CHO MỌI NGƯỜI | N3 | youtube | 50 | 50 | 0 | 0 | 49/49/49 | 49 | 16.523 | 56.869 / 155.845 |
| 133 | `mieruko-chan` | Mieruko-chan | N4 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.095 | 10.094 / 28.137 |
| 134 | `mot-lan-nua` | Một Lần Nữa | N1 | youtube | 13 | 13 | 0 | 0 | 13/13/13 | 13 | 5.247 | 13.544 / 36.799 |
| 135 | `ban-hung-ca-viking` | BẢN HÙNG CA VIKING | N2 | youtube | 24 | 24 | 0 | 0 | 23/23/23 | 23 | 5.797 | 20.874 / 53.289 |
| 136 | `cuoc-phieu-luu-ki-la-cua-jojo-phan-1-63283ad4c9beae4964369277` | Cuộc Phiêu Lưu Kì Lạ Của Jojo | N2 | youtube | 26 | 26 | 0 | 0 | 23/23/23 | 23 | 6.674 | 25.952 / 64.602 |
| 137 | `luyen-thu-su-sau-khi-bi-duoi-khoi-doi-dung-si-gap-duoc-mieu-nu-cua-chung-toc-manh-nhat` | Luyện Thú Sư: Sau Khi Bị Đuổi Khỏi Đội Dũng Sĩ Gặp Được Miêu Nữ Của Chủng Tộc Mạnh Nhất | N3 | youtube | 13 | 13 | 0 | 0 | 13/13/13 | 13 | 5.175 | 15.743 / 42.739 |
| 138 | `bien-gioi-shangri-la` | BIÊN GIỚI SHANGRI LA | N1 | youtube | 13 | 13 | 0 | 0 | 13/13/13 | 13 | 4.976 | 15.442 / 38.557 |
| 139 | `chu-thuat-hoi-chien` | Chú Thuật Hồi Chiến | N2 | youtube | 24 | 24 | 0 | 0 | 21/21/21 | 21 | 6.211 | 22.723 / 58.089 |
| 140 | `one-punch-man` | One Punch Man | N2 | youtube | 12 | 12 | 0 | 0 | 11/11/11 | 11 | 3.259 | 12.478 / 30.270 |
| 141 | `the-great-cleric` | The Great Cleric | N2 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 5.534 | 17.327 / 44.574 |
| 142 | `gochuumon-wa-usagi-desu-ka` | Gochuumon wa Usagi desu ka? | N4 | youtube | 12 | 12 | 0 | 0 | 12/12/12 | 12 | 4.362 | 15.373 / 40.721 |
| 143 | `nha-ai-quoc-moriarty` | NHÀ ÁI QUỐC MORIARTY | N3 | youtube | 11 | 11 | 0 | 0 | 9/9/9 | 9 | 2.984 | 9.750 / 25.446 |

---

## 9. Danh Mục Tạo Phẩm Bàn Giao Của Nhiệm Vụ T01

1. [**`source-manifest.json`**](file:///d:/Project/kotodama/docs/plans/anime-learning/source-manifest.json): Danh mục 5.213 tệp kèm SHA-256 tất định.
2. [**`provenance.csv`**](file:///d:/Project/kotodama/docs/plans/anime-learning/provenance.csv): Bảng truy xuất nguồn gốc và ma trận quyền chuẩn RFC 4180.
3. [**`data-audit.md`**](file:///d:/Project/kotodama/docs/plans/anime-learning/data-audit.md): Báo cáo kiểm toán toàn diện này.
4. [**`scripts/anime/audit-source.mjs`**](file:///d:/Project/kotodama/scripts/anime/audit-source.mjs): Kịch bản kiểm toán nguồn tự động.
5. [**`scripts/anime/audit-source.test.mjs`**](file:///d:/Project/kotodama/scripts/anime/audit-source.test.mjs): Bộ kiểm thử tự động kiểm chứng toàn bộ các trường hợp biên và đột biến (mutation).
