# T05 — Catalog Anime: UI duyệt series và chọn tập

## Mục tiêu

Thay trang placeholder `/anime` bằng catalog có thể sử dụng với dữ liệu từ API T04. Người dùng có thể tìm series, lọc theo JLPT/thể loại, xem chi tiết series và chọn một tập. Đây chỉ là **UI duyệt nội dung và chọn tập**; không được xây player, tải video, tải subtitle hay chức năng SRS trong task này.

## Phụ thuộc và phạm vi dữ liệu

- Phụ thuộc T04 đã được duyệt; chỉ gọi các endpoint API Anime đã có.
- API mặc định chỉ hiển thị series `approved`. Khi API trả catalog rỗng vì dữ liệu chưa được duyệt quyền, UI phải hiện trạng thái minh bạch nhưng **không** hiển thị tên, poster, số lượng hay metadata của series bị hạn chế.
- Local-owner override là chính sách server. UI không được tự thêm query/header/công tắc để bypass quyền. Nếu server local hợp lệ trả về dữ liệu, UI chỉ render response bình thường.
- Không thay đổi schema, migration, importer, quyền truy cập, API route hay dữ liệu trong `D:\Project\data\aanime_scraper`.

## API contract được phép dùng

Tất cả request phải đi qua `src/lib/apiClient.ts`; không gọi `fetch`/`axios` trực tiếp trong component.

1. `GET /api/v1/anime/catalog?q=&level=&genre=&page=&limit=`
   - Response `data.items[]`, `data.pagination`.
   - `limit` cố định phía client tối đa 24; không yêu cầu toàn bộ catalog.
2. `GET /api/v1/anime/series/:slug`
   - Chỉ gọi sau khi người dùng chọn một thẻ series.
3. `GET /api/v1/anime/series/:slug/episodes?page=&limit=`
   - Chỉ gọi sau khi detail series đã mở; mặc định 50, không vượt 100.

`GET /episodes/:id`, `/subtitles`, `/dictionary` dành cho T06/T07, không được gọi ở T05.

## Files và kiến trúc mong muốn

- Thay `src/features/anime/AnimePage.tsx`; tách component nhỏ trong `src/features/anime/` khi cần (ví dụ `AnimeCatalogFilters.tsx`, `AnimeSeriesCard.tsx`, `AnimeSeriesDetail.tsx`, `animeApi.ts`, `animeTypes.ts`).
- Thêm đường dẫn Anime vào `apiPaths` và hàm typed trong `src/lib/apiClient.ts` hoặc một adapter typed dùng `apiClient`.
- Cập nhật `src/styles/anime.css`, dùng toàn bộ CSS variables/design token đã có. Không hard-code màu theme, không dùng inline style để dựng layout.
- Có thể thêm/điều chỉnh test trong `src/features/anime/`; không sửa feature không liên quan.
- Giữ `TopNav` và route `/anime` hiện tại. Không đổi luồng Video AI.

## UX/UI bắt buộc

### Header và tìm kiếm

- Giữ `PageHeader` theo phong cách Kotodama: eyebrow `Kotodama Anime`, tiêu đề `Học tiếng Nhật qua Anime`, mô tả ngắn về học với phụ đề Nhật–Việt.
- Thanh tìm kiếm có icon Lucide `Search`, label cho screen reader, placeholder tiếng Việt và nút xóa chỉ hiện khi có nội dung.
- Debounce tìm kiếm 300–400 ms; hủy/bỏ qua response cũ để kết quả query cũ không ghi đè query mới.
- Không gửi request rỗng lặp lại nếu filter/query không đổi.

### Bộ lọc và URL state

- Bộ lọc JLPT: `Tất cả`, `N5`, `N4`, `N3`, `N2`, `N1`.
- Bộ lọc thể loại lấy từ catalog items đã tải trong session; có lựa chọn `Tất cả thể loại`. Nếu API không trả item, không tạo filter rỗng.
- Khi query, level, genre, catalog page hoặc series chọn thay đổi, đồng bộ vào query string của `/anime`: `?q=&level=&genre=&page=&series=`.
- Loại bỏ param rỗng/default khỏi URL. Back/forward phải khôi phục filter và series đang chọn. Query string phải được `URLSearchParams` xử lý.
- Đổi query/filter phải đưa pagination về trang 1 và đóng series detail cũ nếu series không còn trong kết quả.

### Catalog cards

- Desktop >= 1024: grid 3 cột; tablet 768–1023: 2 cột; mobile < 768: 1 cột.
- Mỗi card là một button/link keyboard-accessible, hiển thị: poster (nếu URL hợp lệ), tiêu đề Việt, tiêu đề Nhật nếu có, JLPT, thể loại, số mùa, số tập có phụ đề / tổng tập.
- Poster dùng `loading="lazy"`, kích thước/aspect-ratio ổn định để không CLS. `alt` mang tên series; khi URL hỏng, thay bằng khối placeholder có icon `Clapperboard`, không render broken-image UI.
- Không render `poster_url` vào CSS `url()` hay HTML nguy hiểm. Không tự tạo allowlist khác API; chỉ render string API bằng `<img>`.
- Không có nút hay wording “Phát”, “Xem phim”, iframe hoặc URL video trong thẻ/từng tập. T05 chỉ có hành động `Xem danh sách tập` / `Chọn tập`.

