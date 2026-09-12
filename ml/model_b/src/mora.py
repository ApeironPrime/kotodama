"""B0: convert Model A phoneme alignment into Japanese mora time spans.

The module accepts the JSON shape emitted by Model A A2 (`alignment.phonemes`)
as well as lightweight test mappings.  It never invents timestamps: a mora
starts at the first included phoneme and ends at the final included phoneme.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Iterable, Mapping, Sequence


class MoraAlignmentError(ValueError):
    """Raised when Model A phoneme timing is not a valid monotonic sequence."""


VOWELS = frozenset({"a", "i", "u", "e", "o", "I", "U"})
PAUSE_PHONES = frozenset({"sil", "pau"})
SPECIAL_MORA_PHONES = frozenset({"N", "cl"})


@dataclass(frozen=True)
class AlignedPhone:
    phoneme: str
    index: int
    start_ms: float
    end_ms: float


@dataclass(frozen=True)
class Mora:
    mora_index: int
    label: str
    phonemes: tuple[str, ...]
    start_ms: float
    end_ms: float
    kind: str
    long_vowel_group: int | None = None
    long_vowel_position: str | None = None

    @property
    def duration_ms(self) -> float:
        return round(self.end_ms - self.start_ms, 3)

    def to_dict(self) -> dict[str, Any]:
        record = asdict(self)
        record["moraIndex"] = record.pop("mora_index")
        record["startMs"] = record.pop("start_ms")
        record["endMs"] = record.pop("end_ms")
        record["durationMs"] = self.duration_ms
        record["longVowelGroup"] = record.pop("long_vowel_group")
        record["longVowelPosition"] = record.pop("long_vowel_position")
        return record


def _number(value: object, *, field: str, index: int) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise MoraAlignmentError(f"Phone {index} has an invalid {field}.") from error
    if number < 0:
        raise MoraAlignmentError(f"Phone {index} has a negative {field}.")
    return number


def parse_aligned_phones(alignment: Iterable[Mapping[str, object]]) -> tuple[AlignedPhone, ...]:
    """Validate and normalize Model A's JSON phoneme segments."""
    parsed: list[AlignedPhone] = []
    previous_end = 0.0
    for position, item in enumerate(alignment):
        phone = item.get("phoneme", item.get("expectedPhone"))
        if not isinstance(phone, str) or not phone.strip():
            raise MoraAlignmentError(f"Phone {position} has no phoneme label.")
        start = _number(item.get("startMs", item.get("start_ms")), field="startMs", index=position)
        end = _number(item.get("endMs", item.get("end_ms")), field="endMs", index=position)
        if end <= start:
            raise MoraAlignmentError(f"Phone {position} must have endMs greater than startMs.")
        if start + 1e-6 < previous_end:
            raise MoraAlignmentError("Model A phoneme spans overlap or are not monotonic.")
        source_index = item.get("index", item.get("phonemeIndex", position))
        try:
            index = int(source_index)
        except (TypeError, ValueError) as error:
            raise MoraAlignmentError(f"Phone {position} has an invalid index.") from error
        parsed.append(AlignedPhone(phone.strip(), index, start, end))
        previous_end = end
    if not parsed:
        raise MoraAlignmentError("At least one aligned phoneme is required to form morae.")
    return tuple(parsed)


def _mora_from_phones(index: int, phones: Sequence[AlignedPhone], *, kind: str) -> Mora:
    return Mora(
        mora_index=index,
        label="".join(phone.phoneme for phone in phones),
        phonemes=tuple(phone.phoneme for phone in phones),
        start_ms=round(phones[0].start_ms, 3),
        end_ms=round(phones[-1].end_ms, 3),
        kind=kind,
    )


def _base_vowel(mora: Mora) -> str | None:
    if not mora.phonemes:
        return None
    final = mora.phonemes[-1]
    if final == "I":
        return "i"
    if final == "U":
        return "u"
    return final if final in VOWELS else None


def _mark_exact_repeated_vowels(morae: Sequence[Mora]) -> tuple[Mora, ...]:
    """Mark only explicit equal-vowel sequences (e.g. o + o), never guess kana."""
    result = list(morae)
    group = 0
    for previous_index, current_index in zip(range(len(result) - 1), range(1, len(result))):
        previous, current = result[previous_index], result[current_index]
        previous_vowel, current_vowel = _base_vowel(previous), _base_vowel(current)
        if (
            previous.kind == "mora"
            and current.kind == "mora"
            and previous_vowel is not None
            and previous_vowel == current_vowel
        ):
            group += 1
            result[previous_index] = Mora(**{**previous.__dict__, "long_vowel_group": group, "long_vowel_position": "onset"})
            result[current_index] = Mora(**{**current.__dict__, "long_vowel_group": group, "long_vowel_position": "continuation"})
    return tuple(result)


def phonemes_to_moras(alignment: Iterable[Mapping[str, object]]) -> tuple[Mora, ...]:
    """Group aligned Model A phonemes into Japanese mora and pause spans.

    Consonant + vowel forms one mora (`ky` + `o` → `kyo`).  A bare vowel,
    moraic nasal `N`, and sokuon `cl` each form their own mora.  Pause spans
    remain in the sequence so B1 can calculate phrase-boundary features, but
    they are marked ``kind='pause'`` and are not pitch-scored.
    """
    phones = parse_aligned_phones(alignment)
    result: list[Mora] = []
    cursor = 0
    while cursor < len(phones):
        current = phones[cursor]
        phone = current.phoneme
        mora_index = len(result)
        if phone in PAUSE_PHONES:
            result.append(_mora_from_phones(mora_index, [current], kind="pause"))
            cursor += 1
            continue
        if phone in SPECIAL_MORA_PHONES or phone in VOWELS:
            result.append(_mora_from_phones(mora_index, [current], kind="mora"))
            cursor += 1
            continue
        if cursor + 1 < len(phones) and phones[cursor + 1].phoneme in VOWELS:
            result.append(_mora_from_phones(mora_index, [current, phones[cursor + 1]], kind="mora"))
            cursor += 2
            continue
        # Preserve an unexpected trailing consonant instead of shifting later
        # timestamps.  B2 can report it as alignment-quality evidence.
        result.append(_mora_from_phones(mora_index, [current], kind="incomplete"))
        cursor += 1
    return _mark_exact_repeated_vowels(result)
