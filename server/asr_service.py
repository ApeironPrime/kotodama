"""Local Japanese ASR service with word-level timestamps.

Run with:
  python -m uvicorn asr_service:app --app-dir server --host 127.0.0.1 --port 8788

The Node media worker sends extracted audio chunks to this service. The model
remains loaded in GPU memory between requests, unlike a per-job CLI process.
"""

from __future__ import annotations

import os
import shutil
import site
import sys
import tempfile
import types
from pathlib import Path
from typing import Any

# Polyfill _multiprocessing on Windows if blocked by App Control
if "_multiprocessing" not in sys.modules:
    try:
        import _multiprocessing
    except Exception:
        mock_mp = types.ModuleType("_multiprocessing")
        mock_mp.closesocket = lambda *args: None
        mock_mp.send = lambda *args: None
        mock_mp.recv = lambda *args: b""
        mock_mp.pipe = lambda: (0, 1)
        mock_mp.SemLock = type("SemLock", (), {})
        sys.modules["_multiprocessing"] = mock_mp

# Prevent Numba from trying to import the Vitest coverage/ directory as a python package
sys.modules["coverage"] = None

from fastapi import FastAPI, File, Form, HTTPException, UploadFile


_dll_directories = []


def configure_cuda_dll_paths() -> None:
    """Expose CUDA/cuDNN wheels to CTranslate2 on Windows without system PATH edits."""
    if os.name != "nt":
        return
    for package_root in site.getsitepackages():
        for package_name in ("cublas", "cudnn", "cuda_nvrtc"):
            dll_path = Path(package_root) / "nvidia" / package_name / "bin"
            if dll_path.is_dir():
                _dll_directories.append(os.add_dll_directory(str(dll_path)))
                os.environ["PATH"] = f"{dll_path}{os.pathsep}{os.environ.get('PATH', '')}"


configure_cuda_dll_paths()

from faster_whisper import WhisperModel

app = FastAPI(title="Kotodama local ASR", version="1.0")
_model: WhisperModel | None = None


def model_settings() -> tuple[str, str, str]:
    model_name = os.getenv("LOCAL_ASR_MODEL", "large-v3")
    device = os.getenv("LOCAL_ASR_DEVICE", "cuda")
    compute_type = os.getenv("LOCAL_ASR_COMPUTE_TYPE", "float16")
    return model_name, device, compute_type


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        model_name, device, compute_type = model_settings()
        try:
            _model = WhisperModel(model_name, device=device, compute_type=compute_type)
        except Exception as cuda_error:
            if device != "cpu":
                import logging
                logging.warning(f"CUDA model load failed ({cuda_error}), falling back to CPU with int8")
                _model = WhisperModel(model_name, device="cpu", compute_type="int8")
            else:
                raise
    return _model


def transcribe_with_vad_fallback(audio_path: str, prompt: str | None = None):
    """Transcribe audio with word-level timestamps, ensuring full coverage of singing and speech."""
    base_options = {
        "language": "ja",
        "task": "transcribe",
        "beam_size": 5,
        "word_timestamps": True,
        "condition_on_previous_text": False,
        "vad_parameters": dict(
            threshold=0.3,
            min_speech_duration_ms=50,
            min_silence_duration_ms=200,
            speech_pad_ms=100,
        ),
    }
    if prompt:
        base_options["initial_prompt"] = prompt

    def _run_transcribe():
        segments, info = get_model().transcribe(audio_path, vad_filter=True, **base_options)
        materialized_segments = list(segments)
        # If VAD dropped too much audio (e.g. less than 1 segment per 20 seconds of audio), retry without VAD
        expected_min_segments = max(4, int(info.duration / 15)) if info and info.duration else 4
        if materialized_segments and len(materialized_segments) >= expected_min_segments:
            return materialized_segments, info
        retry_options = {k: v for k, v in base_options.items() if k != "vad_parameters"}
        retry_segments, retry_info = get_model().transcribe(audio_path, vad_filter=False, **retry_options)
        return list(retry_segments), retry_info
        return list(retry_segments), retry_info

    try:
        return _run_transcribe()
    except (RuntimeError, OSError) as cuda_err:
        err_msg = str(cuda_err).lower()
        if "cublas" in err_msg or "cuda" in err_msg or "cudnn" in err_msg or "dll" in err_msg:
            import logging
            logging.warning(f"CUDA runtime error during inference ({cuda_err}), reloading model on CPU")
            global _model
            _model = None
            os.environ["LOCAL_ASR_DEVICE"] = "cpu"
            os.environ["LOCAL_ASR_COMPUTE_TYPE"] = "int8"
            return _run_transcribe()
        raise


