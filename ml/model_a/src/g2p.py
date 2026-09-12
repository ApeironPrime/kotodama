"""Japanese text normalisation and G2P for the Model A phoneme vocabulary."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .config import BaselineConfig, load_config


class G2PError(ValueError):
    """Raised when a sentence cannot be converted to usable reference phones."""


@dataclass(frozen=True)
class G2PResult:
    text: str
    phonemes: tuple[str, ...]
    engine: str

    @property
    def joined(self) -> str:
        return " ".join(self.phonemes)


_WHITESPACE = re.compile(r"\s+")
_PUNCTUATION = re.compile(r"[、。！？!?：:；;（）()［］\[\]{}『』「」\"'…・]")


def normalize_japanese_text(text: str) -> str:
    """Normalise width and whitespace while preserving Japanese words."""
    normalized = unicodedata.normalize("NFKC", text).strip()
    normalized = _WHITESPACE.sub(" ", normalized)
    return normalized


def _require_pyopenjtalk():
    try:
        import pyopenjtalk  # type: ignore
    except ImportError as error:
        raise G2PError(
            "pyopenjtalk is required for Kanji-to-phoneme conversion. "
            "Install Model A requirements, or provide already-katakana text for the fallback."
        ) from error
    return pyopenjtalk


def apply_user_dictionary(dictionary_path: Path) -> None:
    """Apply an explicit OpenJTalk dictionary for the current Python process."""
    if not dictionary_path.is_file():
        raise G2PError(f"OpenJTalk user dictionary was not found: {dictionary_path}")
    pyopenjtalk = _require_pyopenjtalk()
    pyopenjtalk.update_global_jtalk_with_user_dict(str(dictionary_path))


def _tokenize_phone_string(phone_string: str) -> tuple[str, ...]:
    return tuple(phone for phone in phone_string.split() if phone and phone not in {"pau", "sil"})


def _validate_vocabulary(phonemes: Iterable[str], config: BaselineConfig) -> tuple[str, ...]:
    values = tuple(phonemes)
    unknown = sorted(set(values) - config.reference_vocabulary)
    if unknown:
        raise G2PError(
            "G2P emitted phones outside the baseline vocabulary: " + ", ".join(unknown)
        )
    if not values:
        raise G2PError("The sentence does not contain any usable phonemes.")
    return values


def katakana_to_phonemes(katakana: str) -> tuple[str, ...]:
    """Small fallback for already-katakana smoke tests.

    It intentionally does not attempt Kanji readings. Production text must use
    OpenJTalk, whose language frontend resolves readings in context.
    """
    text = unicodedata.normalize("NFKC", katakana)
    text = _PUNCTUATION.sub(" ", text)
    text = text.replace(" ", "")
    if not text:
        raise G2PError("Katakana fallback received an empty sentence.")

    # Longest spellings first so キャ is not consumed as キ + ャ.
    mapping = {
        "キャ": ("ky", "a"), "キュ": ("ky", "u"), "キョ": ("ky", "o"),
        "ギャ": ("gy", "a"), "ギュ": ("gy", "u"), "ギョ": ("gy", "o"),
        "シャ": ("sh", "a"), "シュ": ("sh", "u"), "ショ": ("sh", "o"),
        "ジャ": ("j", "a"), "ジュ": ("j", "u"), "ジョ": ("j", "o"),
        "チャ": ("ch", "a"), "チュ": ("ch", "u"), "チョ": ("ch", "o"),
        "ニャ": ("ny", "a"), "ニュ": ("ny", "u"), "ニョ": ("ny", "o"),
        "ヒャ": ("hy", "a"), "ヒュ": ("hy", "u"), "ヒョ": ("hy", "o"),
        "ビャ": ("by", "a"), "ビュ": ("by", "u"), "ビョ": ("by", "o"),
        "ピャ": ("py", "a"), "ピュ": ("py", "u"), "ピョ": ("py", "o"),
        "ファ": ("f", "a"), "フィ": ("f", "i"), "フェ": ("f", "e"), "フォ": ("f", "o"),
        "ツァ": ("ts", "a"), "ツィ": ("ts", "i"), "ツェ": ("ts", "e"), "ツォ": ("ts", "o"),
        "ヴァ": ("v", "a"), "ヴィ": ("v", "i"), "ヴェ": ("v", "e"), "ヴォ": ("v", "o"),
        "ティ": ("t", "i"), "ディ": ("d", "i"),
        "ア": ("a",), "イ": ("i",), "ウ": ("u",), "エ": ("e",), "オ": ("o",),
        "カ": ("k", "a"), "キ": ("k", "i"), "ク": ("k", "u"), "ケ": ("k", "e"), "コ": ("k", "o"),
        "ガ": ("g", "a"), "ギ": ("g", "i"), "グ": ("g", "u"), "ゲ": ("g", "e"), "ゴ": ("g", "o"),
        "サ": ("s", "a"), "シ": ("sh", "i"), "ス": ("s", "u"), "セ": ("s", "e"), "ソ": ("s", "o"),
        "ザ": ("z", "a"), "ジ": ("j", "i"), "ズ": ("z", "u"), "ゼ": ("z", "e"), "ゾ": ("z", "o"),
        "タ": ("t", "a"), "チ": ("ch", "i"), "ツ": ("ts", "u"), "テ": ("t", "e"), "ト": ("t", "o"),
        "ダ": ("d", "a"), "ヂ": ("j", "i"), "ヅ": ("z", "u"), "デ": ("d", "e"), "ド": ("d", "o"),
        "ナ": ("n", "a"), "ニ": ("n", "i"), "ヌ": ("n", "u"), "ネ": ("n", "e"), "ノ": ("n", "o"),
        "ハ": ("h", "a"), "ヒ": ("h", "i"), "フ": ("f", "u"), "ヘ": ("h", "e"), "ホ": ("h", "o"),
        "バ": ("b", "a"), "ビ": ("b", "i"), "ブ": ("b", "u"), "ベ": ("b", "e"), "ボ": ("b", "o"),
        "パ": ("p", "a"), "ピ": ("p", "i"), "プ": ("p", "u"), "ペ": ("p", "e"), "ポ": ("p", "o"),
        "マ": ("m", "a"), "ミ": ("m", "i"), "ム": ("m", "u"), "メ": ("m", "e"), "モ": ("m", "o"),
        "ヤ": ("y", "a"), "ユ": ("y", "u"), "ヨ": ("y", "o"),
        "ラ": ("r", "a"), "リ": ("r", "i"), "ル": ("r", "u"), "レ": ("r", "e"), "ロ": ("r", "o"),
        "ワ": ("w", "a"), "ヲ": ("o",), "ン": ("N",),
        "ァ": ("a",), "ィ": ("i",), "ゥ": ("u",), "ェ": ("e",), "ォ": ("o",),
    }
    keys = sorted(mapping, key=len, reverse=True)
    phones: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        if char == "ッ":
            phones.append("cl")
            index += 1
            continue
        if char == "ー":
            if not phones or phones[-1] not in {"a", "i", "u", "e", "o"}:
                raise G2PError("Long-vowel mark has no preceding vowel in katakana fallback.")
            phones.append(phones[-1])
            index += 1
            continue
        match = next((key for key in keys if text.startswith(key, index)), None)
        if match is None:
            raise G2PError(f"Katakana fallback does not support character: {char}")
        phones.extend(mapping[match])
        index += len(match)
    return tuple(phones)


def japanese_to_phonemes(
    text: str,
    *,
    config: BaselineConfig | None = None,
    user_dictionary: Path | None = None,
) -> G2PResult:
    """Convert Japanese text to phones accepted by the selected baseline model."""
    active_config = config or load_config()
    normalized = normalize_japanese_text(text)
    if not normalized:
        raise G2PError("A non-empty Japanese sentence is required.")
    if user_dictionary:
        apply_user_dictionary(user_dictionary)

    try:
        pyopenjtalk = _require_pyopenjtalk()
        phones = _tokenize_phone_string(pyopenjtalk.g2p(normalized))
        return G2PResult(normalized, _validate_vocabulary(phones, active_config), "pyopenjtalk")
    except G2PError as error:
        # The fallback is deliberately limited to katakana so it cannot silently
        # invent Kanji readings when OpenJTalk is unavailable.
        if re.fullmatch(r"[ァ-ヶー\s、。！？!?・]+", normalized):
            phones = katakana_to_phonemes(normalized)
            return G2PResult(normalized, _validate_vocabulary(phones, active_config), "katakana-fallback")
        raise error
