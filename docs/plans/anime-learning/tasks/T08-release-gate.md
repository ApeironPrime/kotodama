# T08 — QA, hiệu năng, bảo mật và release gate Anime

## Mục tiêu

Thực hiện nghiệm thu phát hành cho toàn bộ luồng Anime T01–T07, sau khi R01 đã khôi phục regression NhaiKanji. T08 là task **xác minh và sửa lỗi tích hợp nhỏ có bằng chứng**; không làm tính năng mới, không scrape, không AI/dịch máy, không deploy.

Kết quả là một báo cáo release gate trung thực: nêu rõ pass, fail, skip, rủi ro còn lại và config cần cho production. Không được tự đánh dấu “ready” nếu còn P0/P1 hoặc bất kỳ gate bắt buộc nào fail.

## Phạm vi được phép

- Kiểm tra và sửa lỗi tích hợp trong `server/`, `src/features/anime/`, typed API Anime, CSS Anime, test/fixture Anime và release documentation liên quan trực tiếp.
- Được thêm test regression nhỏ, fixture test hoặc script đo đạc không phá hủy để chứng minh lỗi đã sửa.
- Phải giữ nguyên policy: crawl data `unknown/restricted` bị chặn ở public production; local-owner override chỉ server-side, loopback-only, không UI bypass.
- R01 NhaiKanji là regression chung: chỉ xác nhận gate của nó còn xanh; không refactor lại NhaiKanji trong T08 nếu không có lỗi do T08 gây ra.

## Cấm

- Không commit, push, deploy, tạo token/key, thay đổi quyền nội dung, hay bật production override.
- Không tải/proxy/nhúng/download video trái quyền, không scrape nguồn mới, không gửi subtitle/dictionary/user data cho bên thứ ba.
- Không thay quyền `unknown`/`restricted` thành approved/public chỉ để demo.
- Không làm T09/tính năng mới, redesign, analytics, cache persistent, migration/schema mới hoặc refactor ngoài scope.
- Không dùng `git checkout`, `git reset`, `git clean`, `git stash` hay ghi đè worktree có sẵn. Không làm yếu test, skip/only test, hoặc xóa assertion để có màu xanh.

## Ma trận nghiệm thu bắt buộc

### 1. Quyền nội dung và API

Kiểm chứng qua fixture/test server, không sửa data crawl thật:

1. Public catalog không lộ series `unknown/restricted`.
2. Detail/episodes/subtitles/progress của content bị hạn chế trả `403 ANIME_CONTENT_RESTRICTED`, không lộ media URL/cue/user progress.
3. Local override chỉ có tác dụng với loopback, không proxy header spoofing; remote vẫn fail-closed.
4. YouTube chỉ dùng ID hợp lệ/allowlist; `javascript:`, `data:`, `file:`, HTTP/private host/path traversal đều bị chặn.
5. `external_page` không bị coi là player hợp lệ; `stream_url` không lộ từ API.
6. Auth progress: guest 401, user isolation, maximum 10 continue items, không subtitle/media URL trong response.

### 2. Luồng học end-to-end

Dùng fixture approved/local-owner loopback phù hợp, không cần internet:

1. Catalog → series → episode → player permitted.
2. Subtitle window chỉ tải phạm vi thời gian cần thiết; Japanese/Vietnamese toggle vẫn hoạt động.
3. Token có `word_id` lookup một lần và LRU hit; no-word-id/404 fallback tìm tối đa 5 kết quả một lần; 403/network không fallback lặp.
4. Popover: loading/success/error/retry, Escape/click-outside/focus return; token Enter/Space không kích hoạt player shortcut.
5. Guest không POST SRS; CTA `/dang-nhap`. User lưu từ/câu có `sourceContext` deterministic; duplicate hiển thị saved.
6. Resume chỉ prompt khi >5s/chưa complete; Start over không ghi khi seek pause; playback progress debounce/flush/retry bounded; completed 90%.
7. Continue Watching empty/loading/error/success đúng user và link episode hợp lệ.

### 3. UI, responsive và accessibility

QA tối thiểu ở 1440px và 390px, light/dark nếu app hỗ trợ:

- Catalog, series, episode, player, transcript, popover/bottom sheet, resume prompt, SRS action và continue watching không overflow/đè player controls.
- Keyboard-only: Tab order rõ, focus visible, token button name `surface — Tra nghĩa`, Escape trả focus; không nested button.
- Không hard-code màu trong `src/styles/anime.css`; dùng token semantic.
- Không `dangerouslySetInnerHTML`; subtitle/dictionary hiển thị plain React text.

### 4. Hiệu năng và tải dữ liệu

- Catalog không eager load toàn bộ poster/143 series; phân trang/lazy image giữ nguyên.
- Không bundle full dictionary shard hay full subtitle; chỉ endpoint window/dictionary word/search.
- Chứng minh subtitle nhiều cue không tạo polling/request mỗi render và progress không POST mỗi `timeupdate`.
- Không thêm blocking synchronous work đáng kể vào initial page load. Nếu không có benchmark script, dùng network/request-count test và nêu giới hạn rõ ràng, không bịa con số.

### 5. Non-regression

- Từ điển, Từ vựng, SRS, JLPT, Video AI và R01 NhaiKanji regression vẫn xanh.
- Không thay đổi output/data/contract ngoài những lỗi tích hợp có evidence.

## Sửa lỗi trong T08

Chỉ sửa nếu test hoặc QA tái hiện được một lỗi P0/P1 trong phạm vi. Mỗi sửa phải có regression test. Nếu phát hiện thay đổi lớn, policy decision hoặc cần quyền mới: dừng, báo blocker thay vì tự mở rộng scope.

## Lệnh nghiệm thu bắt buộc

Chạy từ `D:\Project\kotodama` và gửi output thực tế:

```powershell
npm run test:frontend
npm run typecheck
npx oxlint src/features/anime/ src/lib/apiClient.ts src/styles/anime.css src/styles/tokens.css server/
npm run build
node --test scripts/anime/*.test.mjs
node --test server/*.test.mjs
git diff --check
git diff --stat
```

Hai test PostgreSQL có thể skip khi không có `DATABASE_URL`; phải liệt kê lý do skip, không được ghi là pass.

## Bàn giao bắt buộc

1. Bảng release gate gồm: hạng mục, evidence/test, trạng thái pass/fail/skip, rủi ro còn lại.
2. Danh sách file thay đổi, lý do và `git diff --stat`; xác nhận không chạm file ngoài scope.
3. Evidence HTTP/test cho 401 guest, 403 restricted, public catalog không leak, local override remote fail-closed, SRS duplicate và progress user isolation.
4. QA desktop/mobile và accessibility, kèm screenshot nếu có UI thay đổi; nếu không thể chạy browser, nêu rõ phần nào chỉ được covered bằng automated test.
5. Request-count/bundle evidence cho dictionary, subtitle windowing và progress debounce; không bịa benchmark.
6. Bảng config production cần thiết (không ghi secret), gồm policy Anime, allowed hosts, CSP/frame-src và nguồn data. Xác nhận T08 không deploy/bật content chưa duyệt.

Chỉ kết thúc bằng báo cáo để người duyệt quyết định release. Không thực hiện deploy.
