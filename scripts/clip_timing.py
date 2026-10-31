"""Word timings for each final clip, in the source language, relative to the clip start.

  python clip_timing.py cuts.json audio16k.wav out.json --lang ur

  python clip_timing.py cuts.json audio16k.wav out.json --lang ur --langs ur,en   # speaker mixes languages

Use it to anchor every on-screen line ("beat") and caption word to when it's actually said.
With --langs, every sentence gets its own language ("lang" on each row): the sentence's audio is
re-identified among the listed languages, and a sentence in another language than --lang is
re-transcribed in that language, so English stays English instead of being forced into Urdu
script. That is what the "follow the speaker" text options need.
Whisper sometimes skips stretches inside a clip; fill those from the full transcript's times
(shifted by the clip start).
"""
import argparse, json, subprocess
import numpy as np
from faster_whisper import WhisperModel
ap = argparse.ArgumentParser(); ap.add_argument("cuts"); ap.add_argument("wav16"); ap.add_argument("out"); ap.add_argument("--lang"); ap.add_argument("--langs", help="comma list, e.g. ur,en: identify each sentence's language")
a = ap.parse_args()
m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2)
ALLOWED = [x.strip() for x in (a.langs or "").split(",") if x.strip()]

def sentence_language(r, au):
    """Which of the allowed languages this sentence is in; re-transcribe it in that language if needed."""
    lo, hi = int(r["s"] * 16000), int(r["e"] * 16000)
    piece = au[max(0, lo - 1600):hi + 1600]            # 0.1 s of air either side
    r["lang"] = a.lang
    if len(piece) < 16000 * 0.6:                        # too short to tell: keep the main language
        return r
    _, _, probs = m.detect_language(piece)
    best = max((p for p in probs if p[0] in ALLOWED), key=lambda p: p[1], default=None)
    if not best or best[0] == a.lang:
        return r
    segs, _ = m.transcribe(piece, language=best[0], word_timestamps=True, beam_size=1, vad_filter=False, condition_on_previous_text=False)
    off = max(0, lo - 1600) / 16000
    words = [[round(w.start + off, 2), w.word] for s in segs for w in s.words]
    text = " ".join(s.text.strip() for s in segs).strip()
    if text:
        r.update({"t": text, "w": words, "lang": best[0]})
    return r

res = {}
for c in json.load(open(a.cuts)):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{c['start']:.2f}", "-to", f"{c['end']:.2f}", "-i", a.wav16,
                          "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
    au = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    segs, _ = m.transcribe(au, language=a.lang, word_timestamps=True, beam_size=1, vad_filter=False, condition_on_previous_text=False)
    rows = [{"s": round(s.start, 2), "e": round(s.end, 2), "t": s.text.strip(), "w": [[round(w.start, 2), w.word] for w in s.words]} for s in segs]
    if a.langs:
        rows = [sentence_language(r, au) for r in rows]
    res[c["id"]] = {"dur": c["dur"], "rows": rows}
    print("#", c["id"]); [print(f"  {r['s']:5.1f}-{r['e']:5.1f} [{r.get('lang', '')}] {r['t']}") for r in rows]
json.dump(res, open(a.out, "w"), ensure_ascii=False)
