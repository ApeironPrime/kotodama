# A6 — Classifier lỗi phát âm đầu tiên

## Dữ liệu vào

`feature_export_cli` chạy A3 trên mỗi recording có `annotation` hợp lệ và
trích xuất một dòng cho mỗi phoneme đã được người chấm chọn. Feature row chứa:

- GOP, posterior margin, entropy, duration, duration ratio;
- phoneme mục tiêu, top competitor và ngữ cảnh trái/phải;
- SNR ước lượng, clipping ratio, thiết bị và chất lượng recording;
- nhãn `correct`, `near_correct`, `incorrect` từ người chấm.

Không có nhãn nào được AI tự sinh. `unscorable`, `noisy`, `clipped`,
`too_short`, `invalid` không đi vào train set.

## Model baseline

Mặc định là **Logistic Regression** với imputation, scaling và one-hot encoding
cho categorical features. Nó nhanh, kiểm tra được và phù hợp khi data còn ít.
`--model random_forest` là đối chứng phi tuyến, không phải thay thế cuối cùng.

Classifier chỉ fit ở `train`; validation và test là speaker chưa từng xuất hiện
trong train. Vì vậy chỉ chạy A6 sau khi A5 manifest đã được chia split theo
speaker.

## Đọc metrics

- `macroF1`: không để lớp đông dữ liệu che mất lớp hiếm.
- `falseAcceptanceRate`: tỷ lệ mẫu `incorrect` bị chấp nhận.
- `falseRejectionRate`: tỷ lệ `correct`/`near_correct` bị chấm `incorrect`.
- `perClass`, `perPhone`, `confusionMatrix`: bắt buộc xem trước khi tuyên bố
  model hữu ích.

Mục tiêu pilot là Macro F1 >= 0.65, FAR <= 0.20 và không phoneme nào có recall
bằng 0. Nếu test support quá ít, coi metric là thăm dò, không phải kết luận.

## Điều chưa làm ở A6

- Chưa hiệu chuẩn probability; việc đó cần validation set đủ lớn ở A7.
- Chưa fine-tune acoustic CTC model. Không được dùng câu chuẩn làm CTC label
  cho bản ghi sai phát âm.
- Chưa dùng các nhãn lỗi chi tiết để train multiclass error type; cần đủ support
  cho từng `substitution`, `deletion`, `too_short` trước.
