import os
import struct

path = r'public/audio/jlpt/jlpt-n3-2023-12.mp3'

# Read MP3 frame by frame and calculate time offset accurately
with open(path, 'rb') as f:
    data = f.read()

bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
samplerates = [44100, 48000, 32000, 0]

pos = 0
frame_idx = 0
frame_positions = [] # (second, byte_offset)

sample_rate = 44100

while pos < len(data) - 4:
    if data[pos] == 0xFF and (data[pos+1] & 0xE0) == 0xE0:
        version = (data[pos+1] >> 3) & 0x03
        layer = (data[pos+1] >> 1) & 0x03
        bitrate_idx = (data[pos+2] >> 4) & 0x0F
        sr_idx = (data[pos+2] >> 2) & 0x03
        padding = (data[pos+2] >> 1) & 0x01
        
        if version == 3 and layer == 1 and bitrate_idx in range(1, 15) and sr_idx in range(3):
            br = bitrates[bitrate_idx] * 1000
            sr = samplerates[sr_idx]
            frame_len = int((144 * br / sr) + padding)
            if frame_len > 0:
                sec = frame_idx * 1152 / sr
                frame_positions.append((sec, pos, frame_len))
                frame_idx += 1
                pos += frame_len
                continue
    pos += 1

total_sec = frame_positions[-1][0] if frame_positions else 0
print(f"Total parsed seconds: {total_sec:.2f}s ({int(total_sec//60)}m {int(total_sec%60)}s)")

# Helper to extract an mp3 slice between startSec and endSec
def extract_slice(start_sec, end_sec, out_path):
    start_pos = None
    end_pos = None
    for sec, pos, flen in frame_positions:
        if start_pos is None and sec >= start_sec:
            start_pos = pos
        if sec >= end_sec:
            end_pos = pos + flen
            break
    if start_pos is not None and end_pos is not None:
        with open(out_path, 'wb') as f:
            f.write(data[start_pos:end_pos])
        print(f"Extracted slice [{start_sec}s -> {end_sec}s] to {out_path} ({len(data[start_pos:end_pos])} bytes)")

# Let's extract 150s-200s (Câu 1) to test
os.makedirs('scratch', exist_ok=True)
extract_slice(150, 200, 'scratch/q1_test.mp3')
extract_slice(0, 60, 'scratch/intro.mp3')
