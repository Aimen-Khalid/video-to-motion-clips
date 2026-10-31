"""One ~12 s voice sample per speaker, for the board's "whose voices?" picker.

  python speaker_samples.py transcript_spk.json audio16k.wav audio48k.wav out_dir

Takes the middle of each speaker's longest uninterrupted run. Writes out_dir/sample_<S>.mp4 and
prints speaker -> minutes of speech (for the picker's labels).
"""
import json, subprocess, sys, collections
tj = json.load(open(sys.argv[1])); segs = tj["segments"] if isinstance(tj, dict) else tj
wav48, out = sys.argv[3], sys.argv[4]
subprocess.run(["mkdir", "-p", out])
runs, cur, talk = {}, None, collections.Counter()
for x in segs:
    talk[x["spk"]] += x["end"] - x["start"]
    pure = all(w.get("spk", x["spk"]) == x["spk"] for w in x.get("words", []))
    if cur and cur["spk"] == x["spk"] and pure and x["start"] - cur["end"] < 1.5: cur["end"] = x["end"]
    else:
        cur = {"spk": x["spk"], "start": x["start"], "end": x["end"]} if pure else None
        if cur: runs.setdefault(x["spk"], []).append(cur)
for spk, rs in sorted(runs.items()):
    r = max(rs, key=lambda r: r["end"] - r["start"])
    mid = (r["start"] + r["end"]) / 2; st = max(r["start"], mid - 6); en = min(r["end"], st + 12)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{st:.2f}", "-to", f"{en:.2f}", "-i", wav48,
                    "-af", "afade=t=in:d=0.1,areverse,afade=t=in:d=0.2,areverse", "-c:a", "aac", "-b:a", "96k",
                    "-movflags", "+faststart", f"{out}/sample_{spk}.mp4"], check=True)
    print(spk, f"{talk[spk] / 60:.1f} min", f"sample at {int(st) // 60}:{int(st) % 60:02d}")
