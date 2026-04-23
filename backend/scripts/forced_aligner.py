#!/usr/bin/env python3
"""
forced_aligner.py — Production v5.0
─────────────────────────────────────────────────────────────────────────────
CHANGES vs v4.0:

  FIX-N  LRC detection được cải thiện: detect dựa trên extension file
         (.lrc) HOẶC nội dung có timestamp — không còn bỏ sót.

  FIX-O  split_lines() v3 tách đúng từng dòng LRC thành 1 window riêng.
         Loại bỏ hoàn toàn khả năng gộp 2 dòng LRC thành 1 segment.
         Đây là root cause fix của concatenation bug (thêmBao, mơCầm).

  FIX-P  Lọc "phonetic noise" trước khi gọi MMS: các token như
         "Ah-ah-oh", "Oh-oh" chứa blank index (token=0) sẽ bị filtered
         ra khỏi targets tensor. Thay thế toàn bộ từ như vậy bằng
         uniform_split thay vì crash toàn bộ dòng.

  FIX-Q  Segment too short guard cho CTC: nếu audio_frames < target_tokens * 2
         (điều kiện CTC), chia đều toàn dòng thay vì crash.

  FIX-R  Parenthetical stripping nhất quán: "(dịu dàng chân phương)" ở cuối
         mỗi dòng LRC được strip trước khi đưa vào aligner. Kết quả text
         hiển thị sạch hơn.

ROOT CAUSE BUG CŨ (v4.0 với plain text input từ TypeScript):
  - normaliseForAligner() trong lrc-parser.ts strip toàn bộ timestamp
    → Python nhận plain text → is_lrc = False → Whisper fallback
  - Whisper gộp nhiều câu vào 1 segment → concatenation
  - FIX: TypeScript mới dùng prepareLrcForAligner() giữ [mm:ss.xx]
    → Python nhận LRC → is_lrc = True → get_line_windows_lrc() (FIX-L)
"""

import sys
import io

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Optional

import torch
import torchaudio
import whisper
import librosa
from torchaudio.pipelines import MMS_FA as bundle

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
DEVICE                = "cuda" if torch.cuda.is_available() else "cpu"
WHISPER_MODEL         = "base"
SAMPLE_RATE           = bundle.sample_rate          # 16 000 Hz
MIN_LINE_DURATION_MS  = 200
MIN_WORD_SAMPLES      = 400
MIN_WORD_DURATION_MS  = 80
STANDALONE_PUNCT      = re.compile(r'^[,\.!?;:…–—]+$')

# FIX-P: Phát hiện từ phonetic noise không có trong từ điển MMS
# (hyphenated vocalizations, pure vowel runs)
PHONETIC_NOISE_RE     = re.compile(
    r'^(?:[A-Za-z]-)+[A-Za-z]$'         # Ah-ah-oh, Oh-oh-oh
    r'|^(?:ah|oh|uh|um|mm|hmm|yeah|hey|whoa|la)+$',  # pure vocalizations
    re.IGNORECASE,
)

# ─────────────────────────────────────────────────────────────────────────────
# FIX-G + FIX-N: LRC PARSER (improved)
# ─────────────────────────────────────────────────────────────────────────────

LRC_LINE_RE = re.compile(r'^\[(\d{1,3}):(\d{2})\.(\d{2,3})\]\s*(.*)')
LRC_META_RE = re.compile(r'^\[(?:ar|ti|al|by|offset|re|ve|length):', re.IGNORECASE)


def parse_lrc(content: str, filename: str = "") -> tuple[list[dict], bool]:
    """
    FIX-N: Parse LRC.
    - Ưu tiên detect qua extension file (.lrc) HOẶC nội dung có timestamp.
    - Mỗi dòng LRC → 1 entry riêng (KHÔNG gộp).
    - Strip parenthetical repetition ở cuối mỗi dòng.
    Returns (lines, is_lrc).
    """
    parsed = []
    is_lrc = filename.lower().endswith(".lrc")  # FIX-N: detect bằng extension trước

    for raw_line in content.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        if LRC_META_RE.match(stripped):
            continue

        m = LRC_LINE_RE.match(stripped)
        if m:
            is_lrc = True
            mins       = int(m.group(1))
            secs       = int(m.group(2))
            millis_str = m.group(3)
            millis     = int(millis_str) * 10 if len(millis_str) == 2 else int(millis_str)
            start_ms   = mins * 60_000 + secs * 1_000 + millis
            text       = normalise_text(m.group(4))
            if text:
                parsed.append({"text": text, "start_ms": start_ms})
        else:
            text = normalise_text(stripped)
            if text:
                parsed.append({"text": text, "start_ms": None})

    return parsed, is_lrc


