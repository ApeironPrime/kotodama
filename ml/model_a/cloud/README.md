# Cloud train kit — Model A A7

Gói này chạy A7 trên **một** cloud workspace riêng: Kaggle, Lightning, RunPod
hoặc Vast. Không tạo nhiều tài khoản để vượt quota và không upload JVS vào
dataset/volume công khai.

## Chọn nơi chạy

1. **Kaggle**: thử nghiệm không tốn phí; quota GPU bị giới hạn theo tuần và
   session có thể bị ngắt. Phù hợp smoke run hoặc một fine-tune A7.
2. **Lightning AI**: thuận tiện nhất để làm đồ án lâu dài vì có workspace riêng,
   persistent storage và SSH/IDE. Dùng free credit nếu tài khoản được cấp.
3. **RunPod hoặc Vast**: dùng khi cần chắc chắn GPU 24 GB+ hoặc train nhiều
   experiment. Chỉ thuê instance có disk persistent, reliability tốt và tự tắt
   instance khi job hoàn tất.

Với A7 hiện tại, ưu tiên GPU 24 GB (RTX 4090, L4, A10/A5000...) và disk 30 GB:
batch 4 trong `acoustic_finetune_cloud_24gb.json` giữ effective batch size 8,
nhưng thường nhanh hơn laptop 6 GB. Hãy giảm batch về 2 nếu provider báo OOM.

## Quy tắc dữ liệu bắt buộc

- Clone source code từ repository private.
- JVS được tải trực tiếp từ nguồn chính thức vào persistent volume **private**.
- Không đưa raw JVS, archive, manifest đường dẫn thật, learner audio hay
  checkpoint lên GitHub/public Kaggle dataset/Drive chia sẻ công khai.
- Đọc `../docs/DATASET_LICENSE_MATRIX.md` trước. Script yêu cầu bạn đặt biến
  `KOTODAMA_ACCEPT_JVS_RESEARCH_TERMS=yes` một cách chủ động.

## Chạy trên GPU Linux

Trong thư mục repository clone trên cloud:

```bash
bash ml/model_a/cloud/bootstrap_gpu.sh "$PWD"
export KOTODAMA_ACCEPT_JVS_RESEARCH_TERMS=yes
bash ml/model_a/cloud/run_a7_jvs_cloud.sh "$PWD"
```

Lần đầu sẽ tải JVS khoảng 3.5 GB, giải nén, tạo subset private 60 speaker và
train. Checkpoint nằm trong `ml/model_a/artifacts/` của volume cloud.

## Kaggle nhanh nhất

1. Commit source rồi chạy `tools\package_kaggle_source.ps1`; script chỉ đóng
   gói file Git đã track nên không thể kéo theo `.env` hay raw data.
2. Tạo một **private** Kaggle Dataset từ zip đó, đặt tên `kotodama-source`.
3. Upload [kaggle_a7_private.ipynb](kaggle_a7_private.ipynb), add dataset trên
   vào notebook, bật Internet + GPU và chạy lần lượt các cell.
4. Chỉ tải file artifact ZIP ở cell cuối; không Save/Publish notebook kèm
   thư mục `/tmp` hoặc biến nó thành public output.

## Sau khi hoàn tất

Chỉ tải về máy local artifact `a7-jvs-ctc-cloud-v1` cùng `training-summary.json`
và log. Sau đó xoá instance/stop pod để dừng tính phí; storage của các provider
thường vẫn có phí dù GPU đã tắt.
