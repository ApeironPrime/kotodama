"""Configuration loading for the Model A baseline."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "baseline.json"


@dataclass(frozen=True)
class BaselineConfig:
    model_id: str
    sample_rate: int
    max_audio_seconds: float
    preferred_device: str
    reference_vocabulary: frozenset[str]


def load_config(path: Path | None = None) -> BaselineConfig:
    """Load the checked-in baseline configuration without hidden defaults."""
    config_path = path or DEFAULT_CONFIG_PATH
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    return BaselineConfig(
        model_id=str(payload["modelId"]),
        sample_rate=int(payload["sampleRate"]),
        max_audio_seconds=float(payload["maxAudioSeconds"]),
        preferred_device=str(payload["preferredDevice"]),
        reference_vocabulary=frozenset(str(phone) for phone in payload["referenceVocabulary"]),
    )