def normalise_text(raw: str) -> str:
    """
    Clean text cho mục đích hiển thị:
    - Strip inline LRC tags: <xx:xx.xx>
    - Strip parenthetical repetition ở cuối: " (dịu dàng chân phương)"
    - Normalize unicode NFKC
    - Collapse whitespace
    """
    text = raw.strip()
    text = re.sub(r'<\d+:\d+\.\d+>', '', text)           # inline LRC timing tags
    text = re.sub(r'\[.*?\]', '', text)                   # other bracket tags
    text = re.sub(r'\s*\(.*?\)\s*$', '', text).strip()   # trailing parenthetical — FIX-R
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ─────────────────────────────────────────────────────────────────────────────
# FIX-H: WORD BOUNDARY DETECTION
# ─────────────────────────────────────────────────────────────────────────────

_CAMEL_BOUNDARY = re.compile(
    r'([a-zàáâãèéêìíòóôõùúýăắặẵẳẻẽếềệễểịọốồổỗộớờởỡợụừứữựỳỷỵ])'
    r'([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂẮẶẴẲẺẼẾỀỆỄỂỊỌỐỒỔỖỘỚỜỞỠỢỤỪỨỮỰỲỶỴ])',
    re.UNICODE,
)


def split_camel_boundary(word: str) -> list[str]:
    spaced = _CAMEL_BOUNDARY.sub(r'\1 \2', word)
    parts  = spaced.split()
    return parts if len(parts) > 1 else [word]


def clean_words(words: list[dict]) -> list[dict]:
    """FIX-H + FIX-I: split camelCase + merge standalone punctuation."""
    expanded: list[dict] = []
    for w in words:
        parts = split_camel_boundary(w["word"])
        if len(parts) == 1:
            expanded.append(w)
        else:
            total_ms = max(w["endTime"] - w["startTime"], len(parts) * MIN_WORD_DURATION_MS)
            step     = total_ms / len(parts)
            for i, part in enumerate(parts):
                expanded.append({
                    "word":      part,
                    "startTime": round(w["startTime"] + i * step),
                    "endTime":   round(w["startTime"] + (i + 1) * step),
                })

    if not expanded:
        return expanded

    merged: list[dict] = [expanded[0]]
    for w in expanded[1:]:
        if STANDALONE_PUNCT.match(w["word"]) and merged:
            prev = merged[-1]
            merged[-1] = {
                "word":      prev["word"] + w["word"],
                "startTime": prev["startTime"],
                "endTime":   max(prev["endTime"], w["endTime"]),
            }
        else:
            merged.append(w)

    return merged


# ─────────────────────────────────────────────────────────────────────────────
# FIX-J: TIMESTAMP CLUSTER REPAIR
# ─────────────────────────────────────────────────────────────────────────────

def repair_timestamp_clusters(words: list[dict], line_start_ms: int, line_end_ms: int) -> list[dict]:
    if not words:
        return words

    n      = len(words)
    result = list(words)
    i      = 0

    while i < n:
        j             = i
        cluster_start = result[i]["startTime"]

        while j < n and (
            result[j]["startTime"] == cluster_start
            or result[j]["endTime"] <= result[j]["startTime"]
            or (j > 0 and result[j]["startTime"] == result[j - 1]["startTime"])
        ):
            j += 1

        cluster_size = j - i
        if cluster_size <= 1:
            i += 1
            continue

        cluster_end = result[j]["startTime"] if j < n else line_end_ms
        if cluster_end <= cluster_start:
            cluster_end = cluster_start + cluster_size * MIN_WORD_DURATION_MS

        step = (cluster_end - cluster_start) / cluster_size
        for k in range(cluster_size):
            result[i + k]["startTime"] = round(cluster_start + k * step)
            result[i + k]["endTime"]   = round(cluster_start + (k + 1) * step)

        i = j

    return result


# ─────────────────────────────────────────────────────────────────────────────
# DIACRITICS STRIP
# ─────────────────────────────────────────────────────────────────────────────

def remove_diacritics(text: str) -> str:
    nfd    = unicodedata.normalize("NFD", text)
    result = "".join(c for c in nfd if unicodedata.category(c) != "Mn" and ord(c) < 128)
    result = result.replace("đ", "d").replace("Đ", "D")
    return result.lower()


