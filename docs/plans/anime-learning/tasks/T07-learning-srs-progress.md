# T07 — Tra từ tại phụ đề, SRS và tiến độ xem

## Mục tiêu

Thêm lớp học lên T06: bấm token Nhật để xem nghĩa, lưu từ hoặc câu phụ đề vào SRS có provenance, và tiếp tục đúng vị trí xem cho user đã đăng nhập. Không làm AI, dịch máy, scrape, deploy hay T08.

## Phạm vi và ràng buộc

- T01–T06 đã duyệt. Không hồi quy catalog, policy quyền, player fail-closed, subtitle windowing, offset hoặc PiP.
- Chỉ sửa trong `D:\Project\kotodama`. `D:\Project\data\aanime_scraper` chỉ đọc và không vào bundle/output.
- Data crawl phần lớn `rights_status=unknown`; local-owner override là policy server T04. UI không thêm header/query/toggle bypass hay fallback data.
- T07 được thêm API Anime cho progress vì bảng `anime_watch_progress` đã có. Không migration/schema mới nếu bảng đủ; nếu không đủ phải báo blocker.
- Tận dụng `POST /api/v1/srs/add`, không tạo SRS service thứ hai hay sửa SM-2/trang SRS.
- Không commit, deploy, release gate, analytics/telemetry bên thứ ba, reset hoặc format repo.

## Quyền và bảo mật

1. T04 server quyết định quyền đọc Anime. Chỉ dùng dictionary/cue/player API đã trả hợp lệ; không bypass `ANIME_CONTENT_RESTRICTED`.
2. API progress phải auth user, rồi xác nhận episode readable theo Anime policy trước read/write. Không trả progress/metadata/cue/media URL episode bị 403.
3. Không gửi stream URL, URL player, full subtitle, full shard dictionary, token list toàn tập hay user data tới bên thứ ba. Không AI/translation provider.
4. Cấm `dangerouslySetInnerHTML`; validate server-side mọi ID/query/body, URL encode và giới hạn body.
5. SRS/progress cần login. Guest chỉ thấy CTA; không localStorage fake saved state/optimistic persistence.

## API contract

Mọi request client qua `src/lib/apiClient.ts` + adapter typed `src/features/anime/`; component không gọi fetch/axios trực tiếp.

### API có sẵn

- `GET /api/v1/anime/dictionary/:wordId`: chỉ cho positive integer word_id; client không tải/tính shard.
- `GET /api/v1/dictionary/search?keyword=&limit=`: chỉ fallback khi token không word_id hoặc Anime dictionary 404 `WORD_NOT_FOUND`; keyword trim/validate, limit tối đa 5, không token rỗng/control character.
- `POST /api/v1/srs/add`: chỉ sau click lưu bởi user login; unique `(user_id,type,term,source_context)` hiện có phải trả/hiện `Đã có trong SRS` cho context trùng.

### API T07 phải bổ sung: progress

- `GET /api/v1/anime/progress?episodeId=<canonical-id>`: chỉ progress current user, `data:null` khi chưa có.
- `POST /api/v1/anime/progress`, body chính xác `{ episodeId, position, duration }`.
  - episodeId qua sanitizer T04; position/duration finite number >=0, reject string/NaN/Infinity/negative; clamp position `[0,duration]` nếu duration >0.
  - Atomic upsert `(user_id,episode_id)`; max position không giảm; last position là vị trí mới; completed chỉ duration>0 và >=90%; playback_count chỉ tăng lúc bắt đầu phiên phát, không heartbeat.
- `GET /api/v1/anime/progress/continue`: tối đa 10 current-user item, newest first, chỉ episode còn readable và chỉ metadata cần cho “Xem tiếp”.

Không bulk progress/full history/analytics/client-supplied userId. Query parameterized với SQLite/PostgreSQL parity; không fallback production DB sang local file.

## Provenance SRS

`sourceContext` deterministic/versioned, không chứa URL hoặc raw subtitle file:

    anime:v1:episode:<episodeId>:cue:<cueId>:token:<wordId-or-surface>
    anime:v1:episode:<episodeId>:cue:<cueId>:sentence

- Card từ `type:'vocab'`: term dictionary word/surface, reading, hanViet, nghĩa an toàn, JLPT nếu API trả; không copy full examples/related words.
- Card câu `type:'vocab'`: term `ja_text`, meaning `vi_text` khi cue có; không gọi dịch máy nếu thiếu Việt.
- sourceRecordId là word_id hoặc cue ID. Không bịa courseCode/unitId, không gửi userId/media URL/token array vào SRS.

## UX/UI

### Token/dictionary

