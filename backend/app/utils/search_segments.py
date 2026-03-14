"""
Lightweight segment search for chat context retrieval.
Uses simple word-level TF-IDF ranking (no external NLP dependencies).
"""
import math
import re
from collections import Counter
from typing import List, Tuple

from app.models.transcriber_model import TranscriptSegment


def _tokenize(text: str) -> List[str]:
    """Simple Chinese+English tokenizer: split on punctuation/spaces, keep CJK chars individually."""
    # Split English words normally, treat each CJK character as a token
    tokens = []
    for part in re.findall(r'[\u4e00-\u9fff]|[a-zA-Z0-9]+', text.lower()):
        if len(part) == 1 and '\u4e00' <= part <= '\u9fff':
            tokens.append(part)
        else:
            tokens.append(part)
    # Also extract bigrams for CJK to improve matching
    cjk_chars = re.findall(r'[\u4e00-\u9fff]', text)
    for i in range(len(cjk_chars) - 1):
        tokens.append(cjk_chars[i] + cjk_chars[i + 1])
    return tokens


def search_segments(
    query: str,
    segments: List[TranscriptSegment],
    top_k: int = 10,
    max_context_chars: int = 5000,
) -> List[TranscriptSegment]:
    """
    Search transcript segments by relevance to query using TF-IDF scoring.

    Args:
        query: User question
        segments: List of transcript segments with start, end, text
        top_k: Max number of segments to return
        max_context_chars: Max total characters in returned segments

    Returns:
        List of most relevant segments, sorted by time order
    """
    if not segments or not query.strip():
        return segments[:top_k] if segments else []

    query_tokens = set(_tokenize(query))
    if not query_tokens:
        return segments[:top_k]

    # Tokenize all segments
    seg_tokens_list = [_tokenize(seg.text) for seg in segments]

    # IDF: how rare each token is across segments
    doc_count = len(segments)
    doc_freq: Counter = Counter()
    for seg_tokens in seg_tokens_list:
        unique_tokens = set(seg_tokens)
        for t in unique_tokens:
            doc_freq[t] += 1

    # Score each segment
    scores: List[Tuple[int, float]] = []
    for idx, seg_tokens in enumerate(seg_tokens_list):
        if not seg_tokens:
            scores.append((idx, 0.0))
            continue

        tf = Counter(seg_tokens)
        score = 0.0
        for qt in query_tokens:
            if qt in tf:
                # TF-IDF score
                term_freq = tf[qt] / len(seg_tokens)
                inv_doc_freq = math.log((doc_count + 1) / (doc_freq.get(qt, 0) + 1)) + 1
                score += term_freq * inv_doc_freq

        scores.append((idx, score))

    # Sort by score descending, take top_k
    scores.sort(key=lambda x: x[1], reverse=True)
    top_indices = []
    total_chars = 0
    for idx, score in scores:
        if score <= 0:
            break
        seg_len = len(segments[idx].text)
        if total_chars + seg_len > max_context_chars and top_indices:
            break
        top_indices.append(idx)
        total_chars += seg_len
        if len(top_indices) >= top_k:
            break

    # Sort by time order for coherent reading
    top_indices.sort()
    return [segments[i] for i in top_indices]


def format_segments_for_prompt(segments: List[TranscriptSegment]) -> str:
    """Format segments with timestamps for use in LLM prompt."""
    lines = []
    for seg in segments:
        start_min = int(seg.start // 60)
        start_sec = int(seg.start % 60)
        lines.append(f"[{start_min:02d}:{start_sec:02d}] {seg.text}")
    return "\n".join(lines)
