# T06 — Player hợp lệ và phụ đề tương tác

## Mục tiêu

Biến một tập đã được chọn ở T05 thành một phiên học có thể sử dụng: chỉ phát **nguồn mà API đánh dấu hợp lệ**, đồng bộ phụ đề Nhật–Việt theo thời gian phát, cho phép chọn cue để tua chính xác và bật/tắt lớp hiển thị. Đây chưa phải là tính năng tra từ, lưu SRS, lịch sử xem hoặc resume; các phần đó thuộc T07.

## Điều kiện bắt đầu và phạm vi

- T01–T05 đã được duyệt. Giữ nguyên catalog, URL state và episode picker của T05.
- Chỉ làm trong `D:\Project\kotodama`. Không đọc, ghi, sửa hoặc di chuyển bất kỳ tệp nào trong `D:\Project\data\aanime_scraper`.
- Dữ liệu nguồn hiện phần lớn có `rights_status=unknown`. API public sẽ trả 403/empty theo policy; local-owner override là việc của server T04 và **UI không được tự bật, truyền header/query bypass, hay làm fallback data**.
- Không thay đổi schema, migration, importer, policy quyền, URL allowlist, CORS, cache policy, API server route hoặc data. Nếu endpoint T04 thiếu field bắt buộc thì dừng và báo rõ, không tự sửa T04 trong task này.
- Không đụng `Video AI`, SRS hiện có, dictionary feature hiện có, auth, curriculum hay các feature không thuộc Anime.

## API contract được phép dùng

Mọi request phải qua `src/lib/apiClient.ts` và adapter typed trong `src/features/anime/`; component không được gọi `fetch`/`axios` trực tiếp.

1. `GET /api/v1/anime/episodes/:episodeId`
   - Chỉ gọi sau khi URL có `episode` hợp lệ do người dùng chọn.
   - Dùng `media_source`, `subtitle_track`, metadata tập và `playback_allowed` API trả về.
2. `GET /api/v1/anime/episodes/:episodeId/subtitles?from=&to=&lang=all`
   - Cửa sổ tối đa 600 giây; API mặc định 120 giây khi thiếu `to`.
   - Client chỉ dùng `lang=all` tại T06 để chuyển layer Nhật/Việt phía UI; không gọi lặp riêng từng ngôn ngữ.

Không gọi `/anime/dictionary/:wordId`, không gửi token/cue vào AI, không gọi endpoint SRS/progress và không tải JSON/SRT/VTT trực tiếp từ thư mục nguồn.

## Kiến trúc yêu cầu

- Tách rõ các phần trong `src/features/anime/` (tên có thể thay đổi, trách nhiệm không đổi):
  - `AnimeLearningSession`/route container: đọc `episode` từ URL, tải episode detail, điều phối cleanup.
  - `AnimePlayer`: adapter media, chỉ nhận normalized permitted source và callbacks `onTimeUpdate`, `onDurationChange`, `onSeeked`, `onPlaybackStateChange`, `onError`.
  - `SubtitleEngine`/hook: cửa sổ cue, active cue, prefetch và offset cá nhân.
  - `SubtitleOverlay` và `SubtitleTranscript`: render và thao tác cue, không nhúng business/API logic.
  - `animePlaybackTypes.ts` và `animePlaybackApi.ts`: type/API boundary đầy đủ.
- Có thể dùng native `<video>` cho `authorized_local` **chỉ khi** API trả `playback_allowed: true` và `page_url` an toàn. YouTube dùng iframe/API chính thức; không scrape, không resolve stream URL, không dùng package/download tool để trích link phát.
- Thêm dependency chỉ khi thật sự cần. Nếu thêm, nêu license, phiên bản cố định trong lockfile và lý do; ưu tiên native browser API + wrapper nhỏ để giảm bundle.
- Dùng `src/styles/anime.css` và design tokens hiện có. Không hard-code màu theme, không dùng inline style để dựng layout, không nhét CSS global phá trang khác.

## Chính sách phát và an toàn (bắt buộc, fail closed)

1. Chỉ mount player khi đồng thời thỏa:
   - response episode detail thành công;
   - `media_source` tồn tại;
   - `media_source.playback_allowed === true`;
   - `source_type` là chính xác `youtube` hoặc `authorized_local`;
   - với YouTube, `media_id` là ID API trả về hợp lệ; không suy luận từ URL;
   - với authorized-local, `page_url` API trả về khác rỗng và được dùng như URL media, không tự ghép đường dẫn.