- Chỉ token surface thực, cue hiển thị được focus/click; token không word_id có fallback search.
- Click token mở popover desktop/bottom sheet mobile. Escape/click-outside đóng, focus về token; không che player controls/active subtitle.
- Loading chỉ trong popover. Anime 404 fallback một lần; lỗi khác có Retry, không auto/infinite retry.
- Hiển thị word, reading, Hán Việt, loại từ, JLPT, nghĩa Việt, cue Nhật–Việt/timecode context. Field thiếu ẩn/“Chưa có dữ liệu”, không bịa.
- LRU memory-only tối đa 50 entry wordId/normalized surface. Không localStorage/cache error/403 lâu.
- Token là button/semantics tương đương, accessible name `surface — Tra nghĩa`, không button lồng button.

### SRS

- Popover có `Lưu từ vào SRS`; context cue có `Lưu câu vào SRS`. Không auto-save khi click token/play/seek.
- Guest CTA `Đăng nhập để lưu vào SRS`, không POST. User: pending state, chặn double click, success/error aria-live.
- Duplicate sourceContext hiển thị `Đã lưu trong SRS`; không toast rerender; giữ popup mở sau save và không redirect.

### Progress/resume

- User vào episode fetch progress đúng một lần sau detail/player permitted. Prompt chỉ khi position >5s, chưa completed: `Tiếp tục từ mm:ss?` với Tiếp tục/Xem từ đầu; không auto seek.
- Xem từ đầu seek 0, chỉ ghi khi player play/heartbeat tiếp theo.
- Debounce chỉ player playing và tiến >=5s hoặc tối đa 30s; flush một lần pause, ended, pagehide/visibility hidden, unmount nếu dirty. Không POST mỗi timeupdate/block navigation/retry vô hạn.
- Complete >=90% cùng duration>0; duration 0/unknown không complete. Playback count không tăng seek/visibility/resume prompt.
- “Xem tiếp” tối đa 10 item có skeleton/empty/error/link `?series=&episode=` đúng; guest không leak history user khác.

## Kiến trúc

- Client: mở rộng `AnimeLearningSession`, `SubtitleOverlay`/`SubtitleTranscript`; thêm component nhỏ `AnimeWordPopover`, `AnimeSrsActions`, `AnimeResumePrompt`, `AnimeContinueWatching` và typed API/types.
- Server: mở rộng Anime service hoặc progress service DB boundary rõ ràng, register trong `server/index.mjs`; không SQL trong React/route handler khổng lồ.
- Tái dùng `anime_watch_progress` + indexes, test SQLite/PostgreSQL parity.
- `anime.css` chỉ semantic tokens từ `tokens.css`; không hard-code theme colors.

## Tests bắt buộc

### Client

1. wordId lookup một lần; LRU hit và eviction bounded.
2. no-wordId/Anime 404 fallback dictionary search một lần limit<=5; network/403 không fallback sai/retry vô hạn.
3. Popover loading/success/error, Escape/click-outside/focus return/keyboard, không unsafe HTML.
4. Guest không write; user save từ/câu provenance đúng; pending double click không duplicate; duplicate thành saved.
5. Resume fetch một lần/prompt đúng/continue seek đúng/start over không stale.
6. Progress threshold/30s/pause-ended-unmount-pagehide; không POST mỗi tick; duration unknown không complete; episode cũ không ghi sau đổi episode.
7. Continue watching đúng user, empty/error/link đúng; guest không leak.

### Server

1. Dictionary validation/shard boundary, không full shard.
2. Progress: 401 guest, 400 invalid, 403 restricted, user isolation, clamp, 89.9%/90%, atomic upsert/max/playback count.
3. Continue max 10/newest/exclude unauthorized/missing/no media URL-subtitle body/no other user row.
4. SRS Anime source-context idempotency: cùng context không duplicate, cue context khác hợp lệ.
5. Regression T04–T06 Anime policy/tests vẫn pass.

## Lệnh nghiệm thu tối thiểu

    npm run test:frontend
    npm run typecheck
    npx oxlint src/features/anime/ src/lib/apiClient.ts src/styles/anime.css src/styles/tokens.css server/
    npm run build
    node --test scripts/anime/*.test.mjs
    node --test server/*.test.mjs

## Bàn giao bắt buộc

1. File đổi + `git diff --stat`, giải thích file ngoài scope; không commit/deploy.
2. Output thực lệnh test/build/lint/typecheck và mọi warning.
3. HTTP evidence guest 401, progress user success, 403 restricted, SRS duplicate provenance, continue user isolation. Dùng fixture/test DB, không đổi quyền crawl thật.
4. QA 1440/mobile 390 light/dark: token popover, guest CTA, SRS saved, resume, continue và fail-closed error.
5. Số request phiên test chứng minh dictionary LRU bounded, subtitle windowing T06 giữ nguyên, progress không mỗi tick.
6. Xác nhận không AI/dịch máy, scrape/proxy/download video, full dictionary/subtitle bundle, migration không cần thiết, analytics hay T08.

Chỉ thực hiện T07. Kết thúc bằng báo cáo để người duyệt kiểm tra; không làm T08.
