# T01 — Data audit, coverage và provenance

## Phạm vi

Chỉ đọc `D:\Project\data\aanime_scraper`. Không sửa UI/API/DB và không crawl mạng.

## Công việc

1. Viết `scripts/anime/audit-source.mjs` nhận `--source-root`, duyệt tất định toàn bộ nguồn và sinh manifest SHA-256 theo file.
2. Đối chiếu `all_data.json`, `series.json`, CSV, playlist, subtitle JSON/SRT/VTT và dictionary; phát hiện record thiếu, trùng slug/id, episode không có nguồn phát, timestamp sai hoặc cue chồng lấn.
3. Lập coverage theo series: tổng tập, tập có video ID, tập chỉ có watch URL, tập archive, tập có JSON/SRT/VTT, cue Nhật/Việt, token có `word_id`.
4. Xác minh thuật toán dictionary shard từ dữ liệu thật và ghi rõ sai lệch `%1000`/`%100`.
5. Tạo `source-manifest.json`, `provenance.csv` và `data-audit.md`; không chứa timestamp trong phần hash tất định.
6. Gán trạng thái quyền ở cấp dataset/field: `unknown`, `restricted`, `approved`; mặc định unknown/restricted không được public.

## Nghiệm thu

- Test fixture cho duplicate, thiếu source, subtitle lệch và shard mismatch.
- Báo cáo giải thích được chênh số README cũ với master hiện tại.
- Chạy `node --test scripts/anime/*.test.mjs`, `npm run typecheck`, `npx oxlint scripts/anime/`.
- Không có file nguồn nào thay đổi.

