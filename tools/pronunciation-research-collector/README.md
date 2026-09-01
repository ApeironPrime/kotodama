# Kotodama pronunciation research collector

Đây là web **độc lập** chỉ để thu bản ghi và nhãn cho Model A. Nó không import React, route, tài khoản, bảng hay media storage của web Kotodama chính.

## Chạy local

```powershell
cd D:\Project\kotodama\tools\pronunciation-research-collector
Copy-Item .env.example .env
# điền DATABASE_URL và RESEARCH_REVIEW_KEY trong .env
npm.cmd run db:migrate
npm.cmd run dev
```

Mở `http://127.0.0.1:8790`. Người tham gia dùng mã giả danh; không yêu cầu tên, email hoặc tài khoản Kotodama. Người chấm mở tab **Chấm nhãn**, nhập `RESEARCH_REVIEW_KEY` và nghe từng bản ghi.

## Deploy Render

Tạo một **Web Service** với Root Directory là `tools/pronunciation-research-collector`, Build Command `npm install`, Start Command `npm run dev`.

Audio không được lưu trên filesystem tạm của Render. Gắn Persistent Disk tại `/var/data` và đặt `RESEARCH_STORAGE_PATH=/var/data`. Các biến `DATABASE_URL` và `RESEARCH_REVIEW_KEY` phải được đặt trong Render Environment; không commit chúng vào Git.

## Vòng đời

- Khi đủ data: xuất manifest/audio/artifact để train A6/A7; sau đó ngừng deploy collector.
- Xóa collector chỉ cần xóa thư mục này và storage path riêng. Bảng PostgreSQL có tên `research_collector_*`, không phụ thuộc các bảng của Kotodama.
- Không đưa audio thô lên Git hoặc Kaggle public. Lưu consent và participant code riêng để có thể tách speaker khi train/test.
