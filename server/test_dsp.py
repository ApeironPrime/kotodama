import os
import sys
import numpy as np
import soundfile as sf
import tempfile

sys.modules["coverage"] = None
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsp_service import extract_pitch_contour, compare_pitch_dtw

def test_dsp():
    # Generate 1 second of 220Hz (A3) and 230Hz sine waves
    sr = 16000
    t = np.linspace(0, 1, sr, endpoint=False)
    y1 = 0.5 * np.sin(2 * np.pi * 220 * t)
    y2 = 0.5 * np.sin(2 * np.pi * 230 * t)

    tmp_dir = tempfile.mkdtemp()
    f1 = os.path.join(tmp_dir, "ref.wav")
    f2 = os.path.join(tmp_dir, "user.wav")

    sf.write(f1, y1, sr)
    sf.write(f2, y2, sr)

    try:
        d1 = extract_pitch_contour(f1)
        d2 = extract_pitch_contour(f2)

        assert d1["medianF0"] > 210 and d1["medianF0"] < 230, f"Expected ~220Hz, got {d1['medianF0']}"
        assert d2["medianF0"] > 220 and d2["medianF0"] < 240, f"Expected ~230Hz, got {d2['medianF0']}"
        assert len(d1["contour"]) > 50, "Expected at least 50 contour points"

        cmp = compare_pitch_dtw(d1, d2)
        assert cmp["pitchScore"] >= 80, f"Expected high pitch similarity score, got {cmp['pitchScore']}"
        assert cmp["rhythmScore"] == 100, f"Expected 100 rhythm score, got {cmp['rhythmScore']}"
        print("ALL DSP TESTS PASSED!")
        print(f"Ref Median F0: {d1['medianF0']} Hz | User Median F0: {d2['medianF0']} Hz")
        print(f"Pitch Score: {cmp['pitchScore']} | Rhythm Score: {cmp['rhythmScore']}")
        print(f"Contour points: {len(cmp['referenceContour'])}")
    finally:
        if os.path.exists(f1): os.remove(f1)
        if os.path.exists(f2): os.remove(f2)
        os.rmdir(tmp_dir)

if __name__ == "__main__":
    test_dsp()
