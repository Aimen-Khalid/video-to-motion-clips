"""Transcribe a 16 kHz mono WAV with word timestamps (faster-whisper, CPU).

  python transcribe.py audio16k.wav out.json [--model small] [--lang auto|en|ur|...] [--task transcribe|translate]

- --lang auto detects the language from the first 30 s and prints it (use this first, on a
  short sample, so the intake can ask about on-screen text / caption language early).
- Source-language transcription (task=transcribe) gives the accurate word timings used for
  cutting, edge checks and caption timing. task=translate gives an English gloss for reading.
- Writes progress to <out>.progress so a monitor can follow it (~4-5x realtime on 2 cores).
- Audio is passed as a numpy array, not a path: the PyAV decoder in some installs breaks
  (TypeError: open() got an unexpected keyword argument 'metadata_errors').
"""
import argparse, json, time, wave
import numpy as np
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("wav"); ap.add_argument("out")
ap.add_argument("--model", default="small")
ap.add_argument("--lang", default="auto")
ap.add_argument("--task", default="transcribe", choices=["transcribe", "translate"])
ap.add_argument("--start", type=float, default=0); ap.add_argument("--end", type=float, default=0)
a = ap.parse_args()

wf = wave.open(a.wav); sr = wf.getframerate()
audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
if a.end: audio = audio[int(a.start * sr):int(a.end * sr)]
elif a.start: audio = audio[int(a.start * sr):]

t0 = time.time()
model = WhisperModel(a.model, device="cpu", compute_type="int8", cpu_threads=2)
segments, info = model.transcribe(audio, language=None if a.lang == "auto" else a.lang, task=a.task,
                                  beam_size=1, word_timestamps=True, vad_filter=True,
                                  condition_on_previous_text=False)
print(f"language: {info.language} (p={info.language_probability:.2f})", flush=True)
out = []
with open(a.out + ".progress", "w") as p:
    for s in segments:
        out.append({"start": round(s.start + a.start, 2), "end": round(s.end + a.start, 2), "text": s.text.strip(),
                    "words": [{"w": w.word, "s": round(w.start + a.start, 2), "e": round(w.end + a.start, 2)} for w in (s.words or [])]})
        p.write(f"{s.end + a.start:.0f}/{info.duration + a.start:.0f}s elapsed {time.time() - t0:.0f}s\n"); p.flush()
json.dump({"language": info.language, "segments": out}, open(a.out, "w"), ensure_ascii=False)
print("done", len(out), "segments in", round(time.time() - t0), "s")
