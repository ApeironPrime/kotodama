"""Local FastAPI service exposing the conservative A7 pronunciation score contract."""

from __future__ import annotations

import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from .audio import AudioPreparationError, inspect_wav, prepare_audio, validate_model_audio
from .calibrated_scoring import CalibratedScoringError, load_calibrated_classifier, score_calibrated_payload
from .inference import run_rule_baseline
from .phoneme_model import JapanesePhonemeRecognizer
from .pronunciation_scoring import score_rule_payload


MAX_UPLOAD_BYTES = 32 * 1024 * 1024


def create_app():
    try:
        from fastapi import FastAPI, File, Form, HTTPException, UploadFile
    except ImportError as error:
        raise RuntimeError("FastAPI is required; install requirements-train.txt.") from error

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.recognizer = JapanesePhonemeRecognizer()
        artifact_path = os.environ.get("KOTODAMA_A6_MODEL_DIR")
        app.state.calibrated_classifier = load_calibrated_classifier(Path(artifact_path)) if artifact_path else None
        yield

    app = FastAPI(title="Kotodama Model A", version="0.1.0-baseline", lifespan=lifespan)

    @app.get("/healthz")
    async def healthz():
        return {
            "status": "ok",
            "model": "lazy",
            "scoringMode": "a6_calibrated_classifier" if app.state.calibrated_classifier else "baseline_heuristic_not_calibrated",
        }

    @app.post("/v1/pronunciation/score")
    async def score_pronunciation(
        audio: UploadFile = File(...),
        expected_text: str = Form(..., alias="expectedText"),
        sentence_id: str | None = Form(None, alias="sentenceId"),
    ):
        if not expected_text.strip():
            raise HTTPException(status_code=422, detail="expectedText must not be empty.")
        suffix = Path(audio.filename or "audio.wav").suffix.lower() or ".bin"
        try:
            content = await audio.read(MAX_UPLOAD_BYTES + 1)
            if len(content) > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Audio exceeds the 32 MB local scoring limit.")
            with tempfile.TemporaryDirectory(prefix="kotodama-score-") as directory:
                source = Path(directory) / f"input{suffix}"
                source.write_bytes(content)
                prepared = Path(directory) / "prepared.wav"
                try:
                    info = inspect_wav(source)
                    validate_model_audio(info, max_seconds=10)
                    audio_path = source
                except AudioPreparationError:
                    prepare_audio(source, prepared)
                    validate_model_audio(inspect_wav(prepared), max_seconds=10)
                    audio_path = prepared
                payload = run_rule_baseline(audio_path, expected_text, recognizer=app.state.recognizer)
                if app.state.calibrated_classifier:
                    return score_calibrated_payload(payload, app.state.calibrated_classifier, sentence_id=sentence_id)
                return score_rule_payload(payload, sentence_id=sentence_id)
        except HTTPException:
            raise
        except AudioPreparationError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except CalibratedScoringError as error:
            raise HTTPException(status_code=500, detail="Calibrated pronunciation scoring failed locally.") from error
        except Exception as error:
            raise HTTPException(status_code=500, detail="Pronunciation scoring failed locally.") from error

    return app


app = create_app()
