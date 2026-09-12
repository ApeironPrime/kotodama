# Model B B4 — Baseline chấm prosody từ nhãn người

B4 không train trên waveform. Nó nhận B2 evidence của **một mora đã được
Model A khóa theo câu tham chiếu**, rồi học cách tái tạo đánh giá của người
chấm trong B3. Điều này giúp mỗi kết luận có thể truy ngược về F0, timing và
nhãn người chấm thay vì là một "điểm AI" khó giải thích.

## Feature đầu vào

Mỗi sample là `attemptId + annotationId + moraIndex` trong
`focusMoraIndices`. Vector hiện gồm:

- F0 DTW, lệch start/end/median/slope và sai khác pitch-drop;
- duration ratio, duration delta tương đối, pause trước/sau;
- voiced-ratio và energy delta (dB tương đối, không dùng volume thô);
- vị trí mora chuẩn hoá trong câu.

Giá trị F0 bị thiếu (ví dụ mora vô thanh) được `SimpleImputer(median)` xử lý
trong pipeline train. Không thay giá trị thiếu bằng 0 vì 0 là một observation
khác hẳn không đo được.

## Ba model baseline

| Đầu ra | Nhãn B3 | Model |
| --- | --- | --- |
| `pitch` | `correct`, `near_correct`, `incorrect` | Logistic Regression + chuẩn hoá feature |
| `rhythm` | `correct`, `too_fast`, `too_slow`, `long_vowel_shortened`, `sokuon_weak`, `other` | Random Forest |
| `intonation` | `natural`, `needs_work` | Logistic Regression + chuẩn hoá feature |

`unscorable`, attempt có chất lượng `clipped`/`invalid`/`too_short`, và nhãn
có confidence dưới ngưỡng sẽ không đi vào train. Mặc định ngưỡng confidence là
3/5. B4 từ chối train nếu mỗi task chưa có tối thiểu 8 sample train và 2 class;
thực tế nên có ít nhất vài chục sample **mỗi class** trước khi tin điểm số.

## Train

Trước hết B3 phải được split theo `learnerSpeakerId`. `data-root` là thư mục
cha của những đường dẫn `b2EvidencePath` private trong JSONL.

```powershell
cd D:\Project\kotodama\ml\model_b

.\.venv\Scripts\python.exe -m src.b4_baseline_cli train `
  --manifest .\data\manifests\b3-pilot-split-v1.jsonl `
  --data-root .\data `
  --output-dir .\artifacts\b4-pilot-v1 `
  --minimum-confidence 3
```

Lệnh tạo:

- `b4_models.joblib`: ba pipeline local. Chỉ nạp artifact do chính project tạo,
  tuyệt đối không nạp file joblib tải từ Internet.
- `training_report.json`: số speaker/sample, accuracy và macro-F1 theo
  train/validation/test.

## Dự đoán một mora

```powershell
.\.venv\Scripts\python.exe -m src.b4_baseline_cli predict `
  --model-dir .\artifacts\b4-pilot-v1 `
  --b2-evidence .\data\comparisons\attempt_001.json `
  --mora-index 3
```

Kết quả trả label, xác suất class, `calibratedScore` 0–100 và confidence cho
từng nhóm. Score là kỳ vọng xác suất của **rubric pilot**, không phải điểm năng
lực tiếng Nhật chung hay quyết định pass/fail.

## Khi nào B4 đủ dùng

Chỉ bắt đầu thử UI nội bộ sau khi đánh giá tập test có speaker hoàn toàn mới,
nhìn confusion matrix và kiểm tra agreement chấm kép B3. Nếu macro-F1 thấp,
đừng đổi model sâu ngay: thường cần bổ sung nhãn ở class thiếu hoặc chuẩn hoá
lại rubric trước.