# ─────────────────────────────────────────────────────────────────────────────
# WORD TIMESTAMP FIX
# ─────────────────────────────────────────────────────────────────────────────

def fix_word_timestamps(words: list[dict]) -> list[dict]:
    if not words:
        return words
    for i in range(1, len(words)):
        if words[i]["startTime"] < words[i - 1]["startTime"]:
            words[i]["startTime"] = words[i - 1]["startTime"]
    for i in range(len(words) - 1):
        words[i]["endTime"] = words[i + 1]["startTime"]
    for w in words:
        if w["endTime"] <= w["startTime"]:
            w["endTime"] = w["startTime"] + MIN_WORD_DURATION_MS
    return words


# ─────────────────────────────────────────────────────────────────────────────
# FIX-B + FIX-M: GLOBAL MONOTONIC + OVERLAP REPAIR
# ─────────────────────────────────────────────────────────────────────────────

def fix_global_monotonic(output_lines: list[dict]) -> list[dict]:
    for i in range(1, len(output_lines)):
        prev = output_lines[i - 1]
        curr = output_lines[i]

        if curr["start"] < prev["start"]:
            curr["start"] = prev["start"]
        if curr["start"] < prev["end"]:
            curr["start"] = prev["end"]

        if curr["words"] and curr["words"][0]["startTime"] < curr["start"]:
            delta = curr["start"] - curr["words"][0]["startTime"]
            for w in curr["words"]:
                w["startTime"] += delta
                w["endTime"]   += delta

        if prev["words"] and curr["words"]:
            next_start = curr["words"][0]["startTime"]
            last_w     = prev["words"][-1]
            if last_w["endTime"] > next_start:
                last_w["endTime"] = next_start
            if last_w["startTime"] >= last_w["endTime"]:
                last_w["startTime"] = max(0, last_w["endTime"] - MIN_WORD_DURATION_MS)

    return output_lines


# ─────────────────────────────────────────────────────────────────────────────
# FIX-L: LRC-ANCHORED LINE WINDOWS
# ─────────────────────────────────────────────────────────────────────────────

def get_line_windows_lrc(lrc_lines: list[dict], audio_duration: float) -> list[dict]:
    """
    FIX-L + FIX-O: Mỗi dòng LRC → 1 window riêng.
    line.end = start của dòng kế tiếp CÓ timestamp (bỏ qua dòng không có).
    Đảm bảo không bao giờ gộp 2 dòng LRC thành 1 segment.
    """
    audio_ms = audio_duration * 1000
    windows  = []
    n        = len(lrc_lines)

    # Lọc chỉ lấy dòng có timestamp để tính end
    timestamped = [l for l in lrc_lines if l.get("start_ms") is not None]

    for i, line in enumerate(lrc_lines):
        start_ms = line["start_ms"] if line["start_ms"] is not None else 0

        # Tìm dòng kế tiếp CÓ timestamp để dùng làm end
        end_ms = audio_ms
        for j in range(i + 1, n):
            if lrc_lines[j].get("start_ms") is not None:
                end_ms = lrc_lines[j]["start_ms"]
                break

        # Guard minimum duration
        if end_ms - start_ms < MIN_LINE_DURATION_MS:
            end_ms = start_ms + MIN_LINE_DURATION_MS

        windows.append({
            "text":  line["text"],
            "start": start_ms / 1000,
            "end":   end_ms   / 1000,
        })

    return windows


def get_line_windows_whisper(
    audio_path:     str,
    plain_lines:    list[str],
    audio_duration: float,
) -> list[dict]:
    """Fallback: Whisper-based proportional sub-slicing."""
    print("[Aligner] Loading Whisper...", file=sys.stderr)
    model    = whisper.load_model(WHISPER_MODEL, device=DEVICE)
    result   = model.transcribe(audio_path, word_timestamps=False, language=None)
    segments = result.get("segments", [])

    n = len(plain_lines)

    if not segments:
        step = audio_duration / max(n, 1)
        return [
            {"text": ln, "start": i * step, "end": (i + 1) * step}
            for i, ln in enumerate(plain_lines)
        ]

    total_segs    = len(segments)
    seg_to_lines: dict[int, list[int]] = defaultdict(list)

    for line_i in range(n):
        ratio   = line_i / max(n - 1, 1)
        seg_idx = min(round(ratio * (total_segs - 1)), total_segs - 1)
        seg_to_lines[seg_idx].append(line_i)

    line_windows: dict[int, dict] = {}

    for seg_idx, line_indices in seg_to_lines.items():
        seg       = segments[seg_idx]
        seg_start = float(seg["start"])
        seg_end   = float(seg["end"])
        seg_dur   = seg_end - seg_start
        num_lines = len(line_indices)

        for sub_i, line_i in enumerate(line_indices):
            sub_start = seg_start + (sub_i / num_lines) * seg_dur
            sub_end   = seg_start + ((sub_i + 1) / num_lines) * seg_dur
            if (sub_end - sub_start) * 1000 < MIN_LINE_DURATION_MS:
                sub_end = sub_start + MIN_LINE_DURATION_MS / 1000
            line_windows[line_i] = {
                "text":  plain_lines[line_i],
                "start": sub_start,
                "end":   sub_end,
            }

    return [line_windows[i] for i in range(n)]


