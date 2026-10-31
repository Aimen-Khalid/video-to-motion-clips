// EXAMPLE ONLY: one finished style module from the first run (clip "Salam is a promise of
// safety", Rain on glass). It's here to show the module API and some techniques (pre-baked
// layers, camera moves, voice-reactive motion, captions drawn as part of the look and skipped
// when H.externalCaptions is true). It is not a template or a house style; every clip should
// be designed fresh for its own content.
// Rain on glass, clip 1: "Salam is a promise of safety".
// We watch a rainy night street through a wet window (soft focus behind the glass, drops on it).
// STORYBOARD
//  0 hook   0.0  Two umbrella silhouettes walk toward each other under the shop lights; a "?" is
//                finger-drawn in the fog on the glass between them.
//  1 key    5.5  They stop. A warm orb of light leaves one and settles over the other as a glowing dome.
//  2 line   8.5  Rain darkens and pelts the dome; every drop bursts into sparks on it, none gets in.
//  3 line  11.5  The second figure sends the orb back; the dome swells to shelter both.
//  4 line  17.3  Camera pulls back: up and down the street other pairs light up under their own domes.
//  5 line  22.1  Wide street, passers-by cross and trade little sparks of light: every day, everyone.
//  6 key   25.8  Cut, later: the same two pass each other. The greeting still hangs in the air as a
//                glow between them, but sharp shards fly at each other's backs; the glow cracks,
//                the street turns cold.
//  7 line  35.4  Match cut to a warm arched mosque window across the street; a figure kneels on a
//                prayer mat, motes of light rising (niyyat, dua).
//  8 key   38.0  Push in to the chest: a glowing heart, and dark blots spreading through it.
//  9 line  42.9  Pull back; the figure bows in prayer. A shadow of smoke creeps up the wall, unhurried.
// 10 line  45.2  The heart is polished bright (shine sweep, sparkles); the shadow waits by the window.
// 11 line  47.7  Wide: the figure watches a passer-by in the street below; the shadow uncoils toward
//                that line of sight and forms a loop.
// 12 end   50.4  The snare closes on the gaze: the passer-by turns dark and thorned, the heart dims.
// Captions sit on a dark rounded plate in the caption zone.
const { createCanvas } = require("@napi-rs/canvas");

const C = {
  night: "#0a1320", deep: "#050a14", ink: "#f4efe6", dim: "rgba(244,239,230,0.62)",
  fig: "#070b14", rim: "rgba(255,196,130,0.6)", warm: "#ffc27a",
  lights: ["#ffb35c", "#ff7a59", "#f4d58d", "#6fd3e0", "#c48cff", "#ff9fb2"],
  shops: ["#ffb86b", "#ffcf8a", "#ff9a6a", "#7fd6dc", "#f7a6c0", "#ffd9a0", "#9fc4ff"],
};
const SERIF = (s, w = 600) => `italic ${w} ${s}px "Cormorant Garamond"`;
const SANS = (s, w = 500) => `${w} ${s}px Inter`;
const TAU = Math.PI * 2;
const GROUND = 1262;               // street scene: feet line (world)
const FIG_H = 330;
// shrine scene geometry (world)
const AX = 540, AT = 380, AW = 540, AB = 1180, B_GROUND = 1560;
const HIPS = { x: 620, y: 1132 };

// camera keyframes [t, cx, cy, z]; screen focus is (540, 900)
const CAM = [
  [0, 540, 980, .92], [3.2, 500, 990, 1.0], [5.5, 540, 1000, 1.08], [7.2, 660, 1040, 1.3], [8.5, 600, 1020, 1.18], [11.5, 540, 1000, 1.08],
  [13.6, 540, 1010, 1.0], [15.2, 540, 1040, 1.25], [17.3, 540, 1010, 1.2],
  [19.0, 540, 900, .5], [25.79, 580, 900, .53],
  [25.8, 540, 1000, 1.15], [28.3, 540, 1010, 1.22], [30.6, 540, 1060, 1.85], [32.4, 540, 1000, 1.0], [35.39, 540, 960, .8],
  [35.4, 540, 800, .95], [38.0, 540, 820, 1.05], [39.6, 585, 1035, 2.0], [42.9, 585, 1035, 2.1], [44.2, 560, 900, 1.05],
  [45.2, 560, 900, 1.05], [46.2, 595, 1030, 1.6], [47.7, 595, 1030, 1.6], [49.0, 600, 1000, .75], [50.4, 600, 1000, .75], [60, 600, 990, .84],
];