2. `external_page`, `unavailable`, source lạ, thiếu `media_id/page_url`, 403, malformed response hoặc player error: không render iframe/video. Hiển thị trạng thái tiếng Việt trung thực, giữ metadata an toàn nếu API đã cho phép, có nút quay lại chọn tập.
3. Không hiển thị URL nguồn thô, `stream_url`, link Akaiwa, download button, open-redirect link hoặc nút “lách phát”. Không autoplay và không bắt đầu audio khi tải route.
4. Không truyền subtitle, token hay URL media cho bên thứ ba ngoài provider player được API cho phép. Iframe YouTube phải có `title`, `referrerPolicy` phù hợp, `allow` tối thiểu cần thiết và không có quyền thừa (camera/microphone/popups/downloads).
5. Không dựa vào client để phân quyền. API 403 phải fail closed: bỏ player/cues cache của tập cũ, không retry vô hạn, không hiển thị stale subtitle.

## UX/UI bắt buộc

### Phiên học và URL state

- Khi có `episode=<id>` từ T05, hiển thị learning panel trong `/anime`, không tạo route mới nếu không cần. URL hiện hữu (`q`, `level`, `genre`, `page`, `series`, `episode`) phải được giữ nguyên.
- Có breadcrumb/nút “Quay lại danh sách tập”; thao tác này chỉ bỏ `episode`, không làm mất series/filter.
- Header phiên học hiển thị tên series, mùa, số tập/tên tập và badge `Có phụ đề` khi API xác nhận. Không suy đoán trình độ/quyền phát.
- Loading dùng skeleton riêng cho player và panel phụ đề, không che toàn trang. Loading/error/permission status dùng `aria-live="polite"`.

### Player

- Player có vùng tỷ lệ ổn định 16:9 (hoặc ratio provider trả về), poster/placeholder khi chưa sẵn sàng để tránh CLS.
- Controls tối thiểu: play/pause, seek, current time/duration, mute/volume khi provider hỗ trợ, fullscreen và Picture-in-Picture cho native video khi browser hỗ trợ. Với YouTube chỉ hiển thị những control API có thể điều khiển đúng; không giả vờ hỗ trợ PiP/native fullscreen.
- Keyboard: Space/K play-pause khi focus nằm trong player và không ở input/button khác; Left/Right seek ±5 giây; M mute; F fullscreen nếu hỗ trợ. Có tooltip/nhãn tiếng Việt để người dùng khám phá; không hijack phím khi focus ở ô tìm kiếm/filter.
- Buffering, provider block/embed disabled, network error, duration unknown và media không playable đều có message rõ ràng, không spinner vĩnh viễn.
- Không tạo polling interval. `timeupdate`/provider event phải được throttle bằng `requestAnimationFrame` hoặc chỉ cập nhật khi cue/state đổi; cleanup toàn bộ event listener, rAF, timeout và player instance khi đổi tập/unmount.

### Subtitle engine

- Sau khi episode detail thành công và có `subtitle_track`, tải cửa sổ đầu tiên `[0,120]` bằng `lang=all`; không tải nguyên transcript/cue toàn tập.
- Khi thời gian phát tiến gần cuối cửa sổ (mốc 20–30 giây trước `to`), prefetch cửa sổ kế tiếp. Các request phải có AbortController hoặc request-id để response tập cũ không thể ghi vào tập mới; mỗi cửa sổ chỉ request một lần khi chưa invalidated.
- Tôn trọng max 600 giây API. Deduplicate cue overlap tại ranh giới cửa sổ bằng `track_id + cue_id` (hoặc ID canonical API), giữ thứ tự `start_time`, sau đó dùng binary search/two-pointer để tìm active cue; không `find/filter` toàn list trên từng frame.
- Overlay mặc định bật Nhật và Việt. Có control độc lập `Nhật`, `Việt`, `Furigana` (furigana chỉ hiện khi payload/API có dữ liệu hỗ trợ; nếu chưa có, control disabled kèm giải thích, không tự tạo cách đọc). Không thay đổi dữ liệu source.
- Render active cue rõ ràng; cue không active vẫn phải có contrast đủ. Khi có cue overlap, hiển thị toàn bộ cue đang active theo thứ tự timestamp, không flicker.
- Transcript panel chỉ chứa cửa sổ đã tải + active context, virtualize/bounded list nếu cần. Click/Enter/Space một cue seek tới `start_time`; sau seek active cue đồng bộ lại. Không dùng cue text dưới dạng HTML (`dangerouslySetInnerHTML` cấm).
- Offset cá nhân: slider/input `-5.0` đến `+5.0` giây, bước `0.1`; chỉ ảnh hưởng mapping thời gian/cue client hiện tại, không gửi server, không ghi DB/source. Có nút reset. Có thể giữ trong session state; không được dùng nó như watch-progress.
- Nếu tập không có subtitle track/cues, player vẫn hoạt động nếu permitted; panel phải nói rõ “Tập này chưa có phụ đề tương tác”, không gọi lặp API.

