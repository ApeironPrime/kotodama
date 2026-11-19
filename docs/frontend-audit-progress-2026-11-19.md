# Frontend audit remediation — 19 November 2026

This pass addresses the follow-up audit supplied on 19 November. It does not certify that every page meets WCAG AA or that the application sustains 60 fps on mobile hardware.

## Changes

- The real grammar catalog and lesson reader now mount under `/tra-tu?tab=grammar`; `/bunpo` reaches that same flow. Grammar search uses the curriculum API, whose results contain actual lesson identifiers. Opening a result preserves its book, lesson and grammar point in the URL and opens the matching card rather than the first card in the lesson. Catalog counts come from lesson responses; empty books have an explicit empty state.
- Kanji has a URL-backed list/ink switch. Mobile initially uses the paginated list; desktop keeps the ink view. The grid uses 48 items per page by default. Ink requests are capped at 120 and start at N5, with a link to the complete paginated list. Global search feeds the list query and resets pagination.
- Theme bootstrap now sets `data-theme`, `data-background-tone`, color scheme and the legacy dark class consistently. Home, dictionary and authentication inherit root semantic colors. Button fills and accent text have separate tokens so dark themes can use lighter text without lightening button fills. Shared primitive corrections moved into `ui.css`. The home paper veil, footer fade and story background now follow the selected theme.
- Home and inner pages share the same navigation layout; guests see login on the home page too. Focused video study hides both desktop and mobile navigation.
- All three interface sound engines share one persisted, device-local setting. Sound defaults off and creates no AudioContext while disabled. Home, ink and Settings controls stay synchronized. Muting suspends existing contexts. Speech playback remains a separate learning preference.
- Daily word goals are shared with the learning plan. Automatic pronunciation is consumed by word detail. Review limits subtract cards already reviewed today and load further deck pages when needed, including unlimited sessions. Furigana/Romaji labels explicitly state their Video AI scope. Unimplemented pitch, reminder and privacy options are disabled with explanations.
- Manual JLPT submission requires confirmation and reports the number answered. Failed submission preserves answers and offers retry. Timeout submission remains automatic. The exam's Back button confirms exit, and browser unload warns during an unfinished attempt.
- Dictionary tabs support arrow/Home/End navigation. Result selection uses pressed-button semantics. SRS cards, grammar books/lessons/cards, related Kanji and heatmap entries can receive keyboard focus. SRS keyboard handling avoids stealing Space from nested controls. Save failures in dictionary, grammar and Kanji detail are visible in the relevant view.
- The hero no longer mounts its WebGL renderer on mobile. Three.js is loaded through a separate graphics chunk; the 512×512 CPU depth-map generation was replaced by the equivalent analytical shader calculation. Reduced-motion and unavailable-WebGL cases retain a poster. This is an implementation improvement, not an FPS measurement.
- Font stylesheet requests are consolidated into one HTML link; external font CSS imports were removed. Japanese exam content uses the Japanese font stack. Grammar grids and certificate columns fit narrow viewports; review grid tracks no longer expand to their contents. The mobile study drawer trigger no longer covers lesson headings. Home's scroll story is shorter.
- Home preview cards and the empty courses page lead to the actual bookshelf. Selected emoji and internal `yt-dlp`/`Anki` labels were replaced with user-facing wording. The previously approved brush cursor and button-origin water effect remain intact.
- Browser QA also exposed an aborted-request reuse during session restoration in React Strict Mode. Requests with caller-owned cancellation signals are no longer shared across component lifecycles; requests without those signals retain deduplication.

## Verification

- Frontend tests: **185 passed, 0 failed**, including real dictionary-to-lesson routing, matching-point selection, mobile grid requests, sound synchronization/default silence, daily limits, keyboard card opening, submission failure/retry and cancelled session restoration.
- Production build: TypeScript and production artifact verification. Graphics are separated from the common vendor chunk; the graphics chunk still exceeds Vite's 300 kB warning threshold.
- Source lint: no errors in `src`, `vite.config.ts` and the QA script. The existing Word-of-the-Day fast-refresh warning remains. Repository-wide lint also finds pre-existing unused imports in unrelated scripts; those files were not changed.
- Browser QA script: `node scripts/qa-fe-second-pass.mjs`. Public-page matrix covers home, login, grammar and Kanji at **320, 390, 768 and 1440 px**, with ivory, midnight and forest themes. It checks inherited theme values, horizontal page overflow and uncaught page errors, and saves screenshots for visual inspection.
- Additional browser journeys cover grammar search to a full lesson, authenticated local Settings persistence, unavailable-SRS feedback, mobile SRS layout/keyboard interaction with an explicit API fixture, and desktop/mobile renderer mounting.
- Final browser run: **56 checks passed, 0 failed; 1 database-backed SRS journey explicitly blocked**. Screenshots were inspected in addition to the automated assertions; that inspection identified and led to fixes for the home veil, grammar card colors, mobile drawer placement and SRS filter overflow.
- Evidence stays in `reports/frontend-audit-second-pass-tests.json`, `reports/frontend-audit-second-pass-build.log` and `reports/fe-second-pass/`. These are local QA artifacts, not production screenshots.

## Limits and remaining work

- The configured PostgreSQL service rejects startup with a quota error. The local API was run without that database for public-content and account-settings checks. Persistent SRS browser integration is blocked in that mode; the SRS browser interaction checks use an explicit fixture and do not prove a successful database write. Unit tests cover the SRS interaction and failure contracts.
- No new Render deployment has been verified in this pass. This session has no Render deployment connector, CLI or deployment credential available. A Git push alone must not be described as a live deployment.
- The exam exit guard covers its Back action and browser unload; it does not yet block every SPA navigation or browser-history transition.
- This is not a completed accessibility certification or a complete deletion of legacy CSS/inline styles. All dialogs, screens, status combinations and long-content cases still need a broader accessibility/theme pass. The browser matrix above is the exact scope checked here.
- The audit's absolute claims about all dark styling being disabled, short sounds necessarily violating WCAG 1.4.2, and measured mobile heat/FPS were not established by static inspection. The underlying theme/sound/performance problems were addressed without adopting those unverified claims.