module.exports = {
  setup(H) {
    const r = H.rng(7);
    const sc = createCanvas(540, 960), sc2 = createCanvas(540, 960);
    return {
      sc, sx: sc.getContext("2d"), sc2, sx2: sc2.getContext("2d"),
      city: buildCity(H), shrine: buildShrine(H),
      bokeh: Array.from({ length: 16 }, () => ({ x: r() * H.W, y: r() * H.H * .8, rad: 60 + r() * 140, c: C.lights[Math.floor(r() * 6)], a: .08 + r() * .14, sp: .05 + r() * .2, ph: r() * 10 })),
      rain: Array.from({ length: 230 }, () => ({ x: r() * 1300 - 110, sp: 1700 + r() * 900, len: 40 + r() * 60, off: r() * 5000, k: r() })),
      drops: Array.from({ length: 380 }, () => ({ x: r() * H.W, y: r() * H.H, s: 2 + Math.pow(r(), 3) * 15, k: r() })),
      runners: Array.from({ length: 12 }, (_, i) => ({ x: 60 + r() * (H.W - 120), t0: r() * H.dur - 4, y0: -40 + r() * H.H * .5, v: 120 + r() * 240, seed: i * 13 + 5, s: 6 + r() * 6 })),
      spots: Array.from({ length: 11 }, () => ({ x: (r() - .5) * 1.6, y: (r() - .7) * 1.4, s: .18 + r() * .3, t: r() })),
      cracks: Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU + r() * .5; const pts = [[0, 0]]; let x = 0, y = 0; for (let k = 0; k < 4; k++) { x += Math.cos(a + (r() - .5)) * 22; y += Math.sin(a + (r() - .5)) * 22; pts.push([x, y]); } return pts; }),
      caps: {},
    };
  },

  frame(ctx, t, H, S) {
    const { W, H: HH } = H;
    const beat = H.beatAt(t), bi = beat.i;
    const cam = camAt(t, H);
    const v = H.voice(t);

    // ---- scene behind the glass (half-res, upscaled = soft focus) ----
    const sceneB = t >= 35.4;
    if (!sceneB || t < 36.1) drawStreet(S.sx, t, H, S, cam, v);
    if (sceneB) drawShrine(S.sx2, t, H, S, cam, v);
    ctx.imageSmoothingEnabled = true;
    if (!sceneB) ctx.drawImage(S.sc, 0, 0, W, HH);
    else if (t < 36.1) {
      const k = H.ease.inOutQuad(H.clamp((t - 35.4) / .7));
      ctx.drawImage(S.sc, 0, 0, W, HH); ctx.globalAlpha = k; ctx.drawImage(S.sc2, 0, 0, W, HH); ctx.globalAlpha = 1;
      // match flash: the hanging glow blooms into the window light
      const f = Math.sin(k * Math.PI);
      const g = ctx.createRadialGradient(W / 2, 860, 0, W / 2, 860, 700);
      g.addColorStop(0, `rgba(255,214,150,${.55 * f})`); g.addColorStop(1, "rgba(255,214,150,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, HH);
    } else ctx.drawImage(S.sc2, 0, 0, W, HH);

    // ---- the glass: fog at the edges, finger-drawn "?", drops, runners ----
    if (t < 6.2) {
      const a = H.clamp((t - .9) / .6) * (1 - H.clamp((t - 5.4) / .7));
      if (a > 0) {
        ctx.save(); ctx.font = `600 300px "Cormorant Garamond"`; ctx.textAlign = "center";
        ctx.fillStyle = `rgba(215,230,250,${.2 * a})`; ctx.fillText("?", W / 2, 640);
        ctx.fillStyle = `rgba(215,230,250,${.16 * a})`;
        for (let i = 0; i < 3; i++) { const dx = [-22, 8, 30][i], len = H.clamp((t - 1.6 - i * .4) / 2) * (40 + i * 25); ctx.fillRect(W / 2 + dx, 600 + i * 14, 5, len); }
        ctx.restore();
      }
    }
    if (!S.glass) {
      S.glass = createCanvas(W, HH); const gx = S.glass.getContext("2d");
      const fg = gx.createRadialGradient(W / 2, 880, 380, W / 2, 880, 1250);
      fg.addColorStop(0, "rgba(140,160,185,0)"); fg.addColorStop(1, "rgba(140,160,185,0.30)");
      gx.fillStyle = fg; gx.fillRect(0, 0, W, HH);
      for (const d of S.drops) {
        const s = d.s;
        gx.fillStyle = "rgba(6,11,20,0.30)"; gx.beginPath(); gx.ellipse(d.x, d.y + s * .15, s * .9, s, 0, 0, TAU); gx.fill();
        gx.fillStyle = `rgba(230,240,255,${.10 + d.k * .16})`; gx.beginPath(); gx.ellipse(d.x, d.y, s * .75, s * .85, 0, 0, TAU); gx.fill();
        if (s > 6) { gx.fillStyle = "rgba(255,255,255,0.5)"; gx.beginPath(); gx.arc(d.x - s * .3, d.y - s * .35, s * .18, 0, TAU); gx.fill(); }
      }
    }
    ctx.drawImage(S.glass, 0, 0);
    for (const d of []) {
      const s = d.s;
      ctx.fillStyle = "rgba(6,11,20,0.30)"; ctx.beginPath(); ctx.ellipse(d.x, d.y + s * .15, s * .9, s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(230,240,255,${.10 + d.k * .16})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, s * .75, s * .85, 0, 0, TAU); ctx.fill();
      if (s > 6) { ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(d.x - s * .3, d.y - s * .35, s * .18, 0, TAU); ctx.fill(); }
    }
    for (const R of S.runners) {
      const age = t - R.t0; if (age < 0) continue;
      const y = R.y0 + R.v * age; if (y > HH + 40) continue;
      const x = R.x + 10 * (H.noise1(y * .01, R.seed) - .5) * 2;
      ctx.strokeStyle = "rgba(220,235,255,0.10)"; ctx.lineWidth = R.s * .8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(R.x, Math.max(R.y0, y - 380)); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = "rgba(240,248,255,0.5)"; ctx.beginPath(); ctx.ellipse(x, y, R.s, R.s * 1.3, 0, 0, TAU); ctx.fill();
    }

    // ---- caption ----
    drawCaption(ctx, t, H, S);

    // ---- quiet chrome ----
    ctx.save();
    ctx.fillStyle = C.dim; ctx.font = SANS(26, 600); ctx.textAlign = "left";
    letterSpaced(ctx, "11TH HOUR", 72, 150, 6);
    ctx.font = SANS(26, 400); ctx.textAlign = "right"; ctx.fillStyle = "rgba(244,239,230,0.5)";
    ctx.fillText(`${String(bi + 1).padStart(2, "0")} / ${String(H.beats.length).padStart(2, "0")}`, W - 72, 150);
    ctx.fillStyle = "rgba(244,239,230,0.18)"; ctx.fillRect(72, HH - 170, W - 144, 3);
    ctx.fillStyle = "rgba(255,190,110,0.9)"; ctx.fillRect(72, HH - 170, (W - 144) * H.clamp(t / H.dur), 3);
    ctx.textAlign = "left"; ctx.font = SANS(24, 400); ctx.fillStyle = "rgba(244,239,230,0.55)";
    ctx.fillText("Why You Assume the Worst · Season 6, Ep. 6", 72, HH - 120);
    ctx.restore();

    const edge = Math.min(H.clamp(t / .6), H.clamp((H.dur - t) / .8));
    if (edge < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - edge})`; ctx.fillRect(0, 0, W, HH); }
  },
};

// ================================================================== camera
function camAt(t, H) {
  let a = CAM[0], b = CAM[CAM.length - 1];
  for (let i = 0; i < CAM.length - 1; i++) if (t >= CAM[i][0] && t < CAM[i + 1][0]) { a = CAM[i]; b = CAM[i + 1]; break; }
  if (t >= b[0]) a = b;
  const k = a === b ? 0 : H.ease.inOutCubic(H.clamp((t - a[0]) / (b[0] - a[0])));
  return { cx: H.lerp(a[1], b[1], k), cy: H.lerp(a[2], b[2], k), z: H.lerp(a[3], b[3], k) };
}
function toScreen(cam, x, y) { return [540 + (x - cam.cx) * cam.z, 900 + (y - cam.cy) * cam.z]; }
function applyCam(c, cam) { c.setTransform(.5, 0, 0, .5, 0, 0); c.translate(540, 900); c.scale(cam.z, cam.z); c.translate(-cam.cx, -cam.cy); }

// ================================================================== street scene
function pairAt(t, H) {
  if (t < 25.8) {
    const k = H.ease.outQuad(H.clamp(t / 5.2));
    const lx = H.lerp(-80, 400, k), rx = H.lerp(1160, 680, k);
    return { L: { x: lx, dir: 1, ph: (lx + 80) / 55 }, R: { x: rx, dir: -1, ph: (1160 - rx) / 55 + 1.5 } };
  }
  const k = H.ease.outQuad(H.clamp((t - 25.8) / 5.8));
  const lx = H.lerp(140, 900, k), rx = H.lerp(940, 180, k);
  return { L: { x: lx, dir: 1, ph: (lx - 140) / 55 }, R: { x: rx, dir: -1, ph: (940 - rx) / 55 + 1.5 } };
}

function drawStreet(c, t, H, S, cam, v) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = C.deep; c.fillRect(0, 0, 540, 960);
  applyCam(c, cam);
  const city = S.city;
  c.drawImage(city.cv, city.X0, city.Y0, city.Wd, city.Hd);
  const P = pairAt(t, H);
  const domes = [];   // screen-space circles that keep rain out
  const ph1 = t >= 25.8;

  // ---- other pairs down the street (wide shot) ----
  if (t > 16.8 && t < 26) {
    const extra = [[-380, -160, 17.9], [1240, 1460, 18.6], [-1050, -830, 19.4], [1880, 2100, 20.0]];
    for (const [a, b, t0] of extra) {
      const k = H.clamp((t - t0) / .7);
      person(c, a, GROUND, FIG_H, { dir: 1, ph: 0 }); person(c, b, GROUND, FIG_H, { dir: -1, ph: 1 });
      if (k > 0) { const m = (a + b) / 2; dome(c, m, GROUND, 290 * H.ease.outBack(k), k); domes.push({ x: m, r: 290 * k }); }
    }
    // passers-by trading sparks (beat 5)
    if (t > 21.6) {
      const k = H.clamp((t - 22.1) / 3.7);
      const ax = H.lerp(60, 1950, k), bx = H.lerp(1950, 60, k);
      person(c, ax, GROUND + 40, FIG_H * .95, { dir: 1, ph: (ax - 60) / 55 });
      person(c, bx, GROUND + 40, FIG_H * .95, { dir: -1, ph: (1950 - bx) / 55 });
      const cross = Math.abs(ax - bx);
      if (cross < 420) { const a = 1 - cross / 420; orb(c, (ax + bx) / 2, GROUND + 40 - FIG_H * .62, 70 + 40 * a, a); }
      // window sparks: little salams popping in lit windows
      for (let i = 0; i < 8; i++) {
        const tt = 22.3 + i * .42; const a = Math.sin(H.clamp((t - tt) / 1.1) * Math.PI);
        if (a > 0) orb(c, city.wins[i * 7 % city.wins.length][0], city.wins[i * 7 % city.wins.length][1], 50, a * .9);
      }
    }
  }

  // ---- the main pair ----
  if (!ph1) {
    // greeting dome over R (beat 1-2), over both (beat 3+)
    const g1 = H.clamp((t - 6.9) / .7), g2 = H.clamp((t - 13.0) / .8);
    const fadeOut = 1 - H.clamp((t - 25.4) / .4);
    if (g1 > 0 && g2 < 1) {
      const r = 200 * H.ease.outBack(g1) * (1 - g2) + 0;
      dome(c, P.R.x, GROUND, r, fadeOut * (1 - g2)); domes.push({ x: P.R.x, r });
    }
    if (g2 > 0) {
      const r = 360 * H.ease.outBack(g2) * (1 + .03 * v);
      dome(c, 540, GROUND, r, fadeOut); domes.push({ x: 540, r: r * fadeOut });
    }
    const fold = H.ease.inOutQuad(H.clamp((t - 14.6) / .8)) * (1 - H.clamp((t - 25.3) / .3));
    person(c, P.L.x, GROUND, FIG_H, { dir: 1, ph: P.L.ph, fold });
    person(c, P.R.x, GROUND, FIG_H, { dir: -1, ph: P.R.ph, fold });
    // the orb: L -> R (5.6..6.9), R -> L (11.8..13.0)
    orbFlight(c, t, H, 5.6, 6.95, P.L.x + 40, P.R.x - 10);
    orbFlight(c, t, H, 11.8, 13.0, P.R.x - 40, P.L.x + 10);
  } else {
    // later: they pass each other, the salam hangs in the air, shards fly
    const meet = 28.3;
    const ga = H.clamp((t - meet + .3) / .6);
    const sk = H.clamp((t - 28.9) / 4);   // how far the harm has gone
    person(c, P.L.x, GROUND, FIG_H, { dir: 1, ph: P.L.ph });
    person(c, P.R.x, GROUND, FIG_H, { dir: -1, ph: P.R.ph });
    if (ga > 0) {
      const fl = (1 - sk * .45 * (.5 + .5 * Math.sin(t * 23) * Math.sin(t * 7.3))) * (1 - .55 * H.clamp((t - 32.6) / 2));
      orb(c, 540, GROUND - 210, (95 + 10 * Math.sin(t * 2)) * (1 - .4 * H.clamp((t - 32.6) / 2)), ga * fl);
      if (sk > 0) {
        c.strokeStyle = `rgba(255,236,210,${.85 * ga})`; c.lineWidth = 3;
        for (const cr of S.cracks) {
          const n = Math.ceil(sk * (cr.length - 1));
          c.beginPath(); c.moveTo(540 + cr[0][0], GROUND - 210 + cr[0][1]);
          for (let k = 1; k <= n; k++) c.lineTo(540 + cr[k][0] * 1.6, GROUND - 210 + cr[k][1] * 1.6);
          c.stroke();
        }
      }
    }
    // shards: each figure throws at the other's back
    if (t > 28.9) {
      for (let e = 0; e < 26; e++) {
        const t0 = 28.9 + e * .17 + (e > 12 ? .9 : 0), age = t - t0, life = 1.0;
        if (age < 0 || age > life) continue;
        const fromL = e % 2 === 0, src = fromL ? P.L : P.R, dst = fromL ? P.R : P.L;
        const k = age / life, sy = GROUND - 220, dy = GROUND - 200 + ((e * 37) % 60 - 30);
        const x = H.lerp(src.x, dst.x, k), y = H.lerp(sy, dy, k) - Math.sin(k * Math.PI) * (90 + (e % 3) * 40);
        shard(c, x, y, 18 + (e % 3) * 6, t * 9 + e, 1 - H.clamp((k - .92) / .08));
        if (k > .85) { // hit flash on the target's back
          const a = (1 - k) / .15; const hg = c.createRadialGradient(dst.x, dy, 0, dst.x, dy, 60);
          hg.addColorStop(0, `rgba(255,80,90,${.7 * a})`); hg.addColorStop(1, "rgba(255,80,90,0)");
          c.fillStyle = hg; c.fillRect(dst.x - 60, dy - 60, 120, 120);
        }
      }
    }
  }

  // ---- rain (screen space), kept out of domes ----
  c.setTransform(.5, 0, 0, .5, 0, 0);
  const sd = domes.filter(d => d.r > 5).map(d => { const [x, y] = toScreen(cam, d.x, GROUND); return { x, y, r: d.r * cam.z }; });
  const harsh = (t > 8.5 && t < 11.6) || t > 28.9;
  const n = ph1 ? 230 : 170;
  c.lineWidth = 2; c.strokeStyle = harsh ? "rgba(170,190,225,0.42)" : "rgba(180,200,230,0.32)";
  c.beginPath();
  const splashes = [];
  for (let i = 0; i < n; i++) {
    const R = S.rain[i];
    const y = ((t * R.sp + R.off) % 2200) - 140, x = R.x + y * .12;
    let y2 = y + R.len;
    let skip = false;
    for (const d of sd) {
      const dx = x - d.x; if (Math.abs(dx) >= d.r) continue;
      const top = d.y - Math.sqrt(d.r * d.r - dx * dx);
      if (y > top && y < d.y) { skip = true; break; }
      if (y2 > top && y < top) { y2 = top; splashes.push([x, top]); }
    }
    if (skip) continue;
    c.moveTo(x, y); c.lineTo(x + R.len * .12, y2);
  }
  c.stroke();
  for (const [x, y] of splashes) {
    c.fillStyle = harsh ? "rgba(255,226,170,0.9)" : "rgba(255,226,170,0.6)";
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x + (k - 1) * 9, y - 6 - (k % 2) * 6, 3, 0, TAU); c.fill(); }
  }
  // cold shift as the harm spreads
  if (ph1) { const k = H.clamp((t - 29) / 4); c.fillStyle = `rgba(20,40,95,${.28 * k})`; c.fillRect(0, 0, 1080, 1920); }
  // bokeh in front
  c.globalCompositeOperation = "lighter";
  for (const o of S.bokeh) {
    const x = o.x + Math.sin(t * o.sp + o.ph) * 30, y = o.y + Math.cos(t * o.sp * .7 + o.ph) * 20, a = o.a * (.85 + .3 * v);
    const rg = c.createRadialGradient(x, y, 0, x, y, o.rad);
    rg.addColorStop(0, hexA(o.c, a)); rg.addColorStop(1, hexA(o.c, 0));
    c.fillStyle = rg; c.fillRect(x - o.rad, y - o.rad, o.rad * 2, o.rad * 2);
  }
  c.globalCompositeOperation = "source-over";
}

function orbFlight(c, t, H, t0, t1, x0, x1) {
  if (t < t0 - .2 || t > t1 + .1) return;
  const k = H.ease.inOutQuad(H.clamp((t - t0) / (t1 - t0)));
  const y0 = GROUND - FIG_H * .62;
  for (let i = 6; i >= 0; i--) { // trail
    const kk = Math.max(0, k - i * .035);
    const x = H.lerp(x0, x1, kk), y = y0 - Math.sin(kk * Math.PI) * 110;
    orb(c, x, y, (i === 0 ? 70 : 34 - i * 3), (i === 0 ? 1 : .5 - i * .06) * H.clamp((t - t0 + .2) / .2));
  }
}
function orb(c, x, y, r, a) {
  if (a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,250,230,${a})`); g.addColorStop(.25, `rgba(255,214,140,${.8 * a})`); g.addColorStop(1, "rgba(255,170,80,0)");
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function dome(c, x, foot, r, a) {
  if (r <= 1 || a <= 0) return;
  const g = c.createRadialGradient(x, foot, 0, x, foot, r);
  g.addColorStop(0, `rgba(255,205,130,${.34 * a})`); g.addColorStop(.82, `rgba(255,190,110,${.16 * a})`); g.addColorStop(1, `rgba(255,190,110,${.05 * a})`);
  c.fillStyle = g; c.beginPath(); c.arc(x, foot, r, Math.PI, TAU); c.closePath(); c.fill();
  c.strokeStyle = `rgba(255,222,170,${.75 * a})`; c.lineWidth = 5; c.beginPath(); c.arc(x, foot, r, Math.PI, TAU); c.stroke();
  // warm pool on the wet street
  c.fillStyle = `rgba(255,190,110,${.18 * a})`; c.beginPath(); c.ellipse(x, foot + 14, r, r * .12, 0, 0, TAU); c.fill();
}
function shard(c, x, y, s, rot, a) {
  if (a <= 0) return;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * .6, s * .45); c.lineTo(-s * .3, -s * .5); c.closePath();
  c.fillStyle = `rgba(235,242,255,${a})`; c.fill(); c.strokeStyle = `rgba(255,70,85,${a})`; c.lineWidth = 3; c.stroke();
  c.restore();
}

