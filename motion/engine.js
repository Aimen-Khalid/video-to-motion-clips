// Motion engine: renders one clip's timed beats with a style module, pipes frames to ffmpeg
// with the clip's original voice audio. Frame size follows clip.format: "9:16" -> 1080x1920
// (default), "16:9" -> 1920x1080. Styles must read H.W / H.H, never hard-code a size.
//   node engine.js <n>                 full render -> out/clipNN.mp4
//   node engine.js <n> --stills 1,8.5  PNG stills -> out/stills/clipNN_<t>.png
const fs = require("fs"), path = require("path"), { spawn, execFileSync } = require("child_process");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

let W = 1080, H = 1920; const FPS = 30;
const sizeFor = fmt => (fmt === "16:9" ? [1920, 1080] : [1080, 1920]);
const ROOT = __dirname;
const FS = path.join(ROOT, "node_modules/@fontsource");

// ---- fonts: family name -> files (woff2) -------------------------------------------------
function reg(pkg, file, family) {
  const p = path.join(FS, pkg, "files", file);
  if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, family);
}
const FONT_SETS = {
  "Fraunces": ["fraunces", ["latin-400-normal", "latin-600-normal", "latin-700-normal", "latin-400-italic", "latin-600-italic"]],
  "Inter": ["inter", ["latin-400-normal", "latin-500-normal", "latin-700-normal", "latin-800-normal"]],
  "Special Elite": ["special-elite", ["latin-400-normal"]],
  "Bangers": ["bangers", ["latin-400-normal"]],
  "Caveat": ["caveat", ["latin-400-normal", "latin-700-normal"]],
  "Patrick Hand": ["patrick-hand", ["latin-400-normal"]],
  "Playfair Display": ["playfair-display", ["latin-400-normal", "latin-700-normal", "latin-900-normal", "latin-400-italic", "latin-700-italic"]],
  "Amiri": ["amiri", ["latin-400-normal", "latin-700-normal", "arabic-400-normal", "arabic-700-normal", "latin-400-italic"]],
  "Noto Nastaliq Urdu": ["noto-nastaliq-urdu", ["arabic-400-normal", "arabic-700-normal"]],
  "Cormorant Garamond": ["cormorant-garamond", ["latin-400-normal", "latin-600-normal", "latin-700-normal", "latin-400-italic", "latin-600-italic"]],
  "Bebas Neue": ["bebas-neue", ["latin-400-normal"]],
  "Archivo Black": ["archivo-black", ["latin-400-normal"]],
  "DM Serif Display": ["dm-serif-display", ["latin-400-normal", "latin-400-italic"]],
  "Space Mono": ["space-mono", ["latin-400-normal", "latin-700-normal"]],
  "Libre Baskerville": ["libre-baskerville", ["latin-400-normal", "latin-700-normal", "latin-400-italic"]],
  "Oswald": ["oswald", ["latin-400-normal", "latin-500-normal", "latin-700-normal"]],
};
for (const [fam, [pkg, variants]] of Object.entries(FONT_SETS))
  for (const v of variants) reg(pkg, `${pkg}-${v}.woff2`, fam);

// ---- helpers handed to every style -------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  linear: t => t,
  inQuad: t => t * t, outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3), inCubic: t => t * t * t,
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1),
  outExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// smooth 1D value noise
function noise1(x, seed = 0) {
  const h = i => { let n = (i * 374761393 + seed * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}
function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/); const lines = []; let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
// largest font size (<= max) so the text fits in maxLines within maxW
function fitText(ctx, text, fontFn, maxW, maxSize, minSize = 36, maxLines = 4) {
  for (let s = maxSize; s >= minSize; s -= 2) {
    ctx.font = fontFn(s);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) return { size: s, lines };
  }
  ctx.font = fontFn(minSize); return { size: minSize, lines: wrap(ctx, text, maxW) };
}

// ---- data ----------------------------------------------------------------------------------
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, "spec.json"), "utf8"));

function voiceEnvelope(audioPath, dur) {
  // per-frame loudness 0..1 of the clip's voice, smoothed, for audio-reactive visuals
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", audioPath, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 28 });
  const s = new Int16Array(raw.buffer, raw.byteOffset, raw.length >> 1);
  const per = Math.round(16000 / FPS), n = Math.ceil(dur * FPS), env = new Float32Array(n);
  for (let f = 0; f < n; f++) { let sum = 0, c = 0; for (let i = f * per; i < (f + 1) * per && i < s.length; i++) { sum += s[i] * s[i]; c++; } env[f] = c ? Math.sqrt(sum / c) / 32768 : 0; }
  const sorted = Array.from(env).sort((a, b) => a - b), p95 = sorted[Math.floor(n * .95)] || 1;
  let prev = 0; for (let f = 0; f < n; f++) { const v = clamp(env[f] / p95); prev = v > prev ? lerp(prev, v, .6) : lerp(prev, v, .15); env[f] = prev; }
  return env;
}

