# T05 — UI catalog theo cấp độ, đồng bộ Kotodama

## Phụ thuộc

T04 phải được `ACCEPTED`.

## Phạm vi UX

Trong tab **Từ vựng** hiện có: hero “Học bản chất – không học vẹt”, sau đó nhóm A1/A2, N5, N4, N3, N2, N1, SE. Mỗi nhóm có heading/cấp độ và lưới course card; chọn card mở danh sách unit của chính course đó.

## Ràng buộc thiết kế

- Tham chiếu ảnh: giấy kem/lưới rất nhẹ, card viền sketch tinh tế, thẻ cấp độ lớn. Không copy ảnh/chữ/logo tham chiếu.
- Dùng token `--color-*`, `--font-*`, radius/spacing hiện có; không hard-code palette toàn trang. Accent cấp độ qua variables.
- Icon từ `lucide-react`, không emoji/icon Windows. Không dùng ảnh có bản quyền làm banner.
- Không tiếp tục hard-code `VOCAB_CATALOG`; mọi card/count lấy từ T04.
- Responsive: 1 cột mobile, 2 cột tablet/desktop; focus, keyboard tab, aria selected/expanded đầy đủ.

## Acceptance

- [x] Có loading/error/empty state không che thanh điều hướng; không request toàn bộ 9k từ ở initial load.
- [x] Ảnh kiểm tra 375px, 768px, 1440px; dark/custom color mode vẫn đọc được.
- [x] Test UI cho level filter, chọn card, loading/error và keyboard.

## Trạng thái thực hiện (2026-09-10)

- **Trạng thái:** `COMPLETED`
- **Frontend tests:** 50/50 passed (`src/features/vocabulary/vocabulary.test.tsx` 8/8 passed).
- **Backend tests:** 45/45 passed across 4 test suites.
- **TypeScript:** 0 lỗi (`tsc -b --pretty false`).
- **Linter:** 0 lỗi (`npx oxlint`).
- **Responsive & Visual Audit (Playwright Chrome):** 8/8 checks passed (100%), 0 lỗi tràn ngang trên mobile (375px), tablet (768px), desktop (1440px), chế độ sáng/tối và thông báo thẩm định rỗng.
- **Ảnh kiểm tra:** Lưu tại `docs/plans/vocabulary-curriculum/screenshots/` và brain artifact dir.


