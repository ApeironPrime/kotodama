# T07 — Tích hợp, hiệu năng, accessibility và release gate

## Phụ thuộc

T01–T06 đều phải được `ACCEPTED`.

## Việc cần làm

1. Đối chiếu data import với audit: count theo course/level, sample provenance và record reject.
2. Chạy regression API, frontend, build, responsive audit. Thêm test cho public pages khi phiên hết hạn: Từ điển/JLPT không bị đá sang Login.
3. Performance: catalog initial chỉ lấy metadata + page đầu, unit terms paginated; ghi kích thước bundle before/after và không tăng đáng kể initial JS vì data.
4. Accessibility: tab semantics, focus visible, contrast, reduced motion cho sketch/animation, screen-reader labels.
5. Viết `docs/plans/vocabulary-curriculum/release-report.md` có evidence và known limitations.

## Kết quả nghiệm thu thực tế

- **Trạng thái**: Hoàn tất đợt kiểm thử và release gate (`READY FOR FINAL ACCEPTANCE`).
- **Nội dung hoàn thành**:
  1. **Đối chiếu dữ liệu import với audit**:
     - Khớp 100% 9.411 raw records đầu vào từ `all_vocabulary_master.json`.
     - 1 record rác bị loại bỏ: `(ミルク)` (index 1775, trống cả reading và meaning).
     - 9.410 record hợp lệ được chuẩn hóa thành 8.616 canonical terms, 9.410 `course_terms`, 19 khóa học, 268 bài học.
     - Sample provenance ghi nhận đầy đủ trong `provenance.csv` với 100% trạng thái `unknown`.
  2. **Regression & Test Public Pages khi phiên hết hạn**:
     - Bổ sung 2 test trong `src/App.test.tsx` xác nhận khi `sessionExpired: true`, người học truy cập `/tra-tu` (Từ điển) và `/jlpt` (Luyện thi JLPT) hoàn toàn không bị chuyển hướng sang `/dang-nhap`.
     - Toàn bộ 63 tests Vitest frontend pass 100%.
  3. **Hiệu năng & Kích thước Bundle**:
     - Chunk `VocabularyPage`: 29.98 kB (nén gzip: 8.64 kB). Baseline trước T07 không được thu thập định lượng (VocabularyPage trước T05 là placeholder tĩnh).
     - Chunk CSS: 177.76 kB (nén gzip: 29.00 kB).
     - Dữ liệu hoàn toàn nằm ở backend API, không có master JSON hay file dữ liệu thô nào nằm trong client bundle.
  4. **Accessibility (a11y)**:
     - Chuẩn hóa tab semantics: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`.
     - Bộ chọn `:focus-visible` với outline rõ nét (`outline: 2px solid var(--color-accent)`) trên mọi thành phần tương tác.
     - Hỗ trợ `@media (prefers-reduced-motion: reduce)` vô hiệu hóa sketch transforms và animation lật thẻ.
     - Nhãn screen-reader (`aria-label`, `aria-hidden`) đầy đủ.
  5. **Báo cáo Phát Hành Release Gate**:
     - Lập báo cáo đầy đủ tại [`docs/plans/vocabulary-curriculum/release-report.md`](file:///d:/Project/kotodama/docs/plans/vocabulary-curriculum/release-report.md).
- **Kiểm thử tự động**:
  - `npm test`: **63 / 63 passed**.
  - `node --test scripts/curriculum/*.test.mjs`: **53 / 53 passed**.
  - `npm run typecheck`: **0 lỗi**.
  - `npm run lint`: **0 lỗi, 0 cảnh báo** (quét sạch 203 files bằng `oxlint`).
  - `npm run build`: **Thành công** (26 assets được hash).


