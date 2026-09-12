# Model A A9 — API chấm phát âm bằng artifact đã calibrate

A6 đã có train CLI nhưng trước A9 API luôn trả rule A4. A9 khép khoảng hở đó: API `POST /v1/pronunciation/score` vẫn lấy alignment/GOP từ Model A, sau đó nạp một A6 artifact local tin cậy để trả xác suất `correct/near_correct/incorrect` theo từng phoneme.

## Điều kiện bắt buộc

Chỉ dùng sau khi đã có manifest A5 split theo `speakerId`, A6 artifact đã train và review metric trên validation/test speaker độc lập, cùng ba file `model.joblib`, `metadata.json`, `metrics.json`. Không bao giờ nạp `.joblib` tải từ Internet vì joblib/pickle có thể thực thi mã khi load.

## Chạy local

```powershell
cd D:\Project\kotodama\ml\model_a
$env:KOTODAMA_A6_MODEL_DIR = 'D:\Project\kotodama\ml\model_a\artifacts\a6-logistic-v1'
.\.venv\Scripts\python.exe -m uvicorn src.pronunciation_api:app --host 127.0.0.1 --port 8091
```

`GET /healthz` sẽ trả `scoringMode: a6_calibrated_classifier`. Nếu không đặt biến môi trường, API vẫn chạy mode `baseline_heuristic_not_calibrated` để demo, nhưng không được dùng làm điểm phát âm cuối cùng.

## Contract giữ nguyên

Endpoint vẫn nhận multipart `audio`, `expectedText`, optional `sentenceId`. Kết quả có thêm `classifierLabel`, `classProbabilities`, `classifierArtifact` và `ruleHints`; vẫn giữ `startMs/endMs` từng phoneme để B5 ghép thành mora.

Với A6 artifact binary, nhãn `acceptable` được render thành `near_correct` ở UI để tránh tuyên bố "đúng tuyệt đối". Artifact three-class là lựa chọn nên dùng cho shadowing.
