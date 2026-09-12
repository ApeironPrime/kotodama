# T10 — Khắc phục UX Anime và độ tin cậy khi mở/phát tập

## Mức độ và mục tiêu

Đây là **hotfix bắt buộc sau T09**, không phải một vòng “polish” giao diện. Bản hiện tại có bốn lỗi nghiệm thu thấy được:

1. Nội dung Anime bị bó trong một cột hẹp, lãng phí hai bên màn hình desktop.
2. Ảnh poster dọc bị tái sử dụng sai làm backdrop/thumbnail cho từng tập, gây letterbox/crop rất xấu và làm người dùng tưởng đó là ảnh từ video.
3. Mở tập lần đầu thường rơi vào “Không thể tải tập phim”, nhưng bấm `Thử lại` thì thành công.
4. Nút `Học ngay`/phát cho cảm giác có thể phát nhưng không phát hoặc không có nguồn phát hợp lệ.

Kết quả cần đạt: Anime là một khu xem/học **rộng, nhất quán, thành thật về khả năng phát**, và một tập có dữ liệu hợp lệ phải mở được ngay ở lần click đầu tiên.

## Phạm vi được phép

- Có thể sửa các component, test và CSS Anime trong `src/features/anime/`, `src/styles/anime.css` và phần layout **chỉ được scope bởi `.anime-page`**.
- Có thể sửa tối thiểu `server/index.mjs`, `server/anime-catalog-service.mjs` hoặc test server Anime **chỉ khi** đã tái hiện và chứng minh chúng là nguyên nhân của lỗi request tập đầu tiên.
- Không thay API public/TypeScript contract, migration, schema, crawler/importer, data nguồn, host allowlist, policy bản quyền, `ANIME_LOCAL_UNAPPROVED_ACCESS`, SRS/progress/subtitle semantics hoặc bất kỳ feature nào ngoài Anime.
- Không tạo stream URL mới, không nhúng/crawl nguồn ngoài, không biến `external_page` hay `unknown/restricted` thành video playable. Một nguồn không được cấp quyền phải được nói rõ, không được giả vờ là player hỏng.

## A. Layout full-width có kiểm soát

1. Trên desktop Anime dùng canvas rộng riêng, không bị kẹt ở độ rộng nội dung cũ:
   - desktop >= 1280px: nội dung Anime tối đa khoảng `1600px`, margin ngang tối đa `24px` mỗi bên (hoặc tương đương), vẫn nằm dưới TopNav;
   - 768–1279px: gutter 24px;
   - <= 767px: gutter 16px, không horizontal scroll trang.
2. Không đổi width/layout của Trang chủ, Từ điển, SRS, JLPT hay Video AI. Không sửa global `.page-shell` theo cách làm các trang khác bị tràn.
3. Hero catalog, catalog grid, series hub, learning session tận dụng chiều ngang mới theo thứ bậc rõ ràng; không có vùng đen/rỗng lớn chỉ để bù cho poster dọc.

## B. Quy tắc ảnh: không dùng poster dọc giả làm ảnh video

1. `poster_url` là artwork series, **không phải ảnh khung hình tập**. Không được dùng nó làm thumbnail của từng episode.
2. Series detail bỏ hẳn “poster-card” dọc độc lập. Dùng một hero ngang 16:9 (hoặc cinematic 21:9 nhưng responsive) với `poster_url` làm backdrop qua `object-fit: cover` + gradient. Nếu image source quá dọc hoặc không tải được, dùng placeholder graphic/surface ngang; không letterbox đen và không kéo méo ảnh.
3. Episode row chỉ hiển thị thumbnail 16:9 khi API đang thật sự cung cấp một **episode-specific thumbnail**. API hiện không có field này, nên mặc định row dùng số tập + icon/clapper + background semantic ngang; **không tái dùng poster series** và không tự tạo/capture ảnh video ở client.
4. Catalog card vẫn là landscape, fallback phải cùng tỉ lệ ngang. `onError` phải thay bằng placeholder có kích thước ổn định, không broken image icon hoặc content shift.
5. Không thêm URL ảnh/asset bên ngoài, không tạo data giả để “cho đẹp”.

## C. Sửa luồng chọn tập: lần đầu phải xác định được trạng thái

### C1. Tái hiện trước khi sửa

Trên môi trường local đã có data loopback, chọn tối thiểu 3 tập ở 2 series khác nhau bằng click thật trên browser. Ghi lại cho mỗi lần mở đầu tiên:

- URL sau click;
- request `GET /api/v1/anime/episodes/:episodeId`, status và response code (nếu lỗi);
- request subtitle/progress phát sinh tiếp theo;
- console error nếu có.

Không được kết luận đây là “React lag” hay che lỗi bằng auto-retry trước khi có evidence.

### C2. Điều kiện sửa bắt buộc

1. Click `Học ngay`/episode row phải cập nhật route đúng và mở session của chính `episode_id` đã chọn.
2. Lần request mở tập đầu tiên không được bị hủy/ghi đè bởi request stale, React Strict Mode, thay đổi auth status hay state của request khác. Tách request identity/abort lifecycle cho episode detail, subtitle và progress nếu nguyên nhân nằm ở client; không dùng một counter chung khiến request hợp lệ bị bỏ qua.
3. `Thử lại` chỉ xuất hiện cho lỗi mạng/5xx thực sự. Không được dùng retry để bù cho initialization race. Nếu error UI hiển thị, nó phải giữ status/code an toàn để developer chẩn đoán, nhưng không lộ URL stream, secret hay raw source.
4. Sau khi một request detail thành công, session không được trở lại loading/error vì request cũ kết thúc muộn.
5. Xóa copy stale: không còn thông báo “Trình phát phụ đề sẽ có ở bước tiếp theo (T06)”. Sau click, hoặc chuyển thẳng vào session, hoặc status nói đúng sự thật là “Đang mở tập …”.

