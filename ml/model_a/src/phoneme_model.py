"""Lazy loading and inference for the pretrained Japanese phoneme CTC baseline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

import numpy as np

from .audio import AudioPreparationError, load_waveform, validate_model_audio, inspect_wav
from .config import BaselineConfig, load_config


class PhonemeModelError(RuntimeError):
    """Raised when the CTC baseline cannot run."""


@dataclass(frozen=True)
class PhonemePrediction:
    model_id: str
    device: str
    phonemes: tuple[str, ...]
    frame_count: int
    frame_duration_ms: float
    duration_ms: float

    @property
    def joined(self) -> str:
        return " ".join(self.phonemes)


@dataclass(frozen=True)
class CtcEmission:
    """Frame-level CTC output kept for A2 forced alignment."""

    model_id: str
    device: str
    log_probabilities: np.ndarray
    token_to_id: Mapping[str, int]
    blank_id: int
    special_token_ids: frozenset[int]
    frame_count: int
    duration_ms: float

    @property
    def frame_duration_ms(self) -> float:
        return self.duration_ms / self.frame_count


class JapanesePhonemeRecognizer:
    """Pretrained CTC model kept separate from the application API process."""

    def __init__(self, config: BaselineConfig | None = None, *, device: str | None = None):
        self.config = config or load_config()
        self.requested_device = device or self.config.preferred_device
        self._processor = None
        self._model = None
        self._torch = None
        self._device = None

    def _load(self) -> None:
        if self._model is not None:
            return
        try:
            import torch
            from transformers import AutoModelForCTC, AutoProcessor
        except ImportError as error:
            raise PhonemeModelError("torch and transformers are required; install Model A requirements.") from error

        selected_device = self.requested_device
        if selected_device == "cuda" and not torch.cuda.is_available():
            selected_device = "cpu"
        self._processor = AutoProcessor.from_pretrained(self.config.model_id)
        self._model = AutoModelForCTC.from_pretrained(self.config.model_id)
        self._model.to(selected_device)
        self._model.eval()
        self._torch = torch
        self._device = selected_device

    def emissions(self, audio_path: Path) -> CtcEmission:
        """Run the acoustic model and retain its log-softmax frame emissions."""
        info = inspect_wav(audio_path)
        validate_model_audio(info, max_seconds=self.config.max_audio_seconds)
        waveform = load_waveform(audio_path, target_sample_rate=self.config.sample_rate)
        self._load()
        assert self._processor is not None
        assert self._model is not None
        assert self._torch is not None
        assert self._device is not None
        inputs = self._processor(
            waveform,
            sampling_rate=self.config.sample_rate,
            return_tensors="pt",
            padding=False,
        )
        input_values = inputs.input_values.to(self._device)
        with self._torch.inference_mode():
            logits = self._model(input_values).logits
        log_probabilities = self._torch.log_softmax(logits, dim=-1).squeeze(0).float().cpu().numpy()
        blank_id = self._model.config.pad_token_id
        if blank_id is None:
            raise PhonemeModelError("The CTC model does not declare a blank/PAD token ID.")
        token_to_id = {str(token): int(token_id) for token, token_id in self._processor.tokenizer.get_vocab().items()}
        return CtcEmission(
            model_id=self.config.model_id,
            device=self._device,
            log_probabilities=log_probabilities,
            token_to_id=token_to_id,
            blank_id=int(blank_id),
            special_token_ids=frozenset(int(token_id) for token_id in self._processor.tokenizer.all_special_ids),
            frame_count=int(logits.shape[1]),
            duration_ms=info.duration_seconds * 1000,
        )

    def decode_emissions(self, emissions: CtcEmission) -> PhonemePrediction:
        """Greedily decode CTC emissions while preserving token boundaries."""
        self._load()
        assert self._processor is not None
        predicted_ids = emissions.log_probabilities.argmax(axis=-1)
        # This model's vocabulary is made of variable-length phoneme symbols
        # (`sh`, `ky`, `cl`, ...). Ask the processor to retain token boundaries;
        # otherwise a sequence such as `k a N` is returned as `kaN` and cannot
        # be validated or aligned in A2.
        decoded = self._processor.decode(
            predicted_ids.tolist(),
            spaces_between_special_tokens=True,
        ).strip()
        phonemes = tuple(phone for phone in decoded.split() if phone)
        if not phonemes:
            raise PhonemeModelError("The phoneme model produced an empty result; use clearer speech or inspect the input audio.")
        unknown = sorted(set(phonemes) - self.config.reference_vocabulary)
        if unknown:
            raise PhonemeModelError(
                "The baseline decoder emitted phones outside its configured vocabulary: " + ", ".join(unknown)
            )
        return PhonemePrediction(
            model_id=emissions.model_id,
            device=emissions.device,
            phonemes=phonemes,
            frame_count=emissions.frame_count,
            frame_duration_ms=emissions.frame_duration_ms,
            duration_ms=emissions.duration_ms,
        )

    def predict(self, audio_path: Path) -> PhonemePrediction:
        """Run greedy CTC decoding; use ``emissions`` when alignment is needed."""
        return self.decode_emissions(self.emissions(audio_path))
