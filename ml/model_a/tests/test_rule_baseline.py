from src.gop import AudioQualityEstimate, GopAnalysis, PhonemeGopEvidence
from src.rule_baseline import detect_baseline_findings, load_rule_config


def _phone(
    expected: str,
    index: int,
    *,
    top1: str | None = None,
    competitor: str | None = None,
    gop: float = 1.0,
    margin: float = 0.2,
    duration: float = 60.0,
) -> PhonemeGopEvidence:
    return PhonemeGopEvidence(
        expected_phone=expected,
        expected_token_id=index + 4,
        position_in_sentence=index,
        previous_phone=None,
        next_phone=None,
        start_ms=index * 60.0,
        end_ms=(index + 1) * 60.0,
        duration_ms=duration,
        duration_ratio=None,
        top1_phone=top1 or expected,
        top2_phone=None,
        best_competitor=competitor or "a",
        gop=gop,
        expected_log_probability=-0.2,
        competitor_log_probability=-1.0,
        expected_probability=0.7,
        competitor_probability=0.1,
        posterior_margin=margin,
        phoneme_entropy=0.2,
        normalized_phoneme_entropy=0.1,
    )


def test_ts_to_ch_rule_is_specific_and_explainable() -> None:
    gop = GopAnalysis((_phone("ts", 0, top1="ch", competitor="ch", gop=-1.2, margin=-0.3),), 43)
    result = detect_baseline_findings(gop, AudioQualityEstimate(25.0, 0.0))

    finding = next(item for item in result.findings if item.code == "ts_may_be_ch")
    assert finding.phoneme_indices == (0,)
    assert finding.evidence["bestCompetitor"] == "ch"


def test_sokuon_needs_both_short_duration_and_acoustic_disagreement() -> None:
    gop = GopAnalysis((_phone("cl", 0, top1="t", gop=-0.9, duration=20.0),), 43)
    result = detect_baseline_findings(gop, AudioQualityEstimate(25.0, 0.0))

    assert any(item.code == "sokuon_may_be_omitted" for item in result.findings)


def test_long_vowel_rule_uses_relative_duration_and_config_is_versioned() -> None:
    # a+a lasts 80ms, while three ordinary vowels supply a 100ms reference.
    phones = (
        _phone("a", 0, duration=40.0),
        _phone("a", 1, duration=40.0),
        _phone("i", 2, duration=100.0),
        _phone("u", 3, duration=100.0),
        _phone("e", 4, duration=100.0),
    )
    result = detect_baseline_findings(GopAnalysis(phones, 43), AudioQualityEstimate(25.0, 0.0))

    assert load_rule_config().version == "a4-baseline-v1"
    assert any(item.code == "long_vowel_may_be_short" for item in result.findings)


def test_audio_quality_warning_gates_confident_interpretation() -> None:
    result = detect_baseline_findings(GopAnalysis((), 43), AudioQualityEstimate(5.0, 0.03))

    assert {item.code for item in result.findings} == {"audio_clipping", "low_estimated_snr"}
