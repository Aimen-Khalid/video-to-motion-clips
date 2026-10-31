// Preview check: the board must show what the MP4 will be.
//
// Draws the same moments of each clip twice, once with engine.js (the renderer) and once in the
// real board page in a headless browser, then compares them and writes side-by-side sheets.
// A style module that works in one and not the other (a context transform, a font, a Node-only
// call) shows up here as a big difference, before the user ever opens the board.
//
//   node check-preview.js --board <board dir> [--clips 2,6,8] [--times 1.5,6,12,20]
//
// <board dir> holds index.html and motion/ (written by build.js). Run build.js first.
// Needs playwright with Chromium (npm i playwright; npx playwright install chromium).
// Exit code 1 when any frame differs too much; sheets go to out/preview-check/.
const fs = require("fs"), path = require("path"), http = require("http");
const { execFileSync } = require("child_process");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const ROOT = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BOARD = path.resolve(arg("--board", path.join(ROOT, "..", "board")));
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, "spec.json"), "utf8"));
const OUT = path.join(ROOT, "out", "preview-check"); fs.mkdirSync(OUT, { recursive: true });
// Text antialiasing and font hinting differ a little between Skia-in-Node and Chrome; a broken
// preview (cropped, shifted, wrong scale, missing layer) differs far more than this.
const LIMIT = Number(arg("--limit", "0.06"));

let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { console.error("playwright is needed: npm i playwright && npx playwright install chromium"); process.exit(2); }

function serve(dir) {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };
  const srv = http.createServer((q, r) => {
    const f = path.join(dir, decodeURIComponent(q.url.split("?")[0]));
    if (!f.startsWith(dir)) { r.writeHead(403); return r.end(); }
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); r.end(d); });
  });
  return new Promise(res => srv.listen(0, "127.0.0.1", () => res(srv)));
}

// A stand-in for the artifact runtime: the board reads its rows from here.
function stubRuntime(rows) {
  const db = {
    collection: () => ({ orderBy: () => ({ onSnapshot: cb => setTimeout(() => cb({ docs: rows.map(r => ({ id: r.id, data: () => r })) }), 20) }),
      doc: () => ({ update: async () => {} }) }),
    doc: p => ({ onSnapshot: cb => setTimeout(() => cb(p === "board/meta" ? { exists: true, data: () => ({ stage: "motion", title: "check", speakers: {} }) } : { exists: false }), 10),
      update: async () => {}, get: async () => ({ exists: false }) }),
  };
  window.claude = { use: async k => (k === "db" ? db : null) };
}

async function diff(aPath, bBuf) {
  const [a, b] = await Promise.all([loadImage(aPath), loadImage(bBuf)]);
  const w = 270, h = Math.round(270 * a.height / a.width);           // compare at a small size: layout, not antialiasing
  const px = img => { const c = createCanvas(w, h), g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
  const A = px(a), B = px(b); let s = 0;
  for (let i = 0; i < A.length; i += 4) s += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 765;
  return { score: s / (w * h), a, b };
}

(async () => {
  const want = arg("--clips") ? arg("--clips").split(",").map(Number) : SPEC.clips.map(c => c.n);
  const clips = SPEC.clips.filter(c => want.includes(c.n));
  const rows = SPEC.clips.map(c => ({ id: "c" + c.n, n: c.n, title: c.title || "", idea: "", start: 0, end: c.dur, speaker: "", transcript: "", style: c.style, format: c.format || "9:16", audio: null }));
  const srv = await serve(BOARD);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(stubRuntime, rows);
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html#review`);
  await page.waitForFunction(() => document.querySelectorAll(".clip").length > 0, null, { timeout: 20000 });
  await page.evaluate(() => Promise.all([document.fonts.ready, typeof fontsReady !== "undefined" ? fontsReady : null]));

  let worst = 0, failed = [];
  for (const c of clips) {
    const times = (arg("--times") || [0.2, 0.4, 0.6, 0.8].map(f => (c.dur * f).toFixed(1)).join(",")).split(",").map(t => String(Number(t)));   // engine.js names stills by the number (8.0 -> 8)
    execFileSync(process.execPath, [path.join(ROOT, "engine.js"), String(c.n), "--stills", times.join(",")], { stdio: "ignore" });
    const pairs = [];
    for (const t of times) {
      const url = await page.evaluate(([n, t]) => {
        const card = document.querySelector(`.clip[data-n="${n}"]`); if (!card) return null;
        drawMotion(card, t); const cv = card.querySelector(".stage-canvas"); return cv ? cv.toDataURL("image/png") : null;
      }, [c.n, Number(t)]);
      if (!url) { failed.push(`#${c.n}: no preview in the board`); break; }
      const still = path.join(ROOT, "out", "stills", `clip${String(c.n).padStart(2, "0")}_${t}.png`);
      if (!fs.existsSync(still)) { failed.push(`#${c.n}: engine.js made no still at ${t}s`); continue; }
      const d = await diff(still, Buffer.from(url.split(",")[1], "base64"));
      worst = Math.max(worst, d.score); pairs.push({ t, ...d });
      if (d.score > LIMIT) failed.push(`#${c.n} at ${t}s differs by ${(d.score * 100).toFixed(1)}%`);
    }
    if (!pairs.length) continue;
    // sheet: renderer on top, board below, one column per moment
    const cw = 270, ch = Math.round(cw * pairs[0].a.height / pairs[0].a.width), sheet = createCanvas(cw * pairs.length, ch * 2 + 24), g = sheet.getContext("2d");
    g.fillStyle = "#111"; g.fillRect(0, 0, sheet.width, sheet.height); g.fillStyle = "#fff"; g.font = "14px sans-serif";
    pairs.forEach((p, i) => { g.drawImage(p.a, i * cw, 0, cw, ch); g.drawImage(p.b, i * cw, ch, cw, ch); g.fillText(`${p.t}s  diff ${(p.score * 100).toFixed(1)}%`, i * cw + 6, ch * 2 + 17); });
    const f = path.join(OUT, `clip${String(c.n).padStart(2, "0")}.png`); fs.writeFileSync(f, sheet.toBuffer("image/png"));
    console.log(`#${c.n}: worst ${(Math.max(...pairs.map(p => p.score)) * 100).toFixed(1)}%  sheet ${path.relative(ROOT, f)} (top: renderer, bottom: board)`);
  }
  await browser.close(); srv.close();
  if (errors.length) console.log("page errors:\n  " + [...new Set(errors)].join("\n  "));
  if (failed.length || errors.length) { console.log("PREVIEW DOES NOT MATCH THE RENDER:\n  " + failed.join("\n  ")); process.exit(1); }
  console.log(`preview matches the render (worst ${(worst * 100).toFixed(1)}%, limit ${LIMIT * 100}%)`);
})().catch(e => { console.error(e); process.exit(2); });
