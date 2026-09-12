# A8 — Native CTC data và nhãn lỗi phát âm

Mục tiêu A7 có hai nguồn dữ liệu **khác nhau**. Không trộn chúng.

| Mục đích | Dữ liệu được dùng | Không được suy diễn |
| --- | --- | --- |
| Fine-tune CTC phoneme | Native speech sạch + transcript/reading đã xác minh | Đây không tạo nhãn lỗi người học |
| Classifier phát hiện lỗi | Bản ghi người học + người chấm ở vị trí phoneme mục tiêu | Transcript đúng không phải nhãn phát âm đúng |

## Lựa chọn nguồn native

### Batch khởi đầu: JVS `parallel100`

**JVS (Japanese Versatile Speech)** là lựa chọn khởi đầu tốt nhất cho Model A:
100 professional Japanese speakers, studio audio 24 kHz, transcript và tag
speaker; bộ dữ liệu cũng công bố phoneme alignment tự động. Không tin alignment
tự động như gold label tuyệt đối: giữ transcript, sinh lại phoneme bằng G2P của
Kotodama, rồi dùng A2/MFA để kiểm tra ngẫu nhiên.

- Trang tải và điều khoản: <https://sites.google.com/site/shinnosuketakamichi/research-topics/jvs_corpus>
- Nhãn/Julius–OpenJTalk cộng đồng: <https://github.com/Hiroshiba/jvs_hiho>
- Điều khoản audio: research học thuật, nghiên cứu phi thương mại và cá nhân;
  **không redistributing**. Không đưa WAV JVS vào Git, Hugging Face public hay
  file build của website. Nếu Kotodama thương mại, phải liên hệ chủ corpus.

**Kế hoạch chọn 5–10 giờ đầu:** lấy chỉ `parallel100`, chọn cùng một nhóm câu
trải đều 100 speaker thay vì lấy nhiều câu của ít speaker. Ghi `source=JVS`,
`licenseScope=research_only`, `labelSource=native` trong manifest private. Chia
train/validation/test theo `speakerId`, không theo từng WAV.

### Tăng đa dạng, không thay JVS: Mozilla Common Voice Japanese

Common Voice Japanese có audio đọc câu, transcript, metadata speaker và giấy
phép CC0. Bản v26 công bố 372.29 giờ validated từ 7,834 speaker. Nó phù hợp để
tăng đa dạng thiết bị/giọng và kiểm tra tổng quát hoá, nhưng không nên coi mọi
speaker là native standard Japanese chỉ dựa trên metadata. Chỉ dùng clip
`validated`, lọc audio, kiểm tra transcript–audio và giữ `source=CommonVoice`.

- Datasheet/giấy phép: <https://mozilladatacollective.com/datasets/cmqim4lxy00tunr07cjkcupeg>
- Không cố định danh tính người nói, không re-host/re-share dataset.

### Nguồn nghiên cứu có giá trị, chưa tải tự động

- **CSJ:** khoảng 660 giờ spontaneous Japanese, 16 kHz/16 bit và transcript;
  phù hợp mở rộng sau này nhưng có thủ tục/điều khoản riêng.
  <https://clrd.ninjal.ac.jp/csj/en/index.html>
- **I-JAS/C-JAS và Japanese Learners' Contrastive Speech Production Database:**
  có người học nhiều L1 và/hoặc đối chứng native, hữu ích để tìm candidate
  learner speech. Chúng không cung cấp sẵn nhãn lỗi phoneme chuẩn cho Model A,
  nên chỉ dùng sau khi đọc điều khoản/được cấp quyền.
  <https://www.ninjal.ac.jp/english/resources/search/>

## Form lỗi phát âm: nguyên tắc

Không yêu cầu sinh viên hoặc giáo viên “đoán IPA thực tế”. Form chỉ cho chấm
**một vị trí phoneme đã được chọn trước**. Đó là cách tạo nhãn có thể kiểm toán
và có ích cho A6.

1. Nghe toàn câu, sau đó replay vùng target nếu cần.
2. Chọn một mức: `correct`, `near_correct`, `incorrect`, `unscorable`.
3. Nếu không đúng, chọn một lỗi cơ học: thay âm, bỏ âm, thêm âm, quá ngắn,
   quá dài hoặc không rõ.
4. Chỉ khi chắc, chọn pattern gợi ý: `ts_to_ch`, `sokuon_deleted`,
   `long_vowel_shortened`, `r_to_l`, `nasal_confusion`… Không chắc thì để trống.
5. Đánh dấu chất lượng file, độ hiểu toàn câu và confidence của người chấm.

Form offline là [`../tools/pronunciation_annotation_form.html`](../tools/pronunciation_annotation_form.html).
Nó sinh lại **toàn bộ manifest row** với object `annotation` đã điền, nên file
JSON tải về có thể được thêm thành một dòng vào A5 JSONL. Người chấm không nhập
họ tên/email; `raterId` chỉ là mã ẩn danh như `rater_01`.

## Điều kiện nhận một batch native

- WAV đã chuẩn hoá 16 kHz mono nhưng giữ file nguồn riêng; không ghi đè.
- Có speaker ID và split theo speaker.
- G2P không có phone ngoài vocabulary Model A.
- Ít nhất 50 câu được nghe/kiểm tra ranh giới phoneme thủ công trước train.
- Tỷ lệ clipping/empty và transcript mismatch được ghi thành `excludedReason`,
  không âm thầm loại bỏ.
- Lưu `source`, URL/version, license scope và checksum ở manifest private.