@app.get("/health")
def health() -> dict[str, Any]:
    model_name, device, compute_type = model_settings()
    return {"status": "ok", "loaded": _model is not None, "model": model_name, "device": device, "computeType": compute_type}


@app.post("/v1/transcribe/japanese")
async def transcribe_japanese(
    file: UploadFile = File(...),
    prompt: str | None = Form(None),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=422, detail="Audio file is required.")

    suffix = Path(file.filename).suffix or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        shutil.copyfileobj(file.file, temporary)

    try:
        try:
            segments, info = transcribe_with_vad_fallback(str(temporary_path), prompt=prompt)
        except Exception as error:
            raise HTTPException(
                status_code=502,
                detail=f"Local ASR inference failed: {type(error).__name__}: {str(error)[:400]}",
            ) from error
        try:
            result = []
            for segment in segments:
                words = [
                    {
                        "word": word.word.strip(),
                        "start": word.start,
                        "end": word.end,
                        "probability": word.probability,
                    }
                    for word in (segment.words or [])
                    if word.word and word.start is not None and word.end is not None and word.end > word.start
                ]
                text = segment.text.strip()
                if text and segment.end > segment.start:
                    result.append({"start": segment.start, "end": segment.end, "text": text, "words": words})
            return {"language": info.language, "duration": info.duration, "segments": result}
        except Exception as error:
            raise HTTPException(
                status_code=502,
                detail=f"Local ASR inference failed: {type(error).__name__}: {str(error)[:400]}",
            ) from error
    finally:
        temporary_path.unlink(missing_ok=True)


from dsp_service import extract_pitch_contour, compare_pitch_dtw


@app.post("/v1/dsp/extract-pitch")
async def dsp_extract_pitch(
    file: UploadFile = File(...),
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=422, detail="Audio file is required.")

    suffix = Path(file.filename).suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        shutil.copyfileobj(file.file, temporary)

    try:
        return extract_pitch_contour(temporary_path)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"DSP pitch extraction failed: {type(error).__name__}: {str(error)[:400]}",
        ) from error
    finally:
        temporary_path.unlink(missing_ok=True)


@app.post("/v1/dsp/compare")
async def dsp_compare_pitch(
    reference_file: UploadFile = File(...),
    user_file: UploadFile = File(...),
) -> dict[str, Any]:
    if not reference_file.filename or not user_file.filename:
        raise HTTPException(status_code=422, detail="Both reference and user audio files are required.")

    ref_suffix = Path(reference_file.filename).suffix or ".wav"
    user_suffix = Path(user_file.filename).suffix or ".wav"

    with tempfile.NamedTemporaryFile(suffix=ref_suffix, delete=False) as ref_temp:
        ref_path = Path(ref_temp.name)
        shutil.copyfileobj(reference_file.file, ref_temp)

    with tempfile.NamedTemporaryFile(suffix=user_suffix, delete=False) as user_temp:
        user_path = Path(user_temp.name)
        shutil.copyfileobj(user_file.file, user_temp)

    try:
        ref_data = extract_pitch_contour(ref_path)
        user_data = extract_pitch_contour(user_path)
        return compare_pitch_dtw(ref_data, user_data)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"DSP comparison failed: {type(error).__name__}: {str(error)[:400]}",
        ) from error
    finally:
        ref_path.unlink(missing_ok=True)
        user_path.unlink(missing_ok=True)

