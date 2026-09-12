# T02 — Canonical schema và importer tất định

## Phạm vi

Dựa trên T01 đã duyệt; chưa ghi database và chưa làm UI/API.

## Công việc

- Thiết kế schema canonical cho series, season, episode, media source, subtitle track/cue/token, playlist và dictionary reference.
- ID ổn định không phụ thuộc thứ tự file; chuẩn hoá Unicode, slug, số tập, JLPT, URL và timestamp.
- Không coi `watch_url` là media URL; phân loại `youtube`, `authorized_local`, `external_page`, `unavailable`.
- Import metadata và subtitle; dictionary chỉ ghi reference/shard metadata, không nhúng monolith vào dataset.
- Reject dữ liệu hỏng và cảnh báo dữ liệu thiếu; bảo toàn provenance/content hash/rights status.
- Output tại `tmp/anime/canonical-dataset.json`, có schema validator và kết quả chạy lặp lại cùng SHA-256.

## Nghiệm thu

- Test toàn bộ object lồng, uniqueness, referential integrity, count reconciliation và determinism.
- Không có URL/token phát giả và không tự đổi `unknown` thành `approved`.
- Loại bỏ dữ liệu hỏng và cảnh báo dữ liệu thiếu; bảo toàn provenance và rights status.
- Từ điển chỉ ghi reference và shard metadata, không nhúng monolith vào dataset.
- Chạy lặp lại kịch bản importer độc lập sinh ra cùng SHA-256.
- Toàn bộ kết quả đối chiếu, mã băm dataset và source manifest được lưu tại `tmp/anime/import-report.json` và `tmp/anime/import-report.md`.
- Chạy `node --test scripts/anime/*.test.mjs`, `npm run typecheck`, `npx oxlint scripts/anime/`.
