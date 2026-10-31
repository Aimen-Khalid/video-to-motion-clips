"""Cut voiceover clips on clean boundaries and print what's said at each edge.

  python cut_clips.py plan.json transcript_spk.json audio16k.wav audio48k.wav out_dir --lang ur

plan.json: [{"id": "c01", "start": 653.8, "end": 681.8, "speaker": "S1", "extend_to": null}, ...]
  start/end: rough times from the transcript (first word start, last word end).
  extend_to: optional later time when the speaker's thought continues past `end`.

For each clip it:
  1. snaps the start to the end of the preceding silence and the end to the start of the next
     silence (>= 0.35 s, energy-based, within ~3.5 s), never past another speaker's words;
     transcript word times run early by up to ~1 s, so cutting on them clips sentences;
  2. cuts <out_dir>/<id>.mp4 (AAC 128k, 80 ms fade in, 250 ms fade out) from the 48 kHz audio;
  3. re-transcribes ~4 s at each edge IN THE SOURCE LANGUAGE and prints the words, so you can
     see whether a clip opens on someone else's tail or ends on the first words of a new
     sentence. Fix those by hand (edit plan.json or pass the printed times) and re-run.
Writes <out_dir>/cuts.json with final start/end/duration per clip.
"""
import argparse, json, subprocess, wave
import numpy as np
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("plan"); ap.add_argument("transcript"); ap.add_argument("wav16"); ap.add_argument("wav48"); ap.add_argument("out")
ap.add_argument("--lang", default=None, help="source language code for the edge check (e.g. ur, en)")
ap.add_argument("--no-snap", action="store_true", help="use plan times exactly (after manual fixes)")
a = ap.parse_args()

plan = json.load(open(a.plan))
tj = json.load(open(a.transcript)); segs = tj["segments"] if isinstance(tj, dict) else tj
wf = wave.open(a.wav16); SR = wf.getframerate()
audio = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768
F = SR // 50  # 20 ms frames
rms = np.sqrt(np.convolve((audio[:len(audio) // F * F].reshape(-1, F) ** 2).mean(1), np.ones(3) / 3, "same"))
thr = np.percentile(rms, 20) * 1.8
silent = rms < thr

def pauses(t0, t1, minlen=0.35):
    i, i1, out = max(0, int(t0 * 50)), min(len(silent), int(t1 * 50)), []
    while i < i1:
        if silent[i]:
            j = i
            while j < len(silent) and silent[j]: j += 1
            if (j - i) / 50 >= minlen: out.append((i / 50, j / 50))
            i = j
        else: i += 1
    return out

words = [w | {"spk": w.get("spk", s.get("spk"))} for s in segs for w in s.get("words", [])]
model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2)

def edge_words(t0, t1):
    seg, _ = model.transcribe(audio[int(t0 * SR):int(t1 * SR)], language=a.lang, word_timestamps=True, beam_size=1, vad_filter=False)
    return " ".join(f"{w.word.strip()}[{t0 + w.start:.1f}]" for s in seg for w in s.words)

subprocess.run(["mkdir", "-p", a.out])
result = []
for c in plan:
    st, en = float(c["start"]), float(c.get("extend_to") or c["end"])
    if not a.no_snap:
        others = [w["s"] for w in words if w["s"] > en - 0.2 and w.get("spk") != c["speaker"]]
        cap = min(others) if others else en + 5
        ps = [p for p in pauses(en - 0.3, en + 3.5) if p[0] < cap]
        en = min((ps[0][0] + 0.2) if ps else en + 0.25, cap - 0.05)
        prev = [w["e"] for w in words if w["e"] < st + 0.2 and w.get("spk") != c["speaker"]]
        floor = max(prev) if prev else 0
        pst = [p for p in pauses(st - 3, st + 0.4, 0.3) if p[1] <= st + 0.4]
        st = max((pst[-1][1] - 0.12) if pst else st, floor + 0.05)
    out = f"{a.out}/{c['id']}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{st:.2f}", "-to", f"{en:.2f}", "-i", a.wav48,
                    "-af", "afade=t=in:d=0.08,areverse,afade=t=in:d=0.25,areverse", "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart", out], check=True)
    print(f"\n{c['id']}  {st:.2f} -> {en:.2f}  ({en - st:.1f}s)")
    print("  START:", edge_words(st, min(en, st + 4)))
    print("  END:  ", edge_words(max(st, en - 4), en))
    result.append({**c, "start": round(st, 2), "end": round(en, 2), "dur": round(en - st, 2), "file": out})
json.dump(result, open(f"{a.out}/cuts.json", "w"), ensure_ascii=False, indent=1)