### Responsive và accessibility

- Desktop >=1024: player + transcript có thể 2 cột; tablet/mobile xếp dọc, overlay không che controls; không horizontal overflow ở 390px.
- Control bấm tối thiểu 44×44px trên mobile, focus ring theo token hiện có, tab order hợp lý.
- Player/overlay có labels tiếng Việt; trạng thái active cue được screen reader thông báo có tiết chế (không announce mỗi frame). Transcript dùng semantics danh sách và `aria-current`/tương đương cho cue active.
- QA 390, 768, 1024, 1440 px; light, dark và custom theme nếu app đã hỗ trợ.

## Không được làm

- Không tra nghĩa từng token, popup dictionary, highlight/đánh dấu từ học, lưu từ/câu, SRS card, watch history, resume progress hay analytics học tập (T07).
- Không scrape/crawl/download/decrypt video, lấy YouTube stream URL, tạo proxy media, bypass paywall, embed trang `external_page`, autoplay hay đưa dữ liệu chưa approved ra public.
- Không thêm mock series/cue hoặc fallback production để che 403/API rỗng.
- Không preload cả playlist/tập/tất cả subtitles; không gửi mỗi `currentTime` một request.
- Không sửa ngoài scope, reset/format toàn repo, commit hay deploy.

## Tests bắt buộc

Thêm test React/unit tại `src/features/anime/` và mock tại API boundary. Test không được phụ thuộc mạng/YouTube thật.

1. Với YouTube hợp lệ và `playback_allowed=true`, mount adapter đúng ID; không autoplay. Với `authorized_local`, render native video đúng URL API trả về.
2. `external_page`, `unavailable`, missing/invalid source, `playback_allowed=false`, 403 và player error: không tạo iframe/video, không rò media URL, có trạng thái fail-closed.
3. Episode URL state tải detail đúng một lần, back-to-episode-picker bỏ `episode` nhưng giữ `series`/filters; đổi tập hủy request/listener/cue cũ.
4. Subtitle API request đầu `[0,120]`; prefetch cửa sổ tiếp theo gần biên; không request lặp, dedupe cue overlap, response out-of-order/tập cũ bị bỏ.
5. Boundary tìm active cue: trước start, đúng start/end, overlap, khoảng trống, seek và offset âm/dương; xác nhận không scan toàn transcript mỗi tick (test utility binary-search/two-pointer riêng).
6. Toggle Nhật/Việt/Furigana, cue click/keyboard seek, disabled furigana khi unavailable, transcript active state và empty subtitles.
7. Cleanup rAF/event/timer/player khi unmount hoặc đổi episode; không state update sau unmount.
8. Accessibility cơ bản: player title, label controls, keyboard không hijack input, focus visible/cue semantics; responsive smoke ở mobile.

Chạy tối thiểu:

```powershell
npm run test:frontend
npm run typecheck
npx oxlint src/features/anime/ src/lib/apiClient.ts src/styles/anime.css
node --test scripts/anime/*.test.mjs
```

## Nghiệm thu bàn giao

Antigravity chỉ trả báo cáo sau khi hoàn thành toàn bộ những mục sau:

1. Liệt kê file sửa/thêm và `git diff --stat`; giải thích file nào ngoài scope nếu có.
2. Output đầy đủ của bốn lệnh test/lint/typecheck trên; nêu warning nếu tồn tại, không chỉ ghi “pass”.
3. Bằng chứng API/UI cho ba trạng thái: source playable hợp lệ, external/unavailable không nhúng player, và 403 fail-closed. Có thể dùng fixture/test local hợp lệ; không đổi `rights_status` của dữ liệu crawl thật chỉ để demo.
4. Ảnh QA desktop 1440 và mobile 390 ở light/dark: player permitted, subtitle overlay/transcript, unavailable/error state.
5. Đo/ghi nhận rằng chỉ tải subtitle theo window (đầu tiên 120s, prefetch có giới hạn), không tải toàn bộ file subtitle; xác nhận cleanup khi đổi tập.
6. Xác nhận T06 không thực hiện dictionary, SRS, progress/history, scrape, proxy/download video hoặc bypass quyền.

Chỉ thực hiện T06. Kết thúc bằng báo cáo để người duyệt kiểm tra; không làm T07.
