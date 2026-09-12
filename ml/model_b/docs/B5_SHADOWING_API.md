# Model B B5 — API kết hợp Shadowing

B5 không chạy Model A/B2 lại từ audio. Backend worker phải làm theo thứ tự:

1. Model A score một recording bằng `expectedText`, giữ JSON A4/A7.
2. B0--B2 so attempt với **native reference của đúng câu đó**, giữ B2 JSON.
3. B5 nạp artifact B4 local rồi ghép hai JSON thành feedback theo mora và
   timestamp của learner.

Tách pipeline như vậy giúp không chạy CTC/GPU hai lần, không truyền raw audio
qua API tổng hợp, và không cho client chọn hay tải artifact model tuỳ ý.

## Chạy local

Sau khi B4 đã train thật:

```powershell
cd D:\Project\kotodama\ml\model_b
$env:KOTODAMA_B4_MODEL_DIR = 'D:\Project\kotodama\ml\model_b\artifacts\b4-pilot-v1'
.\.venv\Scripts\python.exe -m uvicorn src.shadowing_api:app --host 127.0.0.1 --port 8092
```

`GET /healthz` chỉ trả model B4 đang nạp. Nếu chưa có artifact B4, service sẽ
không khởi động. Đây là chủ ý: không được âm thầm thay scoring bằng rule giả.

## Endpoint

`POST /v1/shadowing/evaluate`

```json
{
  "modelAScore": { "sentenceId": "s01", "evaluationStatus": "scored", "phonemes": [] },
  "b2Evidence": { "schemaVersion": "kotodama-model-b-b2-v1", "morae": [] }
}
```

Hai payload là kết quả **đã được worker tin cậy tạo ra** cho cùng attempt và
`expectedText`; endpoint từ chối chuỗi phoneme không khớp. Không truyền đường
dẫn local, audio, hay model artifact từ request.

Kết quả có các điểm `contentScore`, `pitchScore`, `rhythmScore`,
`intonationScore`, `overallShadowingScore` và `problematicMoras`. Mỗi mora lỗi
có `startMs/endMs`, issue chính, toàn bộ issues, Model A content evidence và
Model B prosody evidence để UI nhảy đúng câu/đúng đoạn video.

Trạng thái hiện tại là `review_only_baseline`: điểm B5 không dùng cho pass/fail,
leaderboard hoặc claim đánh giá phát âm chính thức trước khi A6/B4 được đánh giá
trên speaker test độc lập.