### C3. Khả năng phát và các nút điều khiển

1. Phân biệt rõ ba trường hợp từ dữ liệu thật, trước khi người dùng bấm controls:

   | Trạng thái nguồn | Hành vi đúng |
   | --- | --- |
   | `youtube`/`authorized_local`, `playback_allowed: true`, đủ ID/URL hợp lệ | Mở player và play/pause, seek, mute, volume, fullscreen phải hoạt động. |
   | Có tập nhưng `external_page`, `unavailable`, hoặc `playback_allowed: false` | Không hiển thị CTA/nút play đánh lừa. Hiển thị trạng thái “Chưa có nguồn phát được cấp phép” và vẫn cho dùng phụ đề/học chỉ khi endpoint phụ đề cho phép. |
   | 403 quyền nội dung | Fail closed như policy hiện có, giải thích ngắn và quay lại danh sách; không có retry/bypass. |

2. Không vô hiệu hóa một player playable bằng class/CSS overlay, `pointer-events`, z-index hay handler nuốt event. Button phải có accessible name và trạng thái disabled chỉ khi dữ liệu thật không cho phép.
3. Với native video, surfaced `onError` phải nói đây là media lỗi sau khi episode detail đã tải thành công; không được đánh đồng với “Không thể tải tập phim”. Với YouTube, vẫn fail closed khi embed bị chặn.
4. Không hứa rằng mọi anime scrape được đều phát được: chỉ video có quyền và source hợp lệ mới được phát. Mục tiêu là không còn nút chết và không còn lỗi giả ở lần click đầu.

## D. UI series/episode cụ thể

- Series hub: hero ngang, metadata nằm trong vùng hợp lý, danh sách tập full-width, compact. Không có poster dọc ở cột trái kèm khoảng trống mênh mông.
- Episode rows desktop là một hàng dày vừa đủ, căn trái: index, semantic thumbnail/placeholder ngang, title/badge, trạng thái phát/học ở phải. Không căn toàn bộ nội dung vào giữa một card rỗng.
- Không có thumbnail tập thì row không được chừa một ô đen khổng lồ; giữ layout text-first rõ ràng.
- Featured hero ở catalog không được nằm dưới error block hay bị card catalog che/hide. Nếu `Xem tiếp` cần auth và request fail/401, nó phải thu gọn im lặng hoặc báo riêng, không làm toàn catalog có vẻ broken.

## E. Test bắt buộc

### Frontend

Thêm/cập nhật test trong `src/features/anime/` để kiểm chứng:

1. Detail không render poster series như thumbnail cho mỗi episode; fallback row có tỉ lệ/semantic placeholder ngang.
2. Click/Enter/Space vào row có `episode_id` chuyển đúng URL và hiển thị `AnimeLearningSession` lần đầu, không cần click retry.
3. Deferred/stale request: request cũ reject sau request mới resolve không được ghi đè session success; đổi episode nhanh cũng không hiển thị nhầm tập.
4. Từng media capability state ở bảng C3 render CTA/disabled/error đúng; player control events gọi đúng player capability khi permitted.
5. Continue-watching fail không che catalog/featured hero và không cần bấm retry để catalog usable.
6. Responsive DOM/class assertions cho desktop/mobile, zero broken image fallback.

### Server (nếu và chỉ nếu có backend root cause)

- Contract test HTTP gọi `episode detail` lặp lại lần đầu với episode thật/fixture được cấp local, đảm bảo 200 ổn định và đúng `episode_id`.
- Test 403 và `playback_allowed` không regression policy.

## F. QA bắt buộc, không tự xác nhận nếu chưa làm

1. Chạy API với data local hợp lệ và chỉ override loopback hiện có; không sửa database cho đẹp.
2. Browser QA desktop 1440px và mobile 390px, có ảnh chụp:
   - catalog full-width với gutters mới;
   - series detail không poster dọc/blank gap;
   - episode row không có thumbnail video (semantic fallback đúng);
   - click lần đầu vào một episode playable; nếu dataset không có playable source, chụp trạng thái honest/unavailable thay vì bịa playback;
   - một case thật cho error network/5xx có retry, để chứng minh retry vẫn hoạt động đúng chỗ.
3. Ghi rõ episode IDs/status code dùng trong QA và whether data thật có bất kỳ `playback_allowed: true` nào. Nếu không có, **không được báo “video chạy”**.

## Gate lệnh bắt buộc

```powershell
npm run test:frontend
npm run typecheck
npx oxlint src/features/anime/ src/styles/anime.css
npm run build
node --test scripts/anime/*.test.mjs
node --test server/*.test.mjs
git diff --check
git diff --stat
```

## Cấm làm

- Không commit/push/deploy.
- Không `git checkout`, `git reset`, `git clean`, `git stash`, không sửa/ghi đè thay đổi ngoài phạm vi.
- Không thêm auto-retry vô hạn, timer “đợi rồi load lại”, mock data production, client bypass quyền hoặc allowlist mới.
- Không bắt đầu T11/T12 hay redesign feature ngoài phạm vi.

## Bàn giao

1. Root cause evidence của lỗi first-open, file/line đã sửa và lý do.
2. Mapping trước → sau cho container width, series hero, episode thumbnail/row, CTA media.
3. Output nguyên văn mọi gate command.
4. Ảnh QA desktop/mobile và network evidence đã nêu.
5. Liệt kê số episode playable thật tìm thấy; nếu bằng 0, xác nhận UI không hứa phát được video và nêu state người dùng sẽ thấy.
