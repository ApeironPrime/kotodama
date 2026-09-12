# R01 — Khôi phục regression NhaiKanji cho server integration test

## Mục tiêu

Khôi phục tính tất định của regression test NhaiKanji. Hiện lệnh sau fail tại `server/api.integration.test.mjs:214` vì endpoint `GET /api/v1/nhaikanji/kanji?level=N5&limit=5` trả `items: []`:

```powershell
node --test server/*.test.mjs
```

Kết quả cần đạt: test đó có dữ liệu N5 hợp lệ, test detail `土` và danh sách ngữ pháp N4 vẫn đúng; toàn bộ server test xanh. Đây là task sửa regression/fixture, **không phải T08**.

## Phạm vi

- Chỉ đọc/điều tra code và data NhaiKanji hiện có: `server/nhaikanji-service.mjs`, router NhaiKanji trong `server/index.mjs`, `server/api.integration.test.mjs`, test NhaiKanji hiện hữu, và fixture/data được service dùng.
- Được sửa code hoặc fixture/test setup tối thiểu để service có cùng dữ liệu xác định trong môi trường test lẫn local.
- Giữ API public hiện có, gồm query `level`, `q/query`, `page`, `limit`, response envelope và mã 404 cho mục không tồn tại.
- Nếu data nguồn thực sự không có, phải tạo **fixture test tối thiểu, version-controlled**, có ít nhất Kanji N5 `土` và một mục ngữ pháp N4 hợp lệ. Không làm test phụ thuộc DB/cache/local user machine.

## Không làm

- Không sửa Anime, SRS, curriculum, AI/dịch máy, authentication, migration, scraping hoặc deploy.
- Không xóa assertion `items.length > 0`, không đổi assertion thành điều kiện yếu hơn, không skip/only test, không che lỗi bằng fallback rỗng.
- Không thêm network fetch, không tải data runtime, không dùng đường dẫn máy cá nhân tuyệt đối.
- Không format hay chỉnh file ngoài scope.

## Các bước bắt buộc

1. Tái hiện đúng lỗi bằng `node --test server/*.test.mjs`.
2. Xác định root cause với evidence: service load sai đường dẫn, fixture không được seed, filter level không khớp, cache khởi tạo sai, hoặc regression khác.
3. Sửa tại boundary phù hợp:
   - Ưu tiên inject/configure fixture directory trong test; hoặc
   - Sửa loader/service để fallback dữ liệu fixture có kiểm soát chỉ khi test setup yêu cầu.
4. Bổ sung test riêng chứng minh:
   - List N5 có ít nhất một item và không rỗng.
   - Detail `土` trả đúng item.
   - Bunpo N4 có ít nhất một item.
   - Filter cấp độ không trả lẫn data sai cấp.
5. Không biến API production thành hard-code test data. Production thiếu data phải có trạng thái rõ ràng; test phải chủ động seed/inject data xác định.

## Nghiệm thu

Chạy và gửi output thực tế:

```powershell
node --test server/*.test.mjs
npm run typecheck
npx oxlint server/nhaikanji-service.mjs server/nhaikanji-service.test.mjs server/api.integration.test.mjs server/index.mjs
npm run test:frontend
git diff --check
git diff --stat
```

## Bàn giao

1. Root cause, kèm file/dòng liên quan.
2. Danh sách file thay đổi và lý do từng file.
3. Output đầy đủ các lệnh nghiệm thu, bao gồm số pass/fail/skip.
4. Xác nhận không sửa assertion để né lỗi, không thêm fixture/data vào runtime bundle, không đụng T08 hay các module ngoài scope.
