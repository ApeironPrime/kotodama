# T03 — Persistence và migration an toàn

## Phạm vi

Thêm migration và importer DB cho dataset canonical; chưa làm API/UI.

## Công việc

- Tạo bảng/index cho anime series, seasons, episodes, media sources, subtitle tracks/cues/tokens, playlists, watch progress và import runs.
- Tách cue/token để truy vấn theo episode/time; không lưu dictionary monolith trong một row.
- Import transaction, idempotent, upsert tôn trọng `is_curated`; rollback không để orphan.
- Hỗ trợ SQLite local và PostgreSQL cùng contract; có guard chống ghi nhầm Neon/production.
- Không xoá dữ liệu người dùng, SRS hoặc media hiện có.

## Nghiệm thu

- Migration chạy hai lần không lỗi; ingest hai lần không nhân bản.
- Có index plan cho catalog, episode, cue time và resume progress.
- Test rollback giữa transaction và hash import run.