// optional caption template chosen on the board (clip.captionStyle = {preset, overrides});
// needs captions/words.json (word timings: node captions/word-times.js, adapted to the project)
function captionLayer(clip) {
  if (!clip.captionStyle) return null;
  const C = require("./captions/captions.js");
  require("./captions/fonts-node.js")(GlobalFonts);
  C.load(fs.readFileSync(path.join(ROOT, "captions", "templates.json"), "utf8"));
  const values = C.resolve(clip.captionStyle.preset, clip.captionStyle.overrides || {});
  const words = JSON.parse(fs.readFileSync(path.join(ROOT, "captions", "words.json"), "utf8"))["clip" + clip.n] || [];
  return { C, values, groups: C.groupWords(words, values) };
}

function buildHelpers(clip) {
  const dur = clip.dur;
  const beats = clip.beats.map((b, i, arr) => ({ ...b, i, start: b.t, end: i + 1 < arr.length ? arr[i + 1].t : dur }));
  const env = voiceEnvelope(path.join(ROOT, clip.audio), dur);
  return {
    W, H, FPS, dur, clip, beats, env,
    // chrome text from spec.json: show label (top-left) and credit (bottom)
    meta: { label: SPEC.label || "", credit: SPEC.credit || "" },
    // true when the user picked a caption template on the board: the style must then skip
    // drawing its own captions (the shared caption layer draws them)
    externalCaptions: !!clip.captionStyle, clamp, lerp, ease, rng, noise1, wrap, fitText,
    voice: t => env[clamp(Math.floor(t * FPS), 0, env.length - 1)] || 0,
    beatAt: t => { let cur = beats[0]; for (const b of beats) if (t >= b.start) cur = b; return cur; },
    // phase of a beat at time t: inT 0..1 over `inDur`, outT 0..1 over `outDur` before its end
    phase: (b, t, inDur = .7, outDur = .45) => ({
      inT: clamp((t - b.start) / inDur), outT: clamp((t - (b.end - outDur)) / outDur),
      age: t - b.start, life: clamp((t - b.start) / Math.max(.01, b.end - b.start)),
      active: t >= b.start && t < b.end,
    }),
  };
}

// ---- render ----------------------------------------------------------------------------------
async function main() {
  const n = +process.argv[2];
  const clip = SPEC.clips.find(c => c.n === n);
  if (!clip) throw new Error("no clip " + n);
  [W, H] = sizeFor(clip.format);
  const style = require(path.join(ROOT, "styles", clip.styleFile));
  const Hh = buildHelpers(clip);
  const canvas = createCanvas(W, H), ctx = canvas.getContext("2d");
  const state = style.setup ? style.setup(Hh, ctx) : {};
  const cap = captionLayer(clip);
  const drawFrame = t => { ctx.save(); style.frame(ctx, t, Hh, state); ctx.restore();
    if (cap) { ctx.save(); cap.C.draw(ctx, { W, H, t, groups: cap.groups, values: cap.values, motion: "smooth" }); ctx.restore(); } };
  const outDir = path.join(ROOT, "out"); fs.mkdirSync(path.join(outDir, "stills"), { recursive: true });
  const tag = String(n).padStart(2, "0");

  const si = process.argv.indexOf("--stills");
  if (si > 0) {
    const times = process.argv[si + 1].split(",").map(Number);
    for (const t of times) {
      // advance stateful styles deterministically up to t
      if (style.prepare) style.prepare(ctx, t, Hh, state);
      drawFrame(t);
      const f = path.join(outDir, "stills", `clip${tag}_${t}.png`);
      fs.writeFileSync(f, await canvas.encode("png")); console.log(f);
    }
    return;
  }
  const out = path.join(outDir, `clip${tag}.mp4`);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-i", path.join(ROOT, clip.audio), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", out], { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.ceil(clip.dur * FPS);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    drawFrame(t);
    const buf = canvas.data();
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % (FPS * 10) === 0) process.stderr.write(`clip${tag} ${(t).toFixed(0)}/${clip.dur.toFixed(0)}s ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  console.log("wrote", out, ((Date.now() - t0) / 1000).toFixed(0) + "s");
}
main().catch(e => { console.error(e); process.exit(1); });
