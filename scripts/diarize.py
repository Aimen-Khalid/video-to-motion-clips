"""Speaker separation: ECAPA voice embeddings on short windows inside speech,
clustered; each word gets the label of the window covering its midpoint."""
import json, sys, wave, numpy as np, torch
# usage: python diarize.py audio16k.wav transcript.json transcript_spk.json [distance_threshold=THR]
WAV, TIN, TOUT = sys.argv[1], sys.argv[2], sys.argv[3]
THR = float(sys.argv[4]) if len(sys.argv) > 4 else 0.75
from collections import Counter
from speechbrain.inference.speaker import EncoderClassifier
from sklearn.cluster import AgglomerativeClustering

torch.set_num_threads(2)
wf = wave.open(WAV)
audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
SR = 16000
_j = json.load(open(TIN)); segs = _j["segments"] if isinstance(_j, dict) else _j

WIN, HOP = 2.0, 1.0
wins = []
for s in segs:
    a, b = s["start"], s["end"]
    if b - a < 0.8:
        continue
    t = a
    while True:
        e = min(t + WIN, b)
        if e - t >= 0.8:
            wins.append((t, e))
        if e >= b:
            break
        t += HOP

enc = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir="/tmp/ecapa", run_opts={"device": "cpu"})
embs = []
B = 32
for i in range(0, len(wins), B):
    batch = wins[i:i + B]
    L = int(WIN * SR)
    x = np.zeros((len(batch), L), np.float32); lens = []
    for j, (a, b) in enumerate(batch):
        chunk = audio[int(a * SR):int(b * SR)]
        x[j, :len(chunk)] = chunk; lens.append(len(chunk) / L)
    with torch.no_grad():
        e = enc.encode_batch(torch.from_numpy(x), torch.tensor(lens)).squeeze(1).numpy()
    embs.append(e)
E = np.concatenate(embs)
E = E / np.linalg.norm(E, axis=1, keepdims=True)

cl = AgglomerativeClustering(n_clusters=None, distance_threshold=THR, metric="cosine", linkage="average").fit(E)
labels = cl.labels_
# fold tiny clusters (<2% of windows) into nearest big cluster
cnt = Counter(labels); total = len(labels)
big = [k for k, v in cnt.items() if v / total >= 0.02]
cent = {k: E[labels == k].mean(0) for k in big}
for i, l in enumerate(labels):
    if l not in big:
        labels[i] = max(big, key=lambda k: E[i] @ cent[k])
# rename by talk time: S1 = most
order = [k for k, _ in Counter(labels).most_common()]
name = {k: f"S{i+1}" for i, k in enumerate(order)}

mids = np.array([(a + b) / 2 for a, b in wins])
for s in segs:
    for w in s["words"]:
        m = (w["s"] + w["e"]) / 2
        w["spk"] = name[labels[int(np.argmin(np.abs(mids - m)))]]
    c = Counter(w["spk"] for w in s["words"])
    s["spk"] = c.most_common(1)[0][0] if c else "S1"
json.dump(segs, open(TOUT, "w"), ensure_ascii=False)
tt = Counter()
for s in segs:
    tt[s["spk"]] += s["end"] - s["start"]
print("windows", len(wins), "speakers", {k: round(v / 60, 1) for k, v in tt.items()})
