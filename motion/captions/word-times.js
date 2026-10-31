// Word timing for Roman Urdu captions.
//   const { wordTimes } = require("./captions/word-times.js");
//   wordTimes(spec, urduTiming) -> { clip1: [{text, s, e}], ... }   (seconds from clip start)
//   node captions/word-times.js   -> writes captions/words.json
//
// Each beat (spec.clips[].beats[]: text, start t, ends at the next beat's t or the clip's dur) has
// Roman words; urdu_timing.json has the Urdu words actually spoken, with start times. Within a
// beat, the Roman words are spread over the Urdu words that start inside the beat's window,
// proportionally by text length, with boundaries snapped to Urdu word starts when there are at
// least as many Urdu words as Roman ones. Nothing is placed outside the beat.
const fs = require("fs");
const path = require("path");

const MAX_WORD_SECONDS = 0.8; // an Urdu word's end when the next one is far away (a pause)

/** Urdu words of one clip as [{s, e}], e = next word's start in the same row (capped), or the row's end. */
function urduWords(rows) {
  const out = [];
  for (const row of rows || []) {
    const ws = (row.w || []).filter((w) => String(w[1]).trim()).map((w) => w[0]).sort((a, b) => a - b);
    ws.forEach((s, i) => {
      const next = i + 1 < ws.length ? ws[i + 1] : Math.max(row.e, s + 0.2);
      out.push({ s, e: Math.max(s + 0.08, Math.min(next, s + MAX_WORD_SECONDS)) });
    });
  }
  return out.sort((a, b) => a.s - b.s);
}

const weight = (word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length) + 1;

/** Proportional spread of words over [a, b]. */
function spread(words, a, b) {
  const total = words.reduce((n, w) => n + weight(w), 0);
  let acc = 0;
  return words.map((w) => {
    const s = a + ((b - a) * acc) / total;
    acc += weight(w);
    return { text: w, s, e: a + ((b - a) * acc) / total };
  });
}

function round(x) { return Math.round(x * 1000) / 1000; }

function beatWords(text, bs, be, urdu) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const inBeat = urdu.filter((u) => u.s >= bs - 1e-6 && u.s < be).map((u) => ({ s: u.s, e: Math.min(u.e, be) }));
  let out;
  if (!inBeat.length) {
    out = spread(words, bs, be);
  } else if (inBeat.length < words.length) {
    out = spread(words, inBeat[0].s, inBeat[inBeat.length - 1].e);
  } else {
    // Snap: Roman word k takes Urdu words [cut[k], cut[k+1]); cuts follow the length proportions over the speech time.
    const n = words.length, m = inBeat.length;
    const a = inBeat[0].s, b = inBeat[m - 1].e;
    const total = words.reduce((x, w) => x + weight(w), 0);
    const cuts = [0];
    let acc = 0;
    for (let k = 1; k < n; k++) {
      acc += weight(words[k - 1]);
      const target = a + ((b - a) * acc) / total;
      let best = cuts[k - 1] + 1, bestD = Infinity;
      for (let j = cuts[k - 1] + 1; j <= m - (n - k); j++) {
        const d = Math.abs(inBeat[j].s - target);
        if (d < bestD) { bestD = d; best = j; }
      }
      cuts.push(best);
    }
    cuts.push(m);
    out = words.map((w, k) => ({ text: w, s: inBeat[cuts[k]].s, e: inBeat[cuts[k + 1] - 1].e }));
  }
  return out.map((w) => ({ text: w.text, s: round(Math.max(bs, w.s)), e: round(Math.min(be, Math.max(w.e, w.s + 0.05))) }));
}

function wordTimes(spec, urduTiming) {
  const result = {};
  for (const clip of spec.clips) {
    const timing = urduTiming[String(clip.n)] || urduTiming[clip.n] || {};
    const urdu = urduWords(timing.rows);
    const dur = clip.dur || timing.dur || Infinity;
    const beats = clip.beats || [];
    result["clip" + clip.n] = beats.flatMap((beat, i) => {
      const be = i + 1 < beats.length ? beats[i + 1].t : dur;
      return beatWords(beat.text, beat.t, be, urdu);
    });
  }
  return result;
}

module.exports = { wordTimes };

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const spec = JSON.parse(fs.readFileSync(path.join(root, "spec.json"), "utf8"));
  const urdu = JSON.parse(fs.readFileSync(path.join(root, "urdu_timing.json"), "utf8"));
  const words = wordTimes(spec, urdu);
  fs.writeFileSync(path.join(__dirname, "words.json"), JSON.stringify(words));
  console.log(Object.entries(words).map(([k, v]) => k + ":" + v.length).join(" "));
}
