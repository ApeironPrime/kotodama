"""Digital Signal Processing (DSP) for F0 Pitch Extraction, Pitch Normalization, and DTW Alignment."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import fastdtw
import numpy as np
from scipy.spatial.distance import euclidean
import soundfile as sf


def yin_pitch_estimator(
    y: np.ndarray,
    sr: int = 16000,
    frame_length: int = 1024,
    hop_length: int = 160,  # 10ms at 16kHz
    fmin: float = 65.0,  # ~C2
    fmax: float = 800.0,  # ~G5
    trough_threshold: float = 0.15,
) -> tuple[np.ndarray, np.ndarray]:
    """Pure NumPy vectorized YIN fundamental frequency estimator."""
    min_period = int(sr / fmax)
    max_period = int(sr / fmin)
    num_frames = (len(y) - frame_length) // hop_length + 1

    if num_frames <= 0:
        return np.array([]), np.array([])

    f0 = np.zeros(num_frames, dtype=np.float64)
    voiced = np.zeros(num_frames, dtype=bool)

    # Frame energy (RMS)
    frame_rms = np.array([
        np.sqrt(np.mean(y[i * hop_length : i * hop_length + frame_length] ** 2))
        for i in range(num_frames)
    ])
    rms_threshold = max(0.005, float(np.mean(frame_rms)) * 0.15)

    for i in range(num_frames):
        if frame_rms[i] < rms_threshold:
            continue

        frame = y[i * hop_length : i * hop_length + frame_length]

        # Autocorrelation via correlate
        corr = np.correlate(frame, frame, mode="full")[len(frame) - 1 :]
        energy = np.sum(frame ** 2)

        # Difference function: d(tau) = 2 * energy - 2 * corr(tau)
        diff = 2.0 * energy - 2.0 * corr[: max_period + 1]
        diff = np.maximum(0.0, diff)

        # Cumulative mean normalized difference (CMND)
        cmnd = np.zeros(max_period + 1, dtype=np.float64)
        cmnd[0] = 1.0
        cumsum = 0.0
        for tau in range(1, max_period + 1):
            cumsum += diff[tau]
            cmnd[tau] = diff[tau] / (cumsum / tau) if cumsum > 0 else 1.0

        # Absolute thresholding & local minimum search
        period = 0
        for tau in range(min_period, max_period):
            if cmnd[tau] < trough_threshold:
                while tau + 1 < max_period and cmnd[tau + 1] < cmnd[tau]:
                    tau += 1
                period = tau
                break

        if period == 0:
            period = min_period + int(np.argmin(cmnd[min_period:max_period]))

        if period > 0 and cmnd[period] < 0.45:
            # Parabolic interpolation for sub-sample accuracy
            if 0 < period < max_period:
                alpha = cmnd[period - 1]
                beta = cmnd[period]
                gamma = cmnd[period + 1]
                denom = alpha - 2.0 * beta + gamma
                delta = 0.5 * (alpha - gamma) / (denom if abs(denom) > 1e-9 else 1e-9)
                refined_period = period + delta
            else:
                refined_period = float(period)

            pitch_hz = float(sr) / refined_period
            if fmin <= pitch_hz <= fmax:
                f0[i] = pitch_hz
                voiced[i] = True

    return f0, voiced


def extract_pitch_contour(
    audio_path: str | Path,
    sr: int = 16000,
    hop_length: int = 160,
    fmin: float = 65.0,
    fmax: float = 800.0,
) -> dict[str, Any]:
    """Load audio, resample, extract F0 and normalize to median-centered semitones."""
    data, actual_sr = sf.read(str(audio_path), dtype="float32")

    # Downmix stereo to mono
    if data.ndim > 1:
        data = np.mean(data, axis=1)

    # Simple resampling if needed
    if actual_sr != sr:
        num_samples = int(len(data) * float(sr) / float(actual_sr))
        data = np.interp(
            np.linspace(0, len(data), num_samples, endpoint=False),
            np.arange(len(data)),
            data,
        ).astype(np.float32)

    duration_s = float(len(data)) / float(sr)

    f0, voiced = yin_pitch_estimator(
        data,
        sr=sr,
        frame_length=1024,
        hop_length=hop_length,
        fmin=fmin,
        fmax=fmax,
    )

    valid_f0 = f0[voiced & (f0 > 0)]
    median_f0 = float(np.median(valid_f0)) if len(valid_f0) > 0 else 0.0
    mean_f0 = float(np.mean(valid_f0)) if len(valid_f0) > 0 else 0.0

    contour = []
    for i, (hz, is_voiced) in enumerate(zip(f0, voiced)):
        time_ms = int(round(float(i * hop_length) / float(sr) * 1000))
        if is_voiced and hz > 0 and median_f0 > 0:
            semitone = float(round(12.0 * math.log2(float(hz) / median_f0), 2))
            contour.append({
                "timeMs": time_ms,
                "f0Hz": float(round(float(hz), 1)),
                "semitone": semitone,
                "voiced": True,
            })
        else:
            contour.append({
                "timeMs": time_ms,
                "f0Hz": None,
                "semitone": None,
                "voiced": False,
            })

    return {
        "durationMs": int(round(duration_s * 1000)),
        "medianF0": round(median_f0, 1),
        "meanF0": round(mean_f0, 1),
        "voicedRatio": round(float(len(valid_f0)) / max(1, len(f0)), 3),
        "contour": contour,
    }


def compare_pitch_dtw(
    ref_data: dict[str, Any],
    user_data: dict[str, Any],
) -> dict[str, Any]:
    """Compare reference and user pitch contours using Dynamic Time Warping on semitone pitch curves."""
    ref_contour = ref_data.get("contour", [])
    user_contour = user_data.get("contour", [])

    ref_voiced = [p["semitone"] for p in ref_contour if p.get("voiced") and p.get("semitone") is not None]
    user_voiced = [p["semitone"] for p in user_contour if p.get("voiced") and p.get("semitone") is not None]

    ref_dur = ref_data.get("durationMs", 1)
    user_dur = user_data.get("durationMs", 1)

    # Duration / Rhythm score
    dur_ratio = float(user_dur) / max(1.0, float(ref_dur))
    if 0.85 <= dur_ratio <= 1.20:
        rhythm_score = 100
    else:
        diff = abs(dur_ratio - 1.0)
        rhythm_score = max(20, min(100, int(round(100.0 - diff * 80.0))))

    feedback_tips = []

    if len(user_voiced) < 3 or len(ref_voiced) < 3:
        pitch_score = 50
        feedback_tips.append("Âm lượng giọng đọc hơi nhỏ hoặc chưa rõ âm nguyên âm để trích xuất cao độ.")
        return {
            "pitchScore": pitch_score,
            "rhythmScore": rhythm_score,
            "durationRatio": round(dur_ratio, 2),
            "referenceContour": ref_contour,
            "userContour": user_contour,
            "feedbackTips": feedback_tips,
        }

    # Normalize voiced curves (Z-score to focus on relative shape & pitch modulation)
    ref_arr = np.array(ref_voiced, dtype=np.float64)
    user_arr = np.array(user_voiced, dtype=np.float64)

    ref_std = float(np.std(ref_arr))
    user_std = float(np.std(user_arr))

    if ref_std < 0.3 and user_std < 0.3:
        # Flat intonation on both sides: compare semitone differences directly
        semitone_diff = abs(float(np.mean(ref_arr)) - float(np.mean(user_arr)))
        raw_pitch_score = 100.0 * math.exp(-semitone_diff / 2.0)
        pitch_score = int(max(10, min(100, round(raw_pitch_score))))
    else:
        ref_norm = (ref_arr - np.mean(ref_arr)) / (ref_std if ref_std > 0.3 else 1.0)
        user_norm = (user_arr - np.mean(user_arr)) / (user_std if user_std > 0.3 else 1.0)

        # Compute DTW distance using scalar absolute difference
        distance, path = fastdtw.fastdtw(
            ref_norm, user_norm, dist=lambda a, b: abs(float(a) - float(b))
        )
        avg_distance = float(distance) / max(1, len(path))

        # Map average distance to 0-100 score
        raw_pitch_score = 100.0 * math.exp(-avg_distance / 1.35)
        pitch_score = int(max(10, min(100, round(raw_pitch_score))))

    # Pitch trend analysis (start vs end tone direction)
    if len(ref_voiced) >= 4 and len(user_voiced) >= 4:
        ref_end_diff = float(np.mean(ref_voiced[-3:]) - np.mean(ref_voiced[:3]))
        user_end_diff = float(np.mean(user_voiced[-3:]) - np.mean(user_voiced[:3]))

        if ref_end_diff > 1.8 and user_end_diff < 0.4:
            feedback_tips.append("Câu mẫu có xu hướng lên giọng rõ ở cuối câu, bạn nên nâng cao độ ở âm tiết cuối.")
        elif ref_end_diff < -1.8 and user_end_diff > 0.8:
            feedback_tips.append("Câu mẫu hạ giọng ở cuối câu, chú ý không lên giọng quá cao ở cuối.")
        elif pitch_score >= 80:
            feedback_tips.append("Đường cao độ và độ uốn lượn ngữ điệu rất chuẩn xác với câu mẫu.")

    if not feedback_tips:
        if pitch_score >= 80:
            feedback_tips.append("Ngữ điệu và cao độ bám sát câu gốc.")
        elif pitch_score >= 60:
            feedback_tips.append("Cao độ cơ bản ổn định, hãy chú ý các đoạn nhấn nhá theo diễn viên.")
        else:
            feedback_tips.append("Đường cao độ còn có sự chênh lệch so với câu mẫu, hãy nghe lại đoạn mẫu và thử lại.")

    return {
        "pitchScore": pitch_score,
        "rhythmScore": rhythm_score,
        "durationRatio": round(dur_ratio, 2),
        "referenceContour": ref_contour,
        "userContour": user_contour,
        "feedbackTips": feedback_tips,
    }
