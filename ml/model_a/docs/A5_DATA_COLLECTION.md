# A5 — Thu và gán nhãn dữ liệu giọng người Việt

Mục tiêu pilot là tạo dữ liệu có thể kiểm toán cho Model A, không phải thu thật
nhiều audio ngay từ đầu. Không lưu họ tên, email hoặc thông tin nhận diện trong
manifest: chỉ dùng `speakerId` đã ẩn danh như `vn001`.

## Quy trình một recording

1. Người học đồng ý theo phiên bản consent nội bộ; ghi `consentVersion`.
2. Mỗi lần đọc một câu là một WAV mono 16 kHz, 2–10 giây, đặt dưới
   `data/recordings/<speakerId>/`. Thư mục recordings là private và bị Git ignore.
3. Tạo một dòng trong manifest từ `data/templates/pilot_manifest.example.jsonl`.
   `targetPhoneIndices` luôn chỉ đúng vị trí phoneme cần khảo sát, vì một câu có
   thể lặp cùng phoneme nhiều lần.
4. Giáo viên/người chấm chỉ đánh giá các vị trí đã chọn trong `phoneLabels`.
5. Xác thực manifest và audio trước khi chia tập.

## Rubric cho người chấm

Không yêu cầu chấm IPA hoặc mô tả cách phát âm thực tế. Với mỗi phoneme được
highlight, chọn một nhãn:

- `correct`: đạt yêu cầu trong ngữ cảnh câu.
- `near_correct`: gần đúng, có thể hiểu nhưng chưa tự nhiên.
- `incorrect`: phát âm không đúng mục tiêu.
- `unscorable`: audio/nhiễu không đủ để chấm.

Khi không phải `correct`, chọn tối đa một `errorType`: `substitution`,
`deletion`, `insertion`, `too_short`, `too_long` hoặc `unclear`. Sau đó có
thể chọn thêm một `errorPattern` để ghi nhận lỗi dễ hiểu với người Việt, ví dụ
`ts_to_ch`, `sokuon_deleted`, `long_vowel_shortened` hoặc `r_to_l`.
`errorPattern` là nhãn phụ; không đoán IPA thực tế khi người chấm không chắc.
Chấm `raterConfidence` từ 1 đến 5 và `sentenceIntelligibility` từ 1 đến 5.

Mở [form offline A8](../tools/pronunciation_annotation_form.html) bằng trình
duyệt để tạo annotation JSON từ một manifest row. Form không upload audio hay
gửi dữ liệu qua mạng; người chấm tự chọn WAV local để nghe và tải JSON về máy.

## Lệnh dữ liệu

```powershell
cd D:\Project\kotodama\ml\model_a

# Chỉ kiểm tra schema/nhãn
.\.venv\Scripts\python.exe -m src.collection_cli validate `
  --manifest .\data\manifests\pilot.jsonl

# Kiểm tra cả file WAV private
.\.venv\Scripts\python.exe -m src.collection_cli validate `
  --manifest .\data\manifests\pilot.jsonl `
  --recordings-root .\data\recordings

# Tạo manifest split mới, không ghi đè file cũ
.\.venv\Scripts\python.exe -m src.collection_cli assign-splits `
  --input .\data\manifests\pilot.jsonl `
  --output .\data\manifests\pilot-split-v1.jsonl `
  --seed kotodama-a5-2026
```

`assign-splits` chia theo `speakerId`, không theo recording. Vì vậy một người
không thể xuất hiện ở cả train và validation/test. Cần tối thiểu ba người nói;
với pilot ít người, báo cáo split quan trọng hơn tỷ lệ 70/15/15 chính xác.

## Quy tắc trước khi train

- Chỉ dùng manifest `valid: true` và đã gán split.
- Không đưa `recordingQuality` là `invalid`, `clipped` hoặc `too_short` vào
  training set; giữ chúng để kiểm tra quality gate.
- Cố định seed và giữ lại manifest split đã sinh để mọi thí nghiệm có thể lặp lại.
- Không fine-tune CTC bằng text chuẩn của bản ghi lỗi; A5 labels là dữ liệu cho
  calibration/classifier chẩn đoán ở giai đoạn sau.
