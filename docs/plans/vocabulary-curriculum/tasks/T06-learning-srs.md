# T06 — Unit learning, thẻ từ và SRS

## Phụ thuộc

T04 và T05 phải được `ACCEPTED`.

## Việc cần làm

1. Khi chọn course → unit, hiện danh sách terms phân trang; search chỉ trong course/unit đang chọn.
2. Mở term bằng detail dictionary hiện có (không tạo bản nghĩa thứ hai không đồng bộ).
3. Lưu SRS sử dụng API hiện có; idempotent theo user + term + source context.
4. Hiện tiến độ thật: số term đã lưu/đã học theo unit/course, không render số liệu mẫu.

## Ràng buộc

- Flashcard/quiz là progressive enhancement, không chặn người dùng đọc list.
- Không đánh dấu “đã thuộc” chỉ vì đã mở card; cần user action rõ ràng.
- Accessibility: điều khiển bằng bàn phím, không bắt Space nếu focus trong input, speech optional phải fail-safe.
- Không làm audio download/AI call ở initial load.

## Acceptance

- E2E: browse → unit → term → add SRS → refresh → trạng thái vẫn đúng.
- Người chưa đăng nhập vẫn browse được; thao tác lưu có thông báo đăng nhập rõ ràng.
- Test không tạo card trùng, không ghi nhận tiến độ khi request fail.

## Kết quả nghiệm thu thực tế

- **Trạng thái**: Hoàn tất đợt sửa đổi bắt buộc (`READY FOR FINAL ACCEPTANCE`).
- **5 Sửa đổi cốt lõi đáp ứng phản hồi kiểm thử thực tế**:
  1. **Server-side pagination & in-unit search**:
     - `VocabularyPage` gọi `fetchUnitTerms(selectedCourseCode, selectedUnitKey, { page: unitPage, limit: 20, q: unitSearchQuery })`.
     - `queryKey` theo dõi chặt chẽ `[selectedCourseCode, selectedUnitKey, unitPage, unitSearchQuery]`.
     - Tìm kiếm gửi trực tiếp `q` lên backend, reset `page = 1`, phân trang tính toán từ `pagination.total` và `totalPages` của API.
     - Flashcard mode hỗ trợ duyệt qua các trang (không âm thầm bỏ sót từ sau item 100), nút trước/sau tự động chuyển trang khi đến biên.
  2. **Idempotency theo "User + Term + Source Context"**:
     - Tạo migration `009_srs_source_context.sql` bổ sung `course_code`, `unit_id`, `term_id`, `source_record_id`, `source_context` với ràng buộc duy nhất `unique (user_id, type, term, source_context)`.
     - Legacy cards không có context có `source_context = ''`, đảm bảo 100% backward compatibility.
     - Hai bài học khác nhau có cùng từ bề mặt (ví dụ '私') tạo thành 2 thẻ tách biệt trong kho SRS mà không ghi đè nhau.
     - Thao tác lưu lại cùng context là idempotent (cập nhật metadata, bảo toàn SM-2 progress `repetition`, `masteryPercentage`, `intervalDays`).
     - Tích hợp test backend độc lập `scripts/curriculum/srs-idempotency.test.mjs` kiểm chứng đầy đủ 5 kịch bản.
  3. **Cách ly tuyệt đối Source-Context trên UI và State**:
     - Với curriculum term có `sourceContext`: chỉ dùng exact key `savedSrs[item.sourceContext]`. Tuyệt đối không fallback theo `item.word`, `vocab_term_word`, hay `vocab_id` để hiển thị trạng thái hay tính tiến độ.
     - Helper tách bạch `isCurriculumTermSaved(item)`: chỉ fallback sang `term` đối với SRS legacy không có `sourceContext`.
     - Áp dụng đồng bộ cho cả Word List, Flashcard (`isCurrentCardSaved`) và Dictionary modal (`activeDictCurriculumWord`).
     - Không thêm generic term keys vào `savedSrs` đối với entry đã có `sourceContext`.
     - `savedCountInUnit` chỉ đếm exact context thuộc đúng unit (`startsWith(unitContextPrefix)`); không fallback sang từ bề mặt hiện tại nếu chưa có thẻ trong unit.
  4. **Bảo vệ người dùng ẩn danh (Zero Anonymous SRS Calls)**:
     - Query `fetchSavedTerms` thiết lập `enabled: Boolean(user)`. Khi đăng xuất hoặc khách vãng lai, state `savedSrs` được xóa rỗng và query hoàn toàn không kích hoạt (tránh 401).
     - Bấm `+ Thêm SRS` hiển thị banner yêu cầu đăng nhập, không gọi API `addCard`.
  5. **Tiến độ thật, Bộ test dữ liệu lớn (>100 terms) & Test Regression Context Isolation**:
     - Mẫu số tiến độ unit là tổng `term_count` của unit từ course detail (hoặc `pagination.total`), không dùng độ dài trang 20 mục.
     - Bổ sung bộ test fixture 121 terms kiểm chứng trang 6 hiển thị từ #101+, tìm kiếm tìm thấy từ #105, mẫu số tiến độ hiển thị chính xác `0 / 121 từ đã lưu (0%)`.
     - Bổ sung test regression: Người dùng đã lưu '私' ở Context A (Minna N5 Bài 1); khi mở Context B (Soumatome N3 Tuần 1) cũng có '私': Context B hiển thị "+ Thêm SRS", tiến độ B = 0, flashcard hiển thị "Lưu vào SRS Flashcard"; sau khi lưu Context B, Context B chuyển thành "Đã lưu", tiến độ B = 100%, 2 card hoàn toàn tách biệt.
- **Kiểm thử tự động**:
  - `npm test` (vitest): 61/61 tests pass (trong đó `vocabulary.test.tsx` 19/19 tests pass).
  - Backend tests `node --test scripts/curriculum/*.test.mjs`: 53/53 tests pass.
  - Typecheck: `npm run typecheck` 0 lỗi.
  - Linter: `npx oxlint` 0 lỗi.
  - Build: `npm run build` thành công, hash 26 production assets.


