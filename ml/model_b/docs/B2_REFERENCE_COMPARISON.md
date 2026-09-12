# Model B B2 — So sánh native reference với learner attempt

B2 là tầng **evidence**, không phải tầng chấm điểm. Nó chỉ hoạt động khi cả
hai audio nói cùng expected text và đều đã có Model A A2 forced alignment.

```text
native WAV + Model A alignment ─┐
                                ├─ B0 mora → B1 features → B2 evidence JSON
learner WAV + Model A alignment ─┘
```

## Vì sao DTW theo từng mora

Không DTW toàn câu không ràng buộc: một learner nói chậm có thể bị ghép contour
ở mora 1 với mora 2, tạo kết quả nghe có vẻ tốt nhưng sai linguistic. B2 yêu
cầu topology mora giống hệt từ expected text; DTW chỉ co/giãn frame **bên trong
một mora**. Nhịp nói được giữ riêng bằng `durationRatioLearnerToReference`.

## Output hiện tại

Mỗi mora gồm:

- `pitchDtw.meanAbsoluteDistanceSt`: độ khác contour F0, semitone đã chuẩn hoá;
- duration ratio/delta;
- delta voiced ratio, F0 start/end/median/slope;
- pause trước/sau;
- status `insufficient_voiced_frames` nếu không đủ F0 để so sánh.

`meanPitchDtwDistanceSemitones` là trung bình evidence, **không** phải percent
đúng hoặc pitch score. B3 sẽ thu nhãn người chấm cho pitch/rhythm/intonation;
B4 mới học calibration từ các feature này.

## Chạy local

```powershell
cd D:\Project\kotodama\ml\model_b
.\.venv\Scripts\python.exe -m src.prosody_compare_cli `
  --reference-audio D:\private-data\native.wav `
  --reference-alignment D:\private-data\native-a2.json `
  --learner-audio D:\private-data\learner.wav `
  --learner-alignment D:\private-data\learner-a2.json `
  --output D:\private-data\comparison-b2.json
```

The current backend is still `raw_ac_fallback`, carried in the output for both
recordings. Do not mix pitch-method versions in a future training dataset.
