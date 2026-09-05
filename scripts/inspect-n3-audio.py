import os
import sys
import struct

path = r'D:\VKU\data\drive-download-20260828T102340Z-1-002\14. Nghe N3 T12-2023.mp3'

if not os.path.exists(path):
    print("File not found:", path)
    sys.exit(1)

size = os.path.getsize(path)
print(f"File: {path}")
print(f"Size: {size} bytes ({size / 1024 / 1024:.2f} MB)")

# Calculate MP3 duration from frame headers
bitrates_v1_l3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
samplerates_v1 = [44100, 48000, 32000, 0]

with open(path, 'rb') as f:
    data = f.read()

# Scan for sync word 0xFFE / 0xFFF
pos = 0
frame_count = 0
total_duration = 0.0
sample_rate = 44100
bitrate = 128

while pos < len(data) - 4:
    if data[pos] == 0xFF and (data[pos+1] & 0xE0) == 0xE0:
        # MP3 frame
        version = (data[pos+1] >> 3) & 0x03 # 3 = MPEG1
        layer = (data[pos+1] >> 1) & 0x03   # 1 = Layer 3
        bitrate_idx = (data[pos+2] >> 4) & 0x0F
        sr_idx = (data[pos+2] >> 2) & 0x03
        padding = (data[pos+2] >> 1) & 0x01
        
        if version == 3 and layer == 1 and bitrate_idx in range(1, 15) and sr_idx in range(3):
            br = bitrates_v1_l3[bitrate_idx] * 1000
            sr = samplerates_v1[sr_idx]
            frame_len = int((144 * br / sr) + padding)
            if frame_len > 0:
                frame_count += 1
                sample_rate = sr
                bitrate = br // 1000
                pos += frame_len
                continue
    pos += 1

total_duration_sec = frame_count * 1152 / sample_rate if sample_rate else 0
print(f"Sample Rate: {sample_rate} Hz, Bitrate: ~{bitrate} kbps")
print(f"Total Frames: {frame_count}")
print(f"Total Duration: {total_duration_sec:.2f} s ({int(total_duration_sec // 60)}m {int(total_duration_sec % 60)}s)")
