# T04 — Browse, search và episode API

## Phạm vi

API đọc metadata đã import; chưa viết player UI.

## Endpoints tối thiểu

- `GET /api/v1/anime/catalog?q=&level=&genre=&page=&limit=`
- `GET /api/v1/anime/series/:slug`
- `GET /api/v1/anime/series/:slug/episodes?page=&limit=`
- `GET /api/v1/anime/episodes/:episodeId`
- `GET /api/v1/anime/episodes/:episodeId/subtitles?from=&to=&lang=`
- `GET /api/v1/anime/dictionary/:wordId`

## Ràng buộc

- Phân trang/limit cứng, truy vấn không N+1, cache metadata có ETag.
- Chỉ trả media source khi policy cho phép; không trả external page như stream.
- Không trả toàn bộ subtitle/dictionary nếu client chỉ cần một cửa sổ thời gian.
- Validate slug/id/query, chặn path traversal, private address và URL scheme nguy hiểm.

## Nghiệm thu

- Contract test 200/400/403/404, rights filtering, pagination, subtitle window và dictionary lookup.
- EXPLAIN xác nhận dùng index trên dữ liệu thật.