// anonymous silhouette with umbrella, facing dir, walk phase ph
function person(c, x, foot, h, o) {
  const dir = o.dir, ph = o.ph || 0, col = o.col || C.fig;
  const bob = -Math.abs(Math.sin(ph)) * h * .012;
  c.save(); c.translate(x, foot + bob);
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = "round";
  // legs
  c.lineWidth = h * .075;
  const sw = Math.sin(ph) * .38;
  for (const s of [sw, -sw]) { c.beginPath(); c.moveTo(0, -h * .46); c.lineTo(Math.sin(s) * h * .45, -h * .03 + Math.abs(Math.sin(s)) * h * .02); c.stroke(); }
  // coat
  c.beginPath();
  c.moveTo(-h * .1, -h * .79); c.lineTo(h * .1, -h * .79);
  c.quadraticCurveTo(h * .15, -h * .6, h * .16, -h * .36); c.lineTo(-h * .16, -h * .36);
  c.quadraticCurveTo(-h * .15, -h * .6, -h * .1, -h * .79); c.fill();
  // head
  c.beginPath(); c.arc(dir * h * .02, -h * .87, h * .075, 0, TAU); c.fill();
  // umbrella
  if (o.umb !== false) {
    const ux = dir * h * .06;
    c.lineWidth = h * .014; c.beginPath(); c.moveTo(dir * h * .12, -h * .58); c.lineTo(ux, -h * 1.08); c.stroke();
    c.lineWidth = h * .045; c.beginPath(); c.moveTo(dir * h * .1, -h * .78); c.lineTo(dir * h * .12, -h * .6); c.stroke();
    const R = h * .34 * (1 - (o.fold || 0) * .82), cy = -h * 1.02;
    c.beginPath(); c.arc(ux, cy, R, Math.PI, TAU);
    for (let i = 4; i >= 1; i--) c.quadraticCurveTo(ux - R + (i - .5) * R / 2, cy - R * .12, ux - R + (i - 1) * R / 2, cy);
    c.fill();
    c.strokeStyle = o.rim || C.rim; c.lineWidth = 4; c.beginPath(); c.arc(ux, cy, R, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  }
  c.restore();
}

function buildCity(H) {
  const X0 = -1700, Y0 = -900, Wd = 4400, Hd = 2800, k = .5;
  const cv = createCanvas(Wd * k, Hd * k), b = cv.getContext("2d");
  b.scale(k, k); b.translate(-X0, -Y0);
  const r = H.rng(21);
  const sky = b.createLinearGradient(0, Y0, 0, GROUND);
  sky.addColorStop(0, "#04080f"); sky.addColorStop(.6, "#0c1628"); sky.addColorStop(1, "#2a2236");
  b.fillStyle = sky; b.fillRect(X0, Y0, Wd, Hd);
  // far skyline
  for (let x = X0; x < X0 + Wd;) { const w = 120 + r() * 200, top = 200 + r() * 450; b.fillStyle = "#101828"; b.fillRect(x, top, w, GROUND - top);
    for (let i = 0; i < 10; i++) if (r() < .6) { b.fillStyle = `rgba(255,210,150,${.15 + r() * .2})`; b.fillRect(x + r() * (w - 10), top + 20 + r() * 500, 8, 10); } x += w; }
  const wins = [];
  // near buildings with lit shopfronts
  for (let x = X0; x < X0 + Wd;) {
    const w = 280 + r() * 260, top = 80 + r() * 520;
    b.fillStyle = r() < .5 ? "#0b111d" : "#0e1524"; b.fillRect(x, top, w, GROUND - top);
    for (let yy = top + 60; yy < 820; yy += 92) for (let xx = x + 30; xx < x + w - 50; xx += 72) {
      const lit = r(); if (lit < .28) { const cc = r() < .75 ? "255,206,140" : "160,215,255"; b.fillStyle = `rgba(${cc},${.35 + r() * .4})`; b.fillRect(xx, yy, 36, 52); if (r() < .4) wins.push([xx + 18, yy + 26]); }
      else { b.fillStyle = "rgba(255,255,255,0.03)"; b.fillRect(xx, yy, 36, 52); }
    }
    // shopfront
    b.fillStyle = "#06090f"; b.fillRect(x, 880, w, 52);
    const panes = 2 + Math.floor(r() * 2), pw = (w - 24) / panes, col = C.shops[Math.floor(r() * C.shops.length)];
    for (let p = 0; p < panes; p++) {
      const px = x + 12 + p * pw;
      const g = b.createLinearGradient(0, 935, 0, GROUND - 30);
      g.addColorStop(0, hexA(col, .95)); g.addColorStop(1, hexA(col, .55));
      b.fillStyle = g; b.fillRect(px + 6, 935, pw - 12, GROUND - 30 - 935);
      b.fillStyle = "rgba(0,0,0,0.25)"; b.fillRect(px + 6 + (pw - 12) * .5 - 3, 935, 6, GROUND - 30 - 935);
      // reflection on wet street
      const rg = b.createLinearGradient(0, 1312, 0, 1800);
      rg.addColorStop(0, hexA(col, .3)); rg.addColorStop(1, hexA(col, 0));
      b.fillStyle = rg; b.fillRect(px + 6, 1312, pw - 12, 490);
    }
    x += w;
  }
  // sidewalk, curb, street
  b.fillStyle = "#1b2232"; b.fillRect(X0, GROUND - 30, Wd, 80);
  b.fillStyle = "rgba(255,210,160,0.12)"; b.fillRect(X0, GROUND - 30, Wd, 3);
  b.fillStyle = "#2a3346"; b.fillRect(X0, 1300, Wd, 12);
  b.globalCompositeOperation = "destination-over"; b.fillStyle = "#0a0f19"; b.fillRect(X0, 1312, Wd, Hd); b.globalCompositeOperation = "source-over";
  b.fillStyle = "rgba(5,8,14,0.35)"; for (let y = 1320; y < Y0 + Hd; y += 16) b.fillRect(X0, y, Wd, 5);
  // street lamps
  for (const lx of [-1560, -720, 110, 970, 1800, 2640]) {
    const cone = b.createLinearGradient(0, 640, 0, GROUND);
    cone.addColorStop(0, "rgba(255,205,140,0.22)"); cone.addColorStop(1, "rgba(255,205,140,0.04)");
    b.fillStyle = cone; b.beginPath(); b.moveTo(lx - 20, 650); b.lineTo(lx + 20, 650); b.lineTo(lx + 230, GROUND); b.lineTo(lx - 230, GROUND); b.closePath(); b.fill();
    b.fillStyle = "#04070c"; b.fillRect(lx - 7, 640, 14, GROUND - 640); b.fillRect(lx - 30, 628, 60, 18);
    const g = b.createRadialGradient(lx, 650, 0, lx, 650, 170); g.addColorStop(0, "rgba(255,236,190,0.95)"); g.addColorStop(.2, "rgba(255,200,130,0.45)"); g.addColorStop(1, "rgba(255,200,130,0)");
    b.fillStyle = g; b.fillRect(lx - 170, 480, 340, 340);
    b.fillStyle = "rgba(255,200,130,0.25)"; b.beginPath(); b.ellipse(lx, GROUND + 20, 260, 26, 0, 0, TAU); b.fill();
    const rf = b.createLinearGradient(0, 1312, 0, 1900); rf.addColorStop(0, "rgba(255,210,150,0.35)"); rf.addColorStop(1, "rgba(255,210,150,0)");
    b.fillStyle = rf; b.fillRect(lx - 16, 1312, 32, 590);
  }
  return { cv, X0, Y0, Wd, Hd, wins };
}

// ================================================================== shrine scene
function archPath(c, cx, top, w, bottom) {
  const x0 = cx - w / 2, x1 = cx + w / 2, spring = top + w * .62;
  c.beginPath(); c.moveTo(x0, bottom); c.lineTo(x0, spring);
  c.bezierCurveTo(x0, spring - w * .38, cx - w * .14, top + w * .1, cx, top);
  c.bezierCurveTo(cx + w * .14, top + w * .1, x1, spring - w * .38, x1, spring);
  c.lineTo(x1, bottom); c.closePath();
}
function buildShrine(H) {
  const X0 = -800, Y0 = -500, Wd = 2700, Hd = 3000, k = .7;
  const cv = createCanvas(Math.round(Wd * k), Math.round(Hd * k)), b = cv.getContext("2d");
  b.scale(k, k); b.translate(-X0, -Y0);
  const r = H.rng(33);
  b.fillStyle = "#1a2232"; b.fillRect(X0, Y0, Wd, Hd);
  // stone courses
  for (let y = Y0, row = 0; y < B_GROUND; y += 72, row++) {
    for (let x = X0 - (row % 2) * 80; x < X0 + Wd; x += 160) {
      b.fillStyle = `rgba(${r() < .5 ? "255,255,255" : "0,0,0"},${.02 + r() * .04})`; b.fillRect(x + 3, y + 3, 154, 66);
    }
    b.fillStyle = "rgba(0,0,0,0.28)"; b.fillRect(X0, y, Wd, 3);
  }
  // other dim windows
  for (const [x, y] of [[-420, 300], [-420, 900], [1500, 300], [1500, 900], [1150, -200], [-80, -250]]) {
    b.fillStyle = "#0b101a"; b.fillRect(x - 10, y - 10, 200, 280);
    b.fillStyle = `rgba(150,190,255,${.08 + r() * .1})`; b.fillRect(x, y, 180, 260);
  }
  // warm spill on wall
  const sp = b.createRadialGradient(AX, 820, 100, AX, 820, 900);
  sp.addColorStop(0, "rgba(255,180,90,0.32)"); sp.addColorStop(1, "rgba(255,180,90,0)");
  b.fillStyle = sp; b.fillRect(X0, Y0, Wd, Hd);
  // frame + interior
  b.fillStyle = "#0d1220"; archPath(b, AX, AT - 46, AW + 84, AB + 10); b.fill();
  b.save(); archPath(b, AX, AT, AW, AB); b.clip();
  const g = b.createRadialGradient(AX, 900, 40, AX, 860, 640);
  g.addColorStop(0, "#ffe6a8"); g.addColorStop(.55, "#f4ad52"); g.addColorStop(1, "#b0602a");
  b.fillStyle = g; b.fillRect(AX - AW, AT - 50, AW * 2, AB - AT + 100);
  // lattice
  b.strokeStyle = "rgba(120,58,18,0.16)"; b.lineWidth = 3;
  for (let d = -1400; d < 1400; d += 64) { b.beginPath(); b.moveTo(AX + d, AT); b.lineTo(AX + d + 900, AT + 900); b.stroke(); b.beginPath(); b.moveTo(AX + d, AT); b.lineTo(AX + d - 900, AT + 900); b.stroke(); }
  // floor + mat
  b.fillStyle = "rgba(150,80,30,0.35)"; b.fillRect(AX - AW, 1110, AW * 2, 90);
  b.fillStyle = "#7c1f26"; b.beginPath(); b.moveTo(360, 1118); b.lineTo(770, 1118); b.lineTo(800, 1180); b.lineTo(330, 1180); b.closePath(); b.fill();
  b.strokeStyle = "#e3aa50"; b.lineWidth = 5; b.beginPath(); b.moveTo(372, 1126); b.lineTo(760, 1126); b.lineTo(784, 1172); b.lineTo(346, 1172); b.closePath(); b.stroke();
  b.fillStyle = "#e3aa50"; b.beginPath(); b.moveTo(372, 1170); b.lineTo(372, 1146); b.quadraticCurveTo(392, 1128, 412, 1146); b.lineTo(412, 1170); b.closePath(); b.fill();
  // hanging lamp
  b.strokeStyle = "rgba(80,40,10,0.7)"; b.lineWidth = 3; b.beginPath(); b.moveTo(AX, AT); b.lineTo(AX, 560); b.stroke();
  const lg = b.createRadialGradient(AX, 590, 0, AX, 590, 160); lg.addColorStop(0, "rgba(255,255,230,1)"); lg.addColorStop(1, "rgba(255,240,200,0)");
  b.fillStyle = lg; b.fillRect(AX - 160, 430, 320, 320);
  b.fillStyle = "#6a3410"; b.beginPath(); b.moveTo(AX - 22, 565); b.lineTo(AX + 22, 565); b.lineTo(AX + 14, 610); b.lineTo(AX - 14, 610); b.closePath(); b.fill();
  b.restore();
  // sill
  b.fillStyle = "#2c3448"; b.fillRect(AX - AW / 2 - 50, AB, AW + 100, 28);
  b.fillStyle = "rgba(255,200,130,0.25)"; b.fillRect(AX - AW / 2 - 50, AB, AW + 100, 3);
  // street
  b.fillStyle = "#1c2433"; b.fillRect(X0, B_GROUND - 30, Wd, 80);
  b.fillStyle = "rgba(255,210,160,0.14)"; b.fillRect(X0, B_GROUND - 30, Wd, 3);
  b.fillStyle = "#0a0f18"; b.fillRect(X0, B_GROUND + 50, Wd, Hd);
  const rf = b.createLinearGradient(0, B_GROUND + 50, 0, B_GROUND + 700); rf.addColorStop(0, "rgba(255,190,100,0.32)"); rf.addColorStop(1, "rgba(255,190,100,0)");
  b.fillStyle = rf; b.fillRect(AX - AW / 2, B_GROUND + 50, AW, 650);
  b.fillStyle = "rgba(5,8,14,0.4)"; for (let y = B_GROUND + 56; y < Y0 + Hd; y += 16) b.fillRect(X0, y, Wd, 5);
  return { cv, X0, Y0, Wd, Hd };
}

function drawShrine(c, t, H, S, cam, v) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#121a28"; c.fillRect(0, 0, 540, 960);
  applyCam(c, cam);
  const sh = S.shrine;
  c.drawImage(sh.cv, sh.X0, sh.Y0, sh.Wd, sh.Hd);

  // pose: bow cycles in beat 9 (praying), head turns toward street from 47.7
  let bow = 0;
  if (t > 42.9 && t < 45.6) bow = Math.pow(Math.sin(H.clamp((t - 43.0) / 2.4) * Math.PI), 1.4);
  const look = H.ease.inOutQuad(H.clamp((t - 47.9) / .8));
  const a = H.lerp(-Math.PI * .53, -Math.PI * .86, bow);
  const L = 150;
  const sx = HIPS.x + Math.cos(a) * L, sy = HIPS.y + Math.sin(a) * L;
  const hx = sx + Math.cos(a) * 58 + look * 16, hy = sy + Math.sin(a) * 58;

  // prayer motes (beat 7)
  if (t < 43) for (let i = 0; i < 14; i++) {
    const tt = (t - 35.4) * .5 + i / 14; const k = tt % 1; const al = Math.sin(k * Math.PI) * H.clamp((t - 35.6) / .8) * (1 - H.clamp((t - 38.2) / .8));
    if (al > 0) orb(c, HIPS.x - 60 + (i * 53 % 140) + Math.sin(t + i) * 10, 980 - k * 520, 22, al * .9);
  }
  // figure (kneeling silhouette)
  const col = "#2a1408";
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = "round";
  c.beginPath(); c.ellipse(HIPS.x + 20, 1150, 85, 30, 0, 0, TAU); c.fill();
  c.lineWidth = 92; c.beginPath(); c.moveTo(HIPS.x, HIPS.y); c.lineTo(sx, sy); c.stroke();
  c.beginPath(); c.arc(hx, hy, 40, 0, TAU); c.fill();
  // arms resting forward
  c.lineWidth = 26; c.beginPath(); c.moveTo(sx - 6, sy + 20); c.lineTo(HIPS.x - 60 - bow * 40, HIPS.y - 10 + bow * 10); c.stroke();

  // the heart (beats 8-12)
  const hv = H.clamp((t - 38.2) / .7);
  if (hv > 0) {
    const cxh = HIPS.x + Math.cos(a) * L * .6 - 4, cyh = HIPS.y + Math.sin(a) * L * .6 + 4, s = 24;
    const spread = H.clamp((t - 38.6) / 3.5);                         // dark blots grow
    const polish = H.clamp((t - 45.4) / 1.6);                         // ... and get polished away
    const dark = H.clamp((t - 50.7) / 1.0);                           // final: dims again
    const glow = c.createRadialGradient(cxh, cyh, 0, cxh, cyh, s * 4);
    const gc = dark > 0 ? `rgba(${Math.round(255 - 140 * dark)},${Math.round(90 - 60 * dark)},90,` : "rgba(255,110,90,";
    glow.addColorStop(0, gc + (.6 * hv) + ")"); glow.addColorStop(1, gc + "0)");
    c.fillStyle = glow; c.fillRect(cxh - s * 4, cyh - s * 4, s * 8, s * 8);
    c.save(); heartPath(c, cxh, cyh, s);
    c.fillStyle = dark > 0 ? mixHex("#ff4a4a", "#3a0c10", dark) : "#ff4a4a"; c.globalAlpha = hv; c.fill();
    c.clip();
    const blot = spread * (1 - polish);
    for (const p of S.spots) {
      const k = H.clamp((blot - p.t * .6) / .4); if (k <= 0) continue;
      c.fillStyle = "rgba(20,4,8,0.9)"; c.beginPath(); c.arc(cxh + p.x * s, cyh + p.y * s, p.s * s * k * 1.4, 0, TAU); c.fill();
    }
    if (polish > 0 && polish < 1) { // shine sweep
      const xx = cxh - s * 2 + polish * s * 4;
      c.fillStyle = "rgba(255,255,255,0.75)"; c.beginPath(); c.moveTo(xx - 10, cyh - s * 2); c.lineTo(xx + 6, cyh - s * 2); c.lineTo(xx - 14, cyh + s * 2); c.lineTo(xx - 30, cyh + s * 2); c.fill();
    }
    c.restore(); c.globalAlpha = 1;
    c.strokeStyle = `rgba(255,220,200,${.8 * hv})`; c.lineWidth = 2.5; heartPath(c, cxh, cyh, s); c.stroke();
    if (t > 45.6 && t < 48.2) for (let i = 0; i < 4; i++) { // sparkles
      const k = Math.sin(H.clamp((t - 45.8 - i * .35) / .7) * Math.PI);
      if (k > 0) sparkle(c, cxh + [-40, 36, 30, -30][i], cyh + [-36, -30, 30, 26][i], 16 * k);
    }
  }

  // passer-by on the street below (beats 11-12)
  let px = 0, phead = null;
  if (t > 46.5) {
    const k = H.clamp((t - 46.8) / 5.2);
    px = H.lerp(1250, 830, k);
    const dk = H.clamp((t - 50.8) / .7);
    const lg = c.createRadialGradient(px, B_GROUND - 150, 0, px, B_GROUND - 150, 300);
    lg.addColorStop(0, `rgba(255,205,140,${.55 * (1 - dk * .6)})`); lg.addColorStop(1, "rgba(255,205,140,0)");
    c.fillStyle = lg; c.fillRect(px - 300, B_GROUND - 450, 600, 520);
    if (dk > 0) { // what we assume: dark thorns around him
      c.strokeStyle = `rgba(230,40,70,${.95 * dk})`; c.lineWidth = 9;
      for (let i = 0; i < 14; i++) {
        const an = -Math.PI * .1 - i / 13 * Math.PI * .8 - Math.PI * .0, r0 = 150, r1 = 150 + 70 * dk * (1 + (i % 3) * .3);
        const ccx = px, ccy = B_GROUND - 180;
        c.beginPath(); c.moveTo(ccx + Math.cos(an) * r0, ccy + Math.sin(an) * r0 * 1.2); c.lineTo(ccx + Math.cos(an) * r1, ccy + Math.sin(an) * r1 * 1.2); c.stroke();
      }
      const ag = c.createRadialGradient(px, B_GROUND - 170, 0, px, B_GROUND - 170, 240);
      ag.addColorStop(0, `rgba(120,10,30,${.55 * dk})`); ag.addColorStop(1, "rgba(120,10,30,0)");
      c.fillStyle = ag; c.fillRect(px - 240, B_GROUND - 410, 480, 480);
    }
    person(c, px, B_GROUND, FIG_H, { dir: -1, ph: (1250 - px) / 55, col: dk > 0 ? mixHex("#070b14", "#2a0208", dk) : C.fig, rim: "rgba(255,196,130,0.55)" });
    phead = [px - 4, B_GROUND - FIG_H * .87];
  }
  // gaze line
  const gz = H.clamp((t - 48.3) / .6);
  let snare = null;
  if (phead && gz > 0) {
    const closed = H.clamp((t - 50.6) / .5);
    c.save(); c.setLineDash([16, 14]); c.lineDashOffset = -t * 40;
    c.strokeStyle = closed > 0 ? `rgba(${Math.round(255 - 60 * closed)},${Math.round(220 - 170 * closed)},${Math.round(160 - 110 * closed)},${.85 * gz})` : `rgba(255,220,160,${.85 * gz})`;
    c.lineWidth = 6; c.beginPath(); c.moveTo(hx + 30, hy + 6);
    c.lineTo(H.lerp(hx + 30, phead[0], gz), H.lerp(hy + 6, phead[1], gz)); c.stroke(); c.restore();
    snare = [H.lerp(hx + 30, phead[0], .55), H.lerp(hy + 6, phead[1], .55)];
  }

  // the shadow: a smoke tendril creeping up the wall, then a snare on the gaze
  if (t > 42.6) {
    const grow = H.clamp((t - 42.9) / 3.5);
    const pts = [[110, 1720], [190, 1460], [240, 1220], [300, 1040], [340, 930]];
    let path = polyResample(pts, 26);
    path = path.slice(0, Math.max(2, Math.ceil(path.length * H.ease.outQuad(grow))));
    if (snare && t > 47.9) {
      const reach = H.ease.inOutQuad(H.clamp((t - 47.9) / 1.6));
      const rr = H.lerp(110, 24, H.ease.inCubic(H.clamp((t - 49.6) / 1.2)));
      const ext = [path[path.length - 1], [420, 860], [snare[0] - rr * .6, snare[1] - rr - 50]];
      const loop = []; for (let i = 0; i <= 26; i++) { const an = -Math.PI * .3 + i / 26 * TAU * 1.08; loop.push([snare[0] + Math.cos(an) * rr, snare[1] + Math.sin(an) * rr]); }
      const tail = polyResample(ext.concat(loop), 18);
      path = path.concat(tail.slice(0, Math.ceil(tail.length * reach)));
    }
    const n = path.length;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
      const [x, y] = path[i]; const k = i / Math.max(1, n - 1);
      const w = (pass === 0 ? 1.9 : 1) * (H.lerp(30, 15, k) + 6 * H.noise1(i * .5 + t * 2, 3));
      const wob = 14 * Math.sin(t * 2.2 + i * .4) * k;
      c.fillStyle = pass === 0 ? "rgba(150,30,70,0.16)" : "rgba(4,2,8,0.88)";
      c.beginPath(); c.arc(x + wob, y, w, 0, TAU); c.fill();
    }
  }

  // rain in front of the wall
  c.setTransform(.5, 0, 0, .5, 0, 0);
  c.lineWidth = 2; c.strokeStyle = "rgba(180,200,230,0.26)"; c.beginPath();
  for (let i = 0; i < 150; i++) { const R = S.rain[i]; const y = ((t * R.sp + R.off) % 2200) - 140, x = R.x + y * .12; c.moveTo(x, y); c.lineTo(x + R.len * .12, y + R.len); }
  c.stroke();
  if (t > 50.6) { const k = H.clamp((t - 50.6) / 1); c.fillStyle = `rgba(30,0,10,${.25 * k})`; c.fillRect(0, 0, 1080, 1920); }
}

