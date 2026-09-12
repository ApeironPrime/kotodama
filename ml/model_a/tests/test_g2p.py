from src.g2p import katakana_to_phonemes, normalize_japanese_text


def test_normalize_japanese_text() -> None:
    assert normalize_japanese_text("  こんにちは　世界  ") == "こんにちは 世界"


def test_katakana_fallback_handles_sokuon_and_long_vowel() -> None:
    assert katakana_to_phonemes("キッテ") == ("k", "i", "cl", "t", "e")
    assert katakana_to_phonemes("コーヒー") == ("k", "o", "o", "h", "i", "i")
