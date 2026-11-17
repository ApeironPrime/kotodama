# Kotodama — kiểm chứng đợt sửa nền tảng, 17/11/2026

Đây là kết quả của đợt sửa đầu tiên sau audit đã hiệu chỉnh, không phải chứng nhận toàn bộ sản phẩm đã đạt chuẩn phát hành.

## Đã triển khai

- Bỏ từ vựng, ngữ pháp, phần trăm thành thạo và nút tóm tắt AI viết sẵn trong Video Study. Luyện nghe có thể ẩn/hiện gợi ý. Ghi chú và dấu trang lưu theo tài khoản/video trên thiết bị; giao diện nói rõ phạm vi này.
- Profile dùng số liệu SRS thật; bỏ các chỉ số bài học, thời gian và huy hiệu chưa có dữ liệu. Các khóa học đang chuẩn bị được ghi rõ trên trang chủ và trang khóa học.
- Khởi tạo theme trước render, đồng bộ tùy chọn tài khoản sau đăng nhập và giữa các component/tab. Dùng cùng bảng màu tại Settings; đồng bộ theme-color, color-scheme, input, badge, error text và placeholder.
- Modal dùng chung, sổ tay, từ điển, kho sách, chi tiết Kanji, flashcard và bộ chọn bài Anime có Escape/focus trap/focus restore. Tabs dùng chung có điều hướng bàn phím. Shadowing không chặn Tab/Enter trên điều khiển.
- Tất cả chỗ render rich HTML hiện có đi qua DOMPurify với danh sách thẻ định dạng/ruby cho phép.
- Dừng polling video ở ready/failed, không chạy request chồng nhau; có thông báo mất kết nối. Thu âm đo thời gian thực, dừng track khi đổi câu/unmount và giải phóng Blob URL.
- Phiên SRS kết thúc sau thẻ cuối; lưu thất bại giữ thẻ để thử lại. Có test riêng cho cả hai trường hợp.
- Anime tiến từng câu trong nhóm; gắn lại SubtitleOverlay; cập nhật React từ YouTube tối đa khoảng mỗi 150 ms; đồng bộ fullscreenchange. Lỗi SRS hiển thị được; đăng nhập từ Anime giữ URL quay lại.
- URL lưu tab/từ khóa Từ điển, giáo trình/bài Tủ sách, sách/bài Ngữ pháp và cấp độ/kỳ đề JLPT. Search API có debounce. Error/Retry được bổ sung tại các luồng tải quan trọng.
- Flashcard Ngữ pháp tách khỏi danh sách chi tiết; có bộ chọn mục lục mobile. Canvas tập viết có buffer HiDPI và quy đổi tọa độ. Graph Kanji ngừng lập lịch khi ổn định. Sumi-e có danh sách tĩnh khi Reduce Motion; Stroke Player không dùng private _options.
- Sửa dedupe video theo ID, trạng thái xử lý thất bại, ngưỡng mở rộng kệ sách, role listitem, timer WOTD, ngày quản trị không hợp lệ và ngữ nghĩa ô bảng. Giữ bút lông đã duyệt, trả grab/grabbing cho kệ sách.

## Bằng chứng

- Test FE: 172/172 qua, gồm hồi quy mới về HTML, theme, URL nhiều cập nhật, focus, nhóm câu, polling, ghi chú/dấu trang và cleanup microphone.
- TypeScript và production build qua; artifact checker xác nhận bundle hợp lệ.
- Oxlint không có lỗi. Cảnh báo Fast Refresh của danh sách WOTD xuất chung với component vẫn còn.
- Kiểm tra trình duyệt local: mở giáo trình Minna và bài 1 từ dữ liệu thật; URL giữ giáo trình/bài sau reload và Back; sổ tay nhận/trả focus và đóng bằng Escape. Ở viewport 375 px, trang bài học không tràn ngang; phát hiện và sửa placeholder tương phản quá thấp.

## Chưa được coi là hoàn tất

- Chưa đo contrast toàn bộ tổ hợp theme/trang và chưa chạy screen reader thực tế.
- Chưa nghiệm thu trọn hành trình đăng nhập → học → lưu → ôn → hồ sơ trên production sau đợt sửa này.
- Chưa hợp nhất toàn bộ CSS cũ hoặc xử lý mọi inline style/utility class rải rác. Chưa bỏ giới hạn tải track luyện Anime 7200 giây, chưa thay yêu cầu 3000 Kanji bằng chiến lược tải phù hợp với đồ thị.
- Chưa đo hiệu năng trên thiết bị yếu, toàn bộ tình huống offline và từng bố cục tablet/mobile. Không tuyên bố 0% CPU hoặc đạt WCAG toàn sản phẩm.

Các thay đổi backend, dữ liệu và tài liệu khác có sẵn trong working tree không thuộc đợt sửa này.
