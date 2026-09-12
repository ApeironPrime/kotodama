# T09 — Redesign giao diện Anime theo trải nghiệm streaming quốc tế

## Mục tiêu

Thiết kế lại **toàn bộ giao diện Anime phía client** thành một trải nghiệm xem phim hiện đại, đậm chất streaming quốc tế, nhưng vẫn là Kotodama: dễ chọn phim, dễ chọn tập và nhìn rõ trạng thái học phụ đề/SRS.

Nguồn cảm hứng là các pattern tốt của Netflix/Crunchyroll: hero backdrop ngang, hàng nội dung rõ ràng, metadata cô đọng, episode row dễ quét và “tiếp tục xem”. **Không sao chép thương hiệu, logo, copy, asset, màu nhận diện hay layout 1:1 của bất kỳ dịch vụ nào.**

## Phạm vi

- Chỉ sửa frontend Anime và stylesheet liên quan trong `src/features/anime/`, `src/styles/anime.css`, token semantic nếu thực sự cần, cùng test frontend Anime.
- Tái sử dụng đúng API/data hiện có: `poster_url`, series metadata, season, episode, progress, subtitle/SRS. Không tạo API, migration, crawler, AI, provider, analytics hay fetch bên thứ ba.
- Không đổi route, typed API contract, policy `unknown/restricted`, local-owner override, player fail-closed, subtitle windowing, dictionary LRU, SRS provenance hay progress logic.
- Không thay global app theme, TopNav, Dictionary, SRS, JLPT, curriculum hoặc Video AI. Chỉ Anime có visual language cinematic riêng.

## Hướng thiết kế bắt buộc

### 1. Visual language

- Dùng **cinematic dark** riêng cho vùng Anime: nền than/xanh đen, surface nhiều lớp, typography sáng dễ đọc, accent Kotodama hồng/coral cho hành động chính và xanh/mint cho trạng thái phụ đề/học tập.
- Dùng toàn bộ semantic token CSS; không hard-code `#hex`, `rgb()`, `hsl()` hay named color trong `anime.css`.
- Hình nền/backdrop được dựng từ `poster_url` hiện có bằng layer image + gradient/blur CSS hợp lý. Không dùng ảnh mạng mới, không auto-play trailer/video preview.
- Có reduced-motion; hover/transition tinh tế, không zoom/phóng thẻ gây giật hoặc che thông tin.

### 2. Trang catalog `/anime`

- Header Anime compact: title, mô tả ngắn, tìm kiếm rõ, filter JLPT theo chip. Trạng thái active dễ thấy và có nút reset filter.
- Khi có data: thêm **featured hero** ngang 16:9 ở đầu, lấy series đầu tiên trên trang/series selected nhưng không tự fetch thêm. Hero gồm backdrop, title Việt/Nhật, metadata, CTA `Xem tập` / `Danh sách tập` theo data có sẵn.
- Catalog chuyển thành các **landscape media cards 16:9**, không poster dọc. Card hiển thị overlay gradient, title, level, số tập phụ đề và CTA; không letterbox đen lớn, không méo ảnh.
- Grid responsive: desktop 3–4 card tùy độ rộng; tablet 2; mobile 1 hoặc horizontal snap row nếu phù hợp. Không overflow ngang ngoài vùng carousel có control/accessibility rõ.
- Giữ skeleton, loading, empty, error có cùng visual language. Empty do filter phải nói rõ và reset filter; empty do policy/API không được ngụy trang là “không có phim”.

### 3. Trang chi tiết series

Thay layout poster dọc + khoảng trống bằng một **series hub**:

- Hero/banner ngang 16:9 ở đầu panel; backdrop từ `poster_url`, gradient đảm bảo text contrast. Nội dung: title Việt, title Nhật, mô tả, tag JLPT/category, mùa/tập/subtitle/source.
- Nút quay lại danh mục và close vẫn keyboard-accessible; focus/route behavior hiện có không đổi.
- Danh sách mùa là chip/tab có semantics; danh sách tập là **episode row**, không grid thẻ vuông: số tập, title, mô tả ngắn nếu có, badge phụ đề, progress nếu API đã trả, affordance play/continue.
- Episode row desktop có thumbnail ngang tận dụng poster hiện có như fallback (không invent URL); mobile co thành danh sách dễ tap với min target 44px.
- Không render player/media URL trong catalog/detail nếu episode không permitted.

### 4. Khu học tập và player

- Không đổi hành vi `AnimeLearningSession`, player, popover từ điển, transcript, SRS hoặc progress.
- Chỉ đồng bộ surface/spacing/typography để session trông cùng hệ streaming: player 16:9 nổi bật, transcript và learning controls phân tầng rõ.
- Không được che subtitle controls, player controls, popover/bottom sheet hoặc keyboard focus.

## Accessibility và responsive

- WCAG tương phản đủ rõ trên cinematic surface; `:focus-visible` luôn thấy.
- Tất cả CTA/card/episode usable bằng Tab + Enter/Space; không button lồng button và không lấy shortcut player khi focus control.
- Có label đúng cho search/filter/episode/hero CTA; ảnh decorative dùng alt phù hợp.
- QA bắt buộc ở 1440px, 1024px, 768px và 390px; không cắt title, badge hay các action quan trọng.
- Light/dark global hiện có không được hỏng. Nếu Anime chọn dark cinematic cố định, phải bảo đảm nó có đủ contrast trong cả hai global mode.

## Bảo toàn dữ liệu và policy

- Không dùng mock/fallback client để hiển thị Anime `unknown/restricted` khi public API trả rỗng.
- Không sửa `ANIME_LOCAL_UNAPPROVED_ACCESS`; không thêm query/header/toggle bypass ở UI.
- Không đưa raw subtitle, full dictionary shard, stream URL hay progress user khác vào HTML/bundle.
- Không sửa backend/server data trong T09.

## Tests và nghiệm thu

### Bổ sung/cập nhật test frontend

1. Catalog card/hero có semantic accessible name và card landscape class/structure.
2. Filter/search/reset và empty/error/loading không hồi quy.
3. Series detail hero, season selection và episode row click/keyboard vẫn mở đúng episode route.
4. Poster lỗi vẫn placeholder; không ảnh broken layout.
5. Guest/SRS/player/progress tests T06/T07 vẫn pass.

### Lệnh bắt buộc

```powershell
npm run test:frontend
npm run typecheck
npx oxlint src/features/anime/ src/styles/anime.css src/styles/tokens.css
npm run build
node --test scripts/anime/*.test.mjs
git diff --check
git diff --stat
```

### QA bắt buộc

- Chạy local với API đã cấp quyền local-owner chỉ trên loopback nếu cần data demo; không đổi policy.
- Chụp ảnh 1440px và 390px cho: catalog có data, catalog filter empty, series detail có episode rows, learning/player screen.
- Nêu rõ phần nào không thể nhìn trực quan và evidence automated tương ứng. Không tự nhận QA nếu không có screenshot/browser evidence.

## Không làm

- Không deploy/commit/push.
- Không dùng `git checkout`, `git reset`, `git clean`, `git stash`, không ghi đè worktree có sẵn.
- Không sửa task T10 hay tạo tính năng đề xuất/phân loại/AI mới.

## Bàn giao

1. Tóm tắt design decisions và mapping từng khu cũ → mới.
2. Danh sách file đổi, lý do và `git diff --stat`.
3. Output thật các lệnh gate.
4. Ảnh QA desktop/mobile theo yêu cầu.
5. Xác nhận không đổi backend, policy nội dung, API contract hoặc logic học tập T06/T07.
