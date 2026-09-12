# Model B B3 — Thu nhãn prosody từ người chấm

B3 tạo data để B4 học cách biến B2 evidence thành đánh giá có ý nghĩa. Nó không
yêu cầu giáo viên nhìn đồ thị F0 hay ghi IPA; giáo viên chỉ nghe reference và
learner attempt, rồi đánh giá vị trí mora được highlight.

## Một row B3

Mỗi row có:

- `learnerSpeakerId` ẩn danh, `l1Code` tùy chọn và `consentVersion`;
- native `referenceId`, `expectedText` và đường dẫn B2 JSON private;
- danh sách mora copy từ B2 cùng `focusMoraIndices`;
- annotation có `annotationId` duy nhất và một `raterId` ẩn danh. Một
  `attemptId` có thể xuất hiện nhiều lần khi chấm kép, nhưng mỗi lần chấm phải
  có `annotationId` khác nhau.

Nhãn:

| Nhóm | Giá trị |
| --- | --- |
| Pitch accent | `correct`, `near_correct`, `incorrect`, `unscorable` |
| Rhythm | `correct`, `too_fast`, `too_slow`, `long_vowel_shortened`, `sokuon_weak`, `other`, `unscorable` |
| Intonation | `natural`, `needs_work`, `unscorable` |
| Mora lỗi | 0 hoặc nhiều index, nhưng chỉ trong `focusMoraIndices` |

Không chắc thì chọn `near_correct`/`unscorable`, để `problematicMoraIndices`
rỗng và giảm `raterConfidence`. Không bắt buộc kết luận learner phát ra phone
nào thay thế.

## Thiết kế pilot

1. Mục tiêu 30–50 learner Việt; với mỗi người thu một bộ prompt như nhau.
2. Bắt đầu khoảng 12–20 câu/người, tập trung `っ`, trường âm, `つ`, `ら` và
   câu/cặp có thay đổi pitch accent như 雨/飴, 橋/箸. Cặp từ chỉ là prompt thiết
   kế — audio reference phải do native nói trọn câu.
3. Chọn 15–20% attempt để hai người chấm độc lập. Không gộp nhãn trước khi
   tính agreement; giữ riêng `raterId` và phiên bản rubric.
4. Chia train/validation/test **theo learnerSpeakerId**, không theo câu.
5. `l1Code` là tự nguyện và chỉ lưu language code (vd. `vi`), không suy đoán
   ethnicity/nationality/giới tính từ âm thanh.

## Form offline

Mở [`../tools/prosody_annotation_form.html`](../tools/prosody_annotation_form.html)
bằng trình duyệt, dán một B3 manifest row, chọn hai audio local rồi tải lại row
có annotation. Form không upload file. Mỗi downloaded JSON là một object; thêm
nó thành một dòng vào manifest JSONL private.

## Lệnh kiểm tra

```powershell
cd D:\Project\kotodama\ml\model_b

.\.venv\Scripts\python.exe -m src.collection_cli validate `
  --manifest .\data\manifests\b3-pilot.jsonl

.\.venv\Scripts\python.exe -m src.collection_cli assign-splits `
  --input .\data\manifests\b3-pilot.jsonl `
  --output .\data\manifests\b3-pilot-split-v1.jsonl `
  --seed kotodama-b3-2026
```

Manifest B3, B2 JSON và learner audio đều là private; không commit chúng.
