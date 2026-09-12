# Kế hoạch: Kho Anime có phụ đề tương tác

## Mục tiêu

Xây tab **Anime** độc lập tại `/anime`: người dùng chọn series → chọn tập → xem bằng nguồn phát hợp lệ → theo dõi phụ đề Nhật–Việt đồng bộ → bấm từ để tra → lưu từ/câu vào SRS. Tính năng dùng design token hiện có, không làm thay đổi luồng **Video AI** dành cho video do người dùng nhập.

## Hiện trạng nguồn (kiểm kê sơ bộ 2026-09-11)

- Nguồn chỉ đọc: `D:\Project\data\aanime_scraper`.
- `all_data.json`: 143 series, 2.528 tập, 128 playlist, 1.596 video playlist.
- `subtitles/`: 1.502 tập có đủ bộ JSON + SRT + VTT, tổng 4.506 tệp; JSON có cue Nhật–Việt, timestamp, token và `word_id`.
- `dictionary/`: 59.224 mục, 1.000 shard và word index; `_meta.json` đang có mô tả công thức shard `%1000` nhưng dòng ghi chú cũ lại ghi `%100`, phải xác minh ở T01.
- Metadata chứa cả YouTube ID, URL Akaiwa và tập `video_source=archive` không có URL media trực tiếp. Không được coi `watch_url` là stream URL.
- README cũ ghi 141/2.513/129/1.598, khác dữ liệu master mới 143/2.528/128/1.596; báo cáo chính thức phải lấy số động từ file.

## Ràng buộc bắt buộc

1. Không sửa, di chuyển hoặc ghi thêm vào `D:\Project\data\aanime_scraper`; mọi importer chỉ đọc.
2. Không scrape token phát, vượt paywall, proxy video bên thứ ba hoặc công khai nội dung chưa rõ quyền. Chỉ phát YouTube bằng cơ chế được phép hoặc media do chủ dự án có quyền cung cấp.
3. Metadata, phụ đề và từ điển phải có provenance, content hash và trạng thái quyền riêng biệt. `unknown/restricted` chỉ mở trong chế độ owner-local rõ ràng, không tự bật ở production.
4. Không đưa `dictionary_full.json` 127 MB hoặc toàn bộ subtitle JSON tới browser. API phải phân trang; từ điển dùng shard hoặc truy vấn DB có index.
5. Không dùng URL ảnh/video bên ngoài mà chưa qua allowlist và kiểm tra scheme; không render HTML lấy từ dữ liệu.
6. Dùng icon Lucide và design token hiện có; hỗ trợ light/dark/custom theme, desktop/tablet/mobile, bàn phím và screen reader.
7. Mỗi task phải có test, typecheck, lint và báo cáo diff. Không làm task kế tiếp trước khi task hiện tại được duyệt.
8. Bảo toàn worktree đang có; không reset, format toàn repo, commit, deploy hoặc ghi production DB nếu chưa được yêu cầu.

## Thứ tự task

| Task | Nội dung | Phụ thuộc | Kết quả |
| --- | --- | --- | --- |
| T01 | Data audit, coverage, provenance | — | Manifest, báo cáo độ phủ và ma trận quyền |
| T02 | Canonical schema + importer | T01 | Dataset chuẩn hoá tất định, reject/warning report |
| T03 | Persistence + migration | T02 | Bảng series/season/episode/subtitle/token/progress |
| T04 | Browse/search API | T03 | API catalog, series, episode, search có phân trang |
| T05 | Catalog UI | T04 | Trang Anime, bộ lọc, tìm kiếm, series/episode picker |
| T06 | Playback + subtitle engine | T03–T05 | Player hợp lệ, cue đồng bộ, chuyển Nhật/Việt |
| T07 | Tra từ, SRS và tiến độ | T04, T06 | Bấm từ, popup từ điển, lưu SRS, resume/history |
| T08 | QA, hiệu năng, bảo mật, release gate | T01–T07 | E2E, responsive, accessibility, performance, policy |

## Quy trình giao Antigravity

Chỉ gửi nguyên văn **một** file trong `tasks/` mỗi lượt. Antigravity phải trả lại: file đã đổi, diff stat, lệnh + kết quả test, dữ liệu đếm trước/sau và ảnh desktop/mobile nếu task có UI. Người duyệt phải đọc diff và chạy lại nghiệm thu trước khi giao task kế tiếp.

Task bắt đầu: [T01-data-audit.md](tasks/T01-data-audit.md).
