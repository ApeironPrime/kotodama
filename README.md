# Kotodama

Kotodama là web app học ngôn ngữ với lộ trình, từ vựng/SRS, video AI và quản trị tài khoản.

## Phát triển

```bash
npm install
npm run db:migrate
npm run api
npm run dev
```

API đọc `DATABASE_URL` từ `.env`, áp migration bằng `npm run db:migrate` và dùng PostgreSQL để lưu tài khoản,
phiên đăng nhập, token một lần và nhật ký quản trị. File `.env` không được commit; xem `.env.example` để biết cấu hình.

### Kho giáo trình từ vựng (Curriculum Library)

Kho giáo trình từ vựng chuẩn hỗ trợ lưu trữ phân tách qua biến môi trường `CURRICULUM_STORAGE`:
- **Ở local dev (mặc định)**: Sử dụng SQLite tại `CURRICULUM_SQLITE_PATH` (mặc định: `tmp/curriculum/curriculum.db`). Chạy `npm run curriculum:ingest` để ingest dữ liệu canonical vào SQLite. **Tuyệt đối không chạy migration hoặc ingest vào Neon/PostgreSQL production khi chưa thẩm định quyền sử dụng.**
- **PostgreSQL**: Chỉ kích hoạt khi được cấu hình tường minh `CURRICULUM_STORAGE=postgres` (khi DB đích đã được áp dụng migration `008_curriculum_tables.sql`).
- Hệ thống áp dụng nguyên tắc cách ly nguồn dữ liệu rõ ràng, **không tự động fallback âm thầm** giữa SQLite và PostgreSQL.

## Kiểm tra chất lượng

```bash
npm run ci
```

Lệnh này chạy format, strict typecheck, lint, coverage, test frontend/server và production build.

## Chuẩn bị public

Xem [PUBLIC_LAUNCH.md](PUBLIC_LAUNCH.md) để cấu hình API, static hosting, security headers và checklist trước khi mở public.

## Scripts

- `npm run dev` — chạy local development.
- `npm run build` — tạo artifact production và smoke-check `dist`.
- `npm run preview` — mở artifact production ở local.
- `npm run ci` — quality gate đầy đủ.

## Model A baseline

Phần nghiên cứu phát âm tiếng Nhật được tách riêng khỏi web runtime tại
[`ml/model_a`](ml/model_a/README.md). A0–A1 chuẩn bị audio, Japanese G2P và
phoneme CTC baseline; chưa chấm phát âm hoặc train model riêng.
