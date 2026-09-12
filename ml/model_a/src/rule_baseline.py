"""Explainable A4 pronunciation-review rules built on A3 GOP evidence.

These rules are deliberately conservative diagnostic hints. They exist to
validate the feature pipeline and to support an early UI, not to replace a
calibrated learner-error classifier.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Literal

from .gop import AudioQualityEstimate, GopAnalysis, PhonemeGopEvidence


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RULE_CONFIG_PATH = PROJECT_ROOT / "configs" / "rule_baseline.json"

Severity = Literal["review", "warning"]


@dataclass(frozen=True)
class RuleConfig:
    version: str
    max_clipping_ratio: float
    min_estimated_snr_db: float
    ts_phone: str
    ts_competitor: str
    ts_max_gop: float
    ts_max_posterior_margin: float
    sokuon_phone: str
    sokuon_max_gop: float
    sokuon_max_duration_ms: float
    vowels: frozenset[str]
    minimum_reference_vowels: int
    long_vowel_min_relative_duration: float


@dataclass(frozen=True)
class RuleFinding:
    """An explainable signal for review, rather than a final diagnosis."""

    code: str
    category: Literal["phoneme_confusion", "timing", "audio_quality"]
    severity: Severity
    message: str
    phoneme_indices: tuple[int, ...]
    evidence: dict[str, float | str | None]


@dataclass(frozen=True)
class RuleAnalysis:
    ruleset_version: str
    findings: tuple[RuleFinding, ...]


def load_rule_config(path: Path | None = None) -> RuleConfig:
    """Load thresholds from checked-in JSON, so calibration changes need no code edit."""
    payload = json.loads((path or DEFAULT_RULE_CONFIG_PATH).read_text(encoding="utf-8"))
    audio_quality = payload["audioQuality"]
    ts_to_ch = payload["tsToCh"]
    sokuon = payload["sokuon"]
    long_vowel = payload["longVowel"]
    return RuleConfig(
        version=str(payload["version"]),
        max_clipping_ratio=float(audio_quality["maxClippingRatio"]),
        min_estimated_snr_db=float(audio_quality["minEstimatedSnrDb"]),
        ts_phone=str(ts_to_ch["expectedPhone"]),
        ts_competitor=str(ts_to_ch["competitorPhone"]),
        ts_max_gop=float(ts_to_ch["maxGop"]),
        ts_max_posterior_margin=float(ts_to_ch["maxPosteriorMargin"]),
        sokuon_phone=str(sokuon["expectedPhone"]),
        sokuon_max_gop=float(sokuon["maxGop"]),
        sokuon_max_duration_ms=float(sokuon["maxDurationMs"]),
        vowels=frozenset(str(phone) for phone in long_vowel["vowels"]),
        minimum_reference_vowels=int(long_vowel["minimumReferenceVowels"]),
        long_vowel_min_relative_duration=float(long_vowel["minRelativeDuration"]),
    )


def _finding(
    code: str,
    category: Literal["phoneme_confusion", "timing", "audio_quality"],
    severity: Severity,
    message: str,
    phoneme_indices: tuple[int, ...],
    **evidence: float | str | None,
) -> RuleFinding:
    return RuleFinding(code, category, severity, message, phoneme_indices, evidence)


def _detect_audio_quality(quality: AudioQualityEstimate, config: RuleConfig) -> list[RuleFinding]:
    findings: list[RuleFinding] = []
    if quality.clipping_ratio > config.max_clipping_ratio:
        findings.append(
            _finding(
                "audio_clipping",
                "audio_quality",
                "warning",
                "Bản ghi bị clipping; hãy ghi lại trước khi tin vào đánh giá phát âm.",
                (),
                clippingRatio=quality.clipping_ratio,
                maxClippingRatio=config.max_clipping_ratio,
            )
        )
    if quality.estimated_snr_db is not None and quality.estimated_snr_db < config.min_estimated_snr_db:
        findings.append(
            _finding(
                "low_estimated_snr",
                "audio_quality",
                "review",
                "Tín hiệu giọng nói có vẻ lẫn nhiều im lặng hoặc nhiễu; đánh giá âm vị có thể kém ổn định.",
                (),
                estimatedSnrDb=quality.estimated_snr_db,
                minEstimatedSnrDb=config.min_estimated_snr_db,
            )
        )
    return findings


def _detect_ts_to_ch(item: PhonemeGopEvidence, config: RuleConfig) -> RuleFinding | None:
    if (
        item.expected_phone == config.ts_phone
        and item.best_competitor == config.ts_competitor
        and item.gop <= config.ts_max_gop
        and item.posterior_margin <= config.ts_max_posterior_margin
    ):
        return _finding(
            "ts_may_be_ch",
            "phoneme_confusion",
            "review",
            "Có dấu hiệu つ (ts) được nhận gần với ち/chu (ch); nghe lại đoạn này để xác nhận.",
            (item.position_in_sentence,),
            expectedPhone=item.expected_phone,
            bestCompetitor=item.best_competitor,
            gop=item.gop,
            posteriorMargin=item.posterior_margin,
        )
    return None


def _detect_sokuon(item: PhonemeGopEvidence, config: RuleConfig) -> RuleFinding | None:
    # One 20 ms CTC frame is not itself an error. We only flag a very short
    # closure when the model simultaneously prefers another phoneme.
    if (
        item.expected_phone == config.sokuon_phone
        and item.duration_ms <= config.sokuon_max_duration_ms
        and item.gop <= config.sokuon_max_gop
        and item.top1_phone != config.sokuon_phone
    ):
        return _finding(
            "sokuon_may_be_omitted",
            "timing",
            "review",
            "Âm ngắt っ (cl) rất ngắn và model nghiêng về âm khác; có thể bạn đã lướt qua âm ngắt.",
            (item.position_in_sentence,),
            expectedPhone=item.expected_phone,
            top1Phone=item.top1_phone,
            gop=item.gop,
            durationMs=item.duration_ms,
        )
    return None


def _detect_long_vowels(items: tuple[PhonemeGopEvidence, ...], config: RuleConfig) -> list[RuleFinding]:
    """Compare an adjacent same-vowel pair with ordinary vowels in this sentence.

    This relative check is intentionally only a review signal. A calibrated
    native-duration distribution will replace it once the reference corpus is
    prepared.
    """
    ordinary_vowel_durations = [
        item.duration_ms
        for index, item in enumerate(items)
        if item.expected_phone in config.vowels
        and not (
            index > 0 and items[index - 1].expected_phone == item.expected_phone
        )
        and not (
            index + 1 < len(items) and items[index + 1].expected_phone == item.expected_phone
        )
    ]
    if len(ordinary_vowel_durations) < config.minimum_reference_vowels:
        return []
    reference_duration = float(median(ordinary_vowel_durations))
    findings: list[RuleFinding] = []
    for index in range(len(items) - 1):
        current, following = items[index], items[index + 1]
        if current.expected_phone not in config.vowels or current.expected_phone != following.expected_phone:
            continue
        combined_duration = current.duration_ms + following.duration_ms
        relative_duration = combined_duration / reference_duration if reference_duration else 0.0
        if relative_duration < config.long_vowel_min_relative_duration:
            findings.append(
                _finding(
                    "long_vowel_may_be_short",
                    "timing",
                    "review",
                    "Nguyên âm trường có thể bị rút ngắn; hãy giữ nguyên âm dài hơn một mora thường.",
                    (current.position_in_sentence, following.position_in_sentence),
                    expectedPhone=current.expected_phone,
                    combinedDurationMs=round(combined_duration, 3),
                    referenceVowelDurationMs=round(reference_duration, 3),
                    relativeDuration=round(relative_duration, 6),
                )
            )
    return findings


def detect_baseline_findings(
    gop: GopAnalysis,
    audio_quality: AudioQualityEstimate,
    *,
    config: RuleConfig | None = None,
) -> RuleAnalysis:
    """Apply all A4 rules and return only explainable review findings."""
    rules = config or load_rule_config()
    findings = _detect_audio_quality(audio_quality, rules)
    for item in gop.phonemes:
        ts_to_ch = _detect_ts_to_ch(item, rules)
        sokuon = _detect_sokuon(item, rules)
        if ts_to_ch is not None:
            findings.append(ts_to_ch)
        if sokuon is not None:
            findings.append(sokuon)
    findings.extend(_detect_long_vowels(gop.phonemes, rules))
    return RuleAnalysis(ruleset_version=rules.version, findings=tuple(findings))