function heartPath(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * .95);
  c.bezierCurveTo(x - s * 1.7, y - s * .15, x - s * .85, y - s * 1.45, x, y - s * .5);
  c.bezierCurveTo(x + s * .85, y - s * 1.45, x + s * 1.7, y - s * .15, x, y + s * .95); c.closePath();
}
function sparkle(c, x, y, s) {
  c.fillStyle = "rgba(255,250,235,0.95)"; c.beginPath();
  c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill();
}
function polyResample(pts, step) {
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / step));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}

// ================================================================== caption
function drawCaption(ctx, t, H, S) {
  if (H.externalCaptions) return; // a caption template from the board draws the captions instead
  const beat = H.beatAt(t), ph = H.phase(beat, t, .4, .3);
  let L = S.caps[beat.i];
  if (!L) {
    const f = H.fitText(ctx, beat.text, s => SERIF(s), H.W - 2 * 140, 56, 44, 3);
    ctx.font = SERIF(f.size); const w = Math.max(...f.lines.map(l => ctx.measureText(l).width));
    L = S.caps[beat.i] = { ...f, w, lh: f.size * 1.16 };
  }
  const a = H.ease.outCubic(ph.inT) * (1 - (beat.i === H.beats.length - 1 ? 0 : ph.outT));
  if (a <= 0) return;
  const cy = H.H - 340 + (1 - H.ease.outCubic(ph.inT)) * 16;
  const hgt = L.lh * L.lines.length + 44, pw = Math.min(H.W - 180, L.w + 84);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(6,10,18,0.70)"; roundRect(ctx, H.W / 2 - pw / 2, cy - hgt / 2, pw, hgt, 26); ctx.fill();
  ctx.strokeStyle = "rgba(255,196,130,0.35)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = SERIF(L.size); ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  L.lines.forEach((ln, i) => ctx.fillText(ln, H.W / 2, cy + (i - (L.lines.length - 1) / 2) * L.lh));
  ctx.restore();
}

function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; }
function mixHex(a, b, k) { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const ch = s => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; }
function letterSpaced(ctx, s, x, y, sp) { for (const ch of s) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + sp; } }