# ─────────────────────────────────────────────────────────────────────────────
# FIX-P: PHONETIC NOISE FILTER
# ─────────────────────────────────────────────────────────────────────────────

def is_phonetic_noise(word: str) -> bool:
    """
    FIX-P: Phát hiện từ như "Ah-ah-oh-oh", "Oh-oh-oh" không có trong từ điển MMS.
    Các từ này gây ra blank index lỗi trong CTC alignment.
    """
    # Hyphenated repetition: A-b-c-d hay Ah-ah-oh
    clean = re.sub(r'[,\.!?]', '', word)
    if re.match(r'^(?:[A-Za-z]{1,3}-)+[A-Za-z]{1,3}$', clean):
        return True
    return bool(PHONETIC_NOISE_RE.match(clean))


def split_words_for_mms(
    original_words: list[str],
    dictionary: dict,
) -> tuple[list[str], list[str], list[int]]:
    """
    FIX-P: Tách words thành 2 nhóm:
    - alignable: từ có thể align bằng MMS (đủ tokens trong dictionary)
    - noise_indices: vị trí của các từ phonetic noise → dùng uniform fill sau

    Returns:
      (alignable_words, stripped_words_for_mms, noise_indices)
    """
    alignable     = []
    stripped      = []
    noise_indices = []

    for i, w in enumerate(original_words):
        if is_phonetic_noise(w):
            noise_indices.append(i)
        else:
            s = remove_diacritics(w)
            tokens = [c for c in s if c in dictionary]
            if tokens:
                alignable.append(w)
                stripped.append(s)
            else:
                noise_indices.append(i)

    return alignable, stripped, noise_indices


# ─────────────────────────────────────────────────────────────────────────────
# MMS WORD ALIGNMENT
# ─────────────────────────────────────────────────────────────────────────────

def _uniform_split(original_words: list[str], offset_sec: float, duration_sec: float) -> list[dict]:
    step_ms = duration_sec * 1000 / max(len(original_words), 1)
    return [
        {
            "word":      w,
            "startTime": round(offset_sec * 1000 + i * step_ms),
            "endTime":   round(offset_sec * 1000 + (i + 1) * step_ms),
        }
        for i, w in enumerate(original_words)
    ]


