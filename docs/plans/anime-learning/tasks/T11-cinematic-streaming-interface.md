# T11 — Giao diện Anime cinematic theo pattern dịch vụ streaming

## Điều kiện bắt đầu

T11 chỉ được làm **sau khi T10 đã pass**. Không thay thế T10: trước hết phải hết lỗi click tập lần đầu, nút chết, layout dọc sai và trạng thái nguồn phát mơ hồ.

## Mục tiêu

Đưa Anime của Kotodama tới cảm giác quen thuộc của các dịch vụ streaming hiện đại: màn hình rộng, hero điện ảnh, hàng nội dung rõ ràng, lựa chọn tập nhanh và player nổi bật. Đây là cảm hứng từ pattern phổ biến của ngành, **không phải bản sao Netflix**.

Không sao chép logo, tên, chữ/copy, icon riêng, artwork, asset, animation, typography, cấu trúc DOM/CSS, thứ tự layout hay màn hình 1:1 của Netflix hoặc bất kỳ dịch vụ nào. Kotodama phải có ngôn ngữ riêng: nền midnight-indigo, accent coral/pink và mint cho trạng thái học/phụ đề.

## Scope

- Chỉ frontend Anime: `src/features/anime/`, `src/styles/anime.css`, test Anime; CSS layout scoped `.anime-page`.
- Không sửa server/API/schema/crawler/database/rights policy/host allowlist/playback capability.
- Không dùng ảnh bên ngoài hoặc tự phát trailer. Chỉ dùng `poster_url`/metadata đã có, với fallback an toàn.
- Không động vào TopNav, Từ điển, SRS, JLPT, Video AI hoặc global theme.

## Design system yêu cầu

### 1. Canvas

- Anime là full-bleed cinematic surface dưới navigation: desktop sử dụng chiều rộng thực tế, `max-width` khoảng 1600px, gutters 24px desktop / 16px mobile.
- Nội dung chia thành vertical rhythm rõ ràng, không card bọc card vô cớ và không panel cao rỗng.
- Dùng semantic token; `anime.css` không chứa hex, rgb/hsl hay named color hard-code.
- Motion nhẹ, `prefers-reduced-motion` tắt transform/transition không cần thiết.

### 2. Catalog

- **Hero spotlight ngang** 21:9 hoặc 16:9, backdrop từ poster hiện có, overlay gradient, title Việt/Nhật, metadata cô đọng và CTA rõ: `Mở danh sách tập`.
- Không dùng nút CTA nếu API/policy không cho người dùng thực hiện hành động đó.
- Search/filter đặt trong một control rail compact sau hero, không chiếm quá nửa trang.
- Catalog là row/grid card landscape 16:9. Card có image, overlay, title, subtitle/episode count; hover chỉ nâng contrast/outline nhẹ; không zoom crop gắt.
- Có section title/count, loading skeleton, error, policy empty và filter empty phân biệt rành mạch.

### 3. Series hub

- Hero ngang full width với thông tin series nằm ở lower-left hoặc panel overlay, không còn poster dọc đứng riêng.
- Metadata là chip/subtle label, không biến toàn bộ thông tin thành badge lộn xộn.
- Mùa dùng tab/chip. Episode list là row: số tập, text, subtitle availability, trạng thái playable/học, CTA thực thi được.
- Episode row **không** tái dùng poster series làm thumbnail. Nếu không có episode screenshot thật trong API thì text-first row + semantic 16:9 placeholder nhỏ, hoặc không thumbnail.

### 4. Learning/player

- Player là vùng xem chính 16:9, transcript nằm cạnh trên desktop và dưới player ở mobile.
- Controls chỉ hiện những capability có thể chạy với source hiện tại. Không có nguồn playable thì dùng empty state thành thật, không dead controls.
- Giữ nguyên logic phụ đề, tra từ, SRS, progress, hotkey và policy đã pass ở T06/T07/T10.

## Tính responsive/a11y

- QA breakpoint: 1440, 1024, 768, 390px.
- 1440: grid 3–4 card; 1024: 3/2 card tùy card min width; 768: 2; 390: 1 card hoặc horizontal row snap có keyboard controls.
- Không horizontal scroll ở `body`; title/badge/CTA không bị cắt.
- Focus-visible luôn rõ. Toàn bộ card, CTA, tab mùa, row tập dùng keyboard Enter/Space và accessible name đúng.
- Contrast đầy đủ trên dark surface; `lang="ja"` còn nguyên cho tiếng Nhật.

## Cấm tuyệt đối

- Không copy/paste HTML/CSS/screenshots/assets từ Netflix hay web xem phim khác.
- Không nhái brand/name/logo/typography độc quyền hoặc dùng copy giống họ.
- Không thêm bypass quyền, stream URL, iframe nguồn lậu, auto-retry để che API lỗi hoặc mock production data.
- Không commit, deploy, reset/checkout/clean/stash worktree.

## Tests và QA

1. Mở catalog, hero CTA, filter/reset, card selection và deep link series/tập vẫn đúng route.
2. Episode select session chạy lần đầu theo gate T10; error từ API thật vẫn có retry đúng nghĩa.
3. Media capabilities: playable/unavailable/restricted render đúng, không CTA chết.
4. Poster broken/fallback không layout shift và không xuất hiện ảnh dọc ở episode rows.
5. Hồi quy toàn bộ subtitle, player, dictionary popover, SRS, progress và continue watching.

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

Chụp QA ở 1440px và 390px: catalog có data, detail series, episode rows, player/subtitle state. Kèm evidence network khi mở tập lần đầu và nêu số source playable thật có trong data; không khẳng định video chạy nếu không có source được cấp quyền.

## Bàn giao

1. Mapping pattern streaming → component Kotodama riêng, nêu rõ các khác biệt có chủ đích để tránh clone.
2. Danh sách file thay đổi và lý do.
3. Output thật toàn bộ gate command.
4. Ảnh QA desktop/mobile và evidence click tập lần đầu.
5. Xác nhận không đổi backend, API, data, policy bản quyền hoặc logic học.
