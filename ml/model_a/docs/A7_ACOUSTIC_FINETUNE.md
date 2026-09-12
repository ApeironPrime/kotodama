# A7 — Fine-tune acoustic CTC và API score local

## Hai loại dữ liệu, hai loss khác nhau

| Dữ liệu | Được dùng cho | Không được dùng cho |
| --- | --- | --- |
| Audio native hoặc `expert_verified_realized` | CTC phoneme loss | Nhãn lỗi người học |
| Audio người Việt có nhãn A5/A6 | Error classifier / calibration | CTC với text mục tiêu nếu người học đọc sai |

Một recording người học đọc sai `つ` không được có label CTC là `ts` chỉ vì câu
mục tiêu chứa `つ`. Điều đó khiến CTC học cách che lỗi. Nếu dùng learner audio
cho CTC, phải có `realizedPhonemes` do chuyên gia xác nhận.

## Fine-tune cho RTX 4050 6 GB

[acoustic_finetune.json](../configs/acoustic_finetune.json) cố định batch 1,
gradient accumulation 8, FP16, gradient checkpointing, freeze feature extractor
và chỉ mở hai encoder block cuối. Learning rate encoder thấp hơn CTC head 10
lần. Audio CTC giới hạn 8 giây và Dataset đọc WAV lazy.

`localFilesOnly` mặc định là `true`: train dùng checkpoint đã có trong cache,
không gọi mạng khi khởi động. Chỉ đổi thành `false` khi chủ động muốn tải hoặc
cập nhật model nền.

```powershell
cd D:\Project\kotodama\ml\model_a

.\.venv\Scripts\python.exe -m src.train_acoustic `
  --manifest .\data\manifests\native-ctc-v1.jsonl `
  --recordings-root .\data\recordings\native `
  --output-directory .\artifacts\a7-native-ctc-v1
```

Checkpoint chọn theo `eval_loss` của native CTC. Macro F1 là metric của A6
error classifier; chỉ dùng để chọn multi-task/error head khi số label learner đủ
lớn. Không full-fine-tune toàn encoder trên GPU 6 GB.

## API local

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.pronunciation_api:app --host 127.0.0.1 --port 8091
```

`POST /v1/pronunciation/score` nhận multipart `audio`, `expectedText`, tùy chọn
`sentenceId`. WAV mono 16 kHz được dùng trực tiếp; WebM/Opus cần FFmpeg để đổi
sang WAV. Endpoint hiện dùng A2–A4 baseline và trả
`scoringMode: baseline_heuristic_not_calibrated`; không được quảng cáo như điểm
phát âm đã calibrate. Chỉ bind localhost, rồi để Node backend đã xác thực gọi
nội bộ.

Kết quả phù hợp với schema database hiện có: lưu chi tiết phoneme/timing tại
`shadowing_attempts.alignment`, điểm tại `shadowing_scores.pronunciation_score`,
feedback JSON tại `shadowing_scores.feedback`, và phiên bản tại
`shadowing_scores.scoring_version`.

## Khi nào lên multi-task

Chỉ sau khi A6 có validation/test speaker-disjoint đạt pilot metric. Khi đó
HuBERT encoder chung có CTC head (native loss) và error head (learner labels),
với encoder LR nhỏ hơn head. Không train multi-task trước khi mỗi lớp lỗi có đủ
support; baseline Logistic Regression vẫn là đối chứng bắt buộc.