def align_words_in_segment(
    waveform_segment: torch.Tensor,
    text_line:        str,
    offset_sec:       float,
    aligner,
    dictionary:       dict,
) -> list[dict]:
    original_words    = text_line.split()
    if not original_words:
        return []

    seg_duration_sec = waveform_segment.shape[1] / SAMPLE_RATE

    if waveform_segment.shape[1] < MIN_WORD_SAMPLES:
        print(
            f"[Aligner]   WARN: segment too short ({waveform_segment.shape[1]} samples) "
            f"for \"{text_line[:40]}\" — uniform fallback.",
            file=sys.stderr,
        )
        return _uniform_split(original_words, offset_sec, seg_duration_sec)

    # FIX-P: Tách phonetic noise trước
    alignable_words, stripped_words, noise_indices = split_words_for_mms(original_words, dictionary)

    if not alignable_words:
        print(
            f"[Aligner]   WARN: no alignable words in \"{text_line[:40]}\" — uniform fallback.",
            file=sys.stderr,
        )
        return _uniform_split(original_words, offset_sec, seg_duration_sec)

    tokens: list[int] = [
        dictionary[c]
        for word in stripped_words
        for c in word
        if c in dictionary
    ]

    if not tokens:
        return _uniform_split(original_words, offset_sec, seg_duration_sec)

    with torch.inference_mode():
        emission, _ = aligner(waveform_segment)

    # FIX-Q: CTC guard — emission frames phải >= 2 * token count
    if emission.shape[1] < len(tokens) * 2:
        print(
            f"[Aligner]   WARN: segment too short for CTC "
            f"(frames={emission.shape[1]}, tokens={len(tokens)}) "
            f"— uniform fallback.",
            file=sys.stderr,
        )
        return _uniform_split(original_words, offset_sec, seg_duration_sec)

    try:
        targets    = torch.tensor([tokens], dtype=torch.int32, device=DEVICE)
        alignments, _ = torchaudio.functional.forced_align(emission, targets, blank=0)
        alignments = alignments[0].cpu().tolist()
    except Exception as ex:
        print(
            f"[Aligner]   WARN: forced_align failed: {ex} — uniform fallback.",
            file=sys.stderr,
        )
        return _uniform_split(original_words, offset_sec, seg_duration_sec)

    ratio = seg_duration_sec / emission.shape[1]

    # Build spans cho alignable words
    aligned_spans: list[dict] = []
    token_idx = 0

    for orig_w, strip_w in zip(alignable_words, stripped_words):
        word_toks = [dictionary[c] for c in strip_w if c in dictionary]

        if not word_toks:
            prev_end = aligned_spans[-1]["endTime"] if aligned_spans else round(offset_sec * 1000)
            aligned_spans.append({
                "word":      orig_w,
                "startTime": prev_end,
                "endTime":   prev_end + MIN_WORD_DURATION_MS,
            })
            continue

        start_f: Optional[int] = None
        end_f:   Optional[int] = None
        local_count = 0

        for fi, tok in enumerate(alignments):
            if token_idx < len(tokens) and tok == tokens[token_idx]:
                if start_f is None:
                    start_f = fi
                end_f       = fi
                token_idx  += 1
                local_count += 1
            if local_count >= len(word_toks):
                break

        if start_f is not None and end_f is not None:
            aligned_spans.append({
                "word":      orig_w,
                "startTime": round((offset_sec + start_f * ratio) * 1000),
                "endTime":   round((offset_sec + end_f   * ratio) * 1000),
            })
        else:
            prev_end = aligned_spans[-1]["endTime"] if aligned_spans else round(offset_sec * 1000)
            aligned_spans.append({
                "word":      orig_w,
                "startTime": prev_end,
                "endTime":   prev_end + MIN_WORD_DURATION_MS,
            })

    # FIX-P: Tái hợp noise words vào đúng vị trí
    # Noise words được fill theo uniform trong khoảng xung quanh
    if not noise_indices:
        return aligned_spans

    # Rebuild full list với noise words ở đúng vị trí
    full_result: list[dict] = []
    aligned_iter = iter(aligned_spans)
    aligned_positions = [i for i in range(len(original_words)) if i not in noise_indices]
    aligned_map   = {pos: next(aligned_iter) for pos in aligned_positions}

    for i, w in enumerate(original_words):
        if i in aligned_map:
            full_result.append(aligned_map[i])
        else:
            # Noise word: dùng thời gian của từ trước/sau để estimate
            prev_end  = full_result[-1]["endTime"] if full_result else round(offset_sec * 1000)
            next_start = None
            for j in range(i + 1, len(original_words)):
                if j in aligned_map:
                    next_start = aligned_map[j]["startTime"]
                    break
            if next_start is None:
                next_start = round((offset_sec + seg_duration_sec) * 1000)

            # Chia đều gap cho noise word
            full_result.append({
                "word":      w,
                "startTime": prev_end,
                "endTime":   min(prev_end + max(MIN_WORD_DURATION_MS, (next_start - prev_end) // 2),
                                 next_start),
            })

    return full_result


# ─────────────────────────────────────────────────────────────────────────────
# FIX-K: ZERO-DURATION LINE GUARD
# ─────────────────────────────────────────────────────────────────────────────

def guard_line_duration(seg: dict) -> dict:
    if seg["end"] <= seg["start"]:
        word_count   = len(seg.get("text", "").split())
        min_duration = max(word_count * 0.3, 1.0)
        seg["end"]   = seg["start"] + min_duration
    return seg


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def run_alignment(audio_path: str, lyrics_text: str, lyrics_filename: str = "") -> list[dict]:
    # FIX-N: truyền filename để detect LRC qua extension
    lrc_lines, is_lrc = parse_lrc(lyrics_text, filename=lyrics_filename)

    if not lrc_lines:
        raise ValueError("Lyrics rỗng sau khi parse.")

    print(
        f"[Aligner] Input format: {'LRC ✅' if is_lrc else 'Plain text ⚠️'} | "
        f"{len(lrc_lines)} lines",
        file=sys.stderr,
    )

    # Cảnh báo nếu vẫn là plain text (không có LRC timestamps)
    if not is_lrc:
        print(
            "[Aligner] WARNING: Không có LRC timestamps — Whisper fallback sẽ kém chính xác hơn.\n"
            "[Aligner]          Đảm bảo TypeScript gọi prepareLrcForAligner() trước khi ghi temp file.",
            file=sys.stderr,
        )

    print("[Aligner] Loading audio...", file=sys.stderr)
    y, _      = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)
    waveform  = torch.from_numpy(y).unsqueeze(0).to(DEVICE)
    audio_dur = y.shape[0] / SAMPLE_RATE

    # FIX-L + FIX-O: LRC anchor strategy
    if is_lrc:
        windows = get_line_windows_lrc(lrc_lines, audio_dur)
    else:
        plain_lines = [ln["text"] for ln in lrc_lines]
        windows     = get_line_windows_whisper(audio_path, plain_lines, audio_dur)

    # FIX-K
    windows = [guard_line_duration(w) for w in windows]

    print("[Aligner] Loading MMS aligner...", file=sys.stderr)
    aligner    = bundle.get_model().to(DEVICE)
    dictionary = bundle.get_dict()
    aligner.eval()

    output_lines: list[dict] = []

    for seg in windows:
        line_text = seg["text"]
        start_sec = seg["start"]
        end_sec   = seg["end"]

        s        = int(start_sec * SAMPLE_RATE)
        e        = int(end_sec   * SAMPLE_RATE)
        wave_seg = waveform[:, s:e]

        print(
            f"[Aligner]   ({start_sec:.2f}s–{end_sec:.2f}s): \"{line_text[:50]}\"",
            file=sys.stderr,
        )

        try:
            words = align_words_in_segment(
                wave_seg, line_text, start_sec, aligner, dictionary
            )
            words = fix_word_timestamps(words)
        except Exception as ex:
            print(
                f"[Aligner]   WARNING: alignment failed for \"{line_text[:40]}\" — {ex}",
                file=sys.stderr,
            )
            words = _uniform_split(line_text.split(), start_sec, end_sec - start_sec)
            words = fix_word_timestamps(words)

        words = clean_words(words)
        words = repair_timestamp_clusters(
            words,
            round(start_sec * 1000),
            round(end_sec   * 1000),
        )

        output_lines.append({
            "text":  line_text,
            "start": round(start_sec * 1000),
            "end":   round(end_sec   * 1000),
            "words": words,
        })

    output_lines = fix_global_monotonic(output_lines)
    return output_lines


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Hybrid Karaoke Forced Aligner v5.0 — LRC anchor + MMS + Phonetic Noise Filter"
    )
    parser.add_argument("--audio",       required=True)
    parser.add_argument("--lyrics",      default="",  help="Plain text lyrics (fallback)")
    parser.add_argument("--lyrics-file", default="",  dest="lyrics_file",
                        help="LRC (.lrc) hoặc plain text (.txt) — RECOMMENDED")
    parser.add_argument("--out",         required=True)
    args = parser.parse_args()

    if args.lyrics_file:
        lf = Path(args.lyrics_file)
        if not lf.exists():
            print(f"[Aligner] ERROR: --lyrics-file not found: {lf}", file=sys.stderr)
            sys.exit(1)
        lyrics_text     = lf.read_text(encoding="utf-8")
        lyrics_filename = lf.name   # FIX-N: truyền filename để detect extension
    else:
        lyrics_text     = args.lyrics
        lyrics_filename = ""

    if not lyrics_text.strip():
        print("[Aligner] ERROR: lyrics empty.", file=sys.stderr)
        sys.exit(1)

    audio_path = Path(args.audio)
    if not audio_path.exists():
        print(f"[Aligner] ERROR: audio not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    try:
        result = run_alignment(str(audio_path), lyrics_text, lyrics_filename=lyrics_filename)
    except Exception as ex:
        print(f"[Aligner] CRITICAL ERROR: {ex}", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {"type": "karaoke", "lines": result},
            f,
            ensure_ascii=False,
            indent=2,
        )

    total_words = sum(len(line["words"]) for line in result)
    print(
        f"[Aligner] Done. {len(result)} lines / {total_words} words → {out_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()