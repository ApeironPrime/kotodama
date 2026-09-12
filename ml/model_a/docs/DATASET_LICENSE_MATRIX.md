# Nguồn dữ liệu Model A — registry giấy phép

Registry này là cổng trước khi dữ liệu đi vào Model A. Giấy phép của **audio**,
transcript, tag và code phải được xem riêng; một GitHub repository chứa script
không tự động cấp quyền dùng audio mà script nhắc đến.

| Nguồn | Quyền dùng cho Model A | Có thể dùng cho đồ án hiện tại? | Điều kiện bắt buộc |
| --- | --- | --- | --- |
| Common Voice Scripted Speech Japanese 26.0 | CC0-1.0; có thể dùng cả thương mại | Có | Chỉ tải từ Mozilla Data Collective; không cố nhận diện người nói và không re-host/re-share dataset. |
| JVS audio | Academic research, non-commercial research, personal use; không được redistribute | Có | Chỉ lưu private, chỉ dùng nghiên cứu/đồ án; không đẩy audio, manifest chứa đường dẫn hay checkpoint có rủi ro license lên Git. Nếu thương mại phải xin phép chủ sở hữu. |
| `Hiroshiba/jvs_hiho` | Script MIT; text/phoneme labels CC BY-SA 4.0 | Có, bổ trợ JVS private | Ghi attribution, giữ nghĩa vụ CC BY-SA cho phần labels; repo này **không cấp quyền JVS audio**. |
| CSJ (NINJAL) | Có thủ tục/thoả thuận; thương mại xét riêng | Chưa tự tải | Chỉ dùng sau khi đăng ký và đọc đúng hợp đồng áp dụng cho sinh viên/đồ án. Không đưa vào pipeline tự động. |
| NUCC | CC BY-NC-ND 4.0 | Không đưa vào train lúc này | “ND” làm tình trạng fine-tune/weights không rõ; xin phép bằng văn bản trước thay vì suy diễn. |
| Video/nhạc YouTube, anime, web scrape, dataset GitHub không có data card/license audio | Không rõ hoặc không có quyền train | Không | Không dùng cho training, dù chạy local hoặc không kiếm tiền. Chỉ có URL GitHub không phải là license. |

## Chọn nguồn cho từng mục tiêu

- **A7 CTC acoustic adaptation:** bắt đầu với JVS `parallel100` (audio studio,
  nhiều speaker, phù hợp đồ án non-commercial). Có thể thêm Common Voice
  `validated.tsv` sau khi lọc để tăng độ đa dạng môi trường/micro.
- **A6 lỗi phát âm người Việt:** không nguồn public nào ở trên thay được nhãn
  `correct/near_correct/incorrect` của người Việt. Phải thu consent riêng và
  để người chấm gán nhãn; native corpus chỉ dạy âm chuẩn, không dạy lỗi người
  học.
- **B1/B4 prosody reference:** JVS là reference sạch tốt; Common Voice không
  đảm bảo cùng câu native reference cho từng learner, nên chỉ là dữ liệu phụ.

## Provenance bắt buộc

Mỗi lần lấy nguồn mới, lưu private: URL chính thức, version, ngày tải, hash
archive, license, người chịu trách nhiệm, subset đã dùng và checkpoint nào chịu
ảnh hưởng. Không commit raw audio, TSV có `client_id`, hay archive vào repo.

Nguồn chính thức: [JVS terms and download](https://sites.google.com/site/shinnosuketakamichi/research-topics/jvs_corpus), [Common Voice Japanese 26.0](https://mozilladatacollective.com/datasets/cmqim4lxy00tunr07cjkcupeg), [CSJ overview](https://clrd.ninjal.ac.jp/csj/en/), [NUCC license](https://mmsrv.ninjal.ac.jp/nucc/en/index.html), [JVS label repository](https://github.com/Hiroshiba/jvs_hiho).
