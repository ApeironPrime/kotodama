"""Local-only B5 FastAPI service for trusted Model A/B worker results."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from .b4_baseline import ProsodyTrainingError, load_baseline
from .shadowing_evaluation import ShadowingEvaluationError, evaluate_with_artifact


def create_app(model_dir: Path | None = None):
    try:
        from fastapi import FastAPI, HTTPException
    except ImportError as error:
        raise RuntimeError("FastAPI is required; install Model A requirements-train.txt in the Model B environment.") from error
    configured = model_dir or (Path(value) if (value := os.environ.get("KOTODAMA_B4_MODEL_DIR")) else None)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if configured is None:
            raise RuntimeError("Set KOTODAMA_B4_MODEL_DIR to a locally trained B4 artifact directory.")
        app.state.b4_artifact = load_baseline(configured)
        yield

    app = FastAPI(title="Kotodama Shadowing B5", version="0.1.0-baseline", lifespan=lifespan)

    @app.get("/healthz")
    async def healthz():
        return {"status": "ok", "modelB": app.state.b4_artifact["modelVersion"]}

    @app.post("/v1/shadowing/evaluate")
    async def evaluate(payload: dict):
        # The backend worker owns audio, A2/A4, and B2 generation. This public
        # boundary accepts their JSON only; never accept an artifact path from a request.
        try:
            model_a_score = payload.get("modelAScore")
            b2_evidence = payload.get("b2Evidence")
            if not isinstance(model_a_score, dict) or not isinstance(b2_evidence, dict):
                raise ShadowingEvaluationError("modelAScore and b2Evidence must be JSON objects.")
            return evaluate_with_artifact(model_a_score, b2_evidence, app.state.b4_artifact)
        except (ShadowingEvaluationError, ProsodyTrainingError) as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    return app


app = create_app()