### Series detail và episode picker

- Khi `series` có trong URL, hiển thị panel detail ngay dưới filter/catalog (hoặc dialog/drawer có semantics hoàn chỉnh); yêu cầu phải đọc được bằng keyboard và mobile.
- Detail hiển thị: breadcrumb/nút quay về catalog, poster, tên Việt/Nhật, mô tả, JLPT, thể loại, nguồn mô tả, tổng mùa/tập.
- Danh sách mùa theo thứ tự `season_ordinal`; danh sách tập theo `episode_number`.
- Mỗi tập là button có số tập, title (nếu có), badge `Có phụ đề` / `Chưa có phụ đề`. Bấm tập chỉ cập nhật lựa chọn UI và URL `episode=<id>` hoặc hiện notice `Trình phát phụ đề sẽ có ở bước tiếp theo`; tuyệt đối không gọi episode detail/subtitle/video API.
- Không quảng cáo availability không có căn cứ: `playback_allowed`, link phát và media URL không thuộc contract hiển thị T05.

### Các trạng thái

- **Initial loading:** skeleton cards (không spinner toàn trang), chiều cao tương đương card thật.
- **Loading detail:** skeleton panel riêng, không xóa catalog phía sau.
- **Error:** thông điệp tiếng Việt, nút `Thử lại`, giữ nguyên query/filter để retry đúng request.
- **Empty search/filter:** `Không tìm thấy series phù hợp` và nút `Xóa bộ lọc`.
- **Catalog rỗng do quyền:** `Thư viện chưa có nội dung được cấp phép để hiển thị công khai.` Không nói hoặc suy luận số item bị chặn; không có nút bypass.
- Xử lý 403 detail: đóng/không render metadata stale, hiển thị thông báo nội dung chưa khả dụng và cập nhật URL bỏ `series`/`episode`.

## Accessibility và responsive

- Dùng phần tử semantic (`main`, `section`, heading theo cấp, `button`, `nav` phân trang); không biến `div` thành button.
- Focus visible theo token hiện có, thứ tự Tab hợp lý; Escape đóng detail/drawer nếu chọn dialog/drawer.
- Filter có label; card/tập có accessible name đầy đủ. Thông báo loading/error/empty dùng `aria-live="polite"` phù hợp.
- Không dùng emoji hệ điều hành; dùng Lucide icons có `aria-hidden` khi chỉ trang trí.
- QA tại viewport 390, 768, 1024 và 1440 px ở light, dark và custom theme; không overflow ngang, target bấm tối thiểu 44 px trên mobile.

## Hiệu năng và an toàn

- Không prefetch toàn bộ series detail/episode list và không tải poster ngoài viewport hàng loạt.
- Chỉ một catalog request cho một state hợp lệ; debounce search và chống race condition/AbortController hoặc cơ chế request-id tương đương.
- Không lưu catalog/detail vào localStorage. Cache trong memory của component chỉ được dùng nếu invalidation theo URL state rõ ràng.
- Không nới lỏng CORS, quyền T04, local-owner override, allowlist URL hay `Cache-Control`.
- Không render HTML từ `description`; render text React bình thường.

## Tests bắt buộc

Viết test React cho tối thiểu các tình huống sau, mock tại API boundary:

1. Render skeleton, sau đó render catalog cards từ response phân trang.
2. Debounced search gửi đúng `q`, level/genre và reset page về 1; response cũ không ghi đè response mới.
3. Lọc JLPT/thể loại, phân trang trước/sau và URL query state được giữ/khôi phục.
4. Click/Enter card gọi series detail + episode list đúng lúc; không có request episode detail, subtitle hay media.
5. Render episode badge `Có phụ đề`/`Chưa có phụ đề`; click tập không tạo player hoặc gọi video URL.
6. Empty search, catalog public rỗng, 403 detail, lỗi mạng và retry.
7. Keyboard/focus/card semantic cơ bản; alt poster và fallback khi ảnh lỗi.

## Không được làm

- Không player, iframe YouTube/Akaiwa, autoplay, subtitle timeline, token popup, dictionary lookup, SRS, watch progress/history. Những phần đó thuộc T06/T07.
- Không thay đổi dữ liệu quyền hoặc thêm series `approved` chỉ để UI có dữ liệu.
- Không dùng mock/fallback data trong production component để che API rỗng/lỗi.
- Không sửa các file ngoài scope, reset/format toàn repo, commit hay deploy.

## Nghiệm thu bàn giao

Antigravity phải trả lại:

1. Danh sách file đổi và `git diff --stat` (nêu rõ mọi file ngoài scope nếu có).
2. Lệnh và output: test feature Anime, `npm run typecheck`, lint liên quan.
3. Bằng chứng request: catalog public rỗng hiển thị đúng notice; local-owner chỉ render khi server trả data, không có bypass từ UI.
4. Ảnh QA `/anime` ở desktop 1440 và mobile 390, tối thiểu light + dark (custom theme nếu dự án có sẵn cách chuyển theme).
5. Xác nhận rõ T05 chưa gọi endpoint player/subtitle/dictionary và chưa thêm bất kỳ cơ chế phát video nào.

Chỉ thực hiện nội dung của task này. Kết thúc bằng báo cáo, không làm T06.
