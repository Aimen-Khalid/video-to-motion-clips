/*
 * captions.js: Animora's caption-style system (library/caption-style + library/captions)
 * ported to plain Canvas 2D. Works in Node (@napi-rs/canvas) and in browsers.
 *
 *   CAPTIONS.load(templatesJson)                 // captions/templates.json (parsed)
 *   CAPTIONS.resolve(presetId, overrides)        // -> values (preset + overrides, clamped like parse.ts)
 *   CAPTIONS.groupWords(words, values, opts)     // [{text,s,e,key?}] -> [{start,end,words,lines}]
 *   CAPTIONS.draw(ctx, {W, H, t, groups, values, motion})
 *   CAPTIONS.fonts                               // font strings to preload (document.fonts.load)
 *
 * Sizes follow Animora: theme type sizes are for a 1080 px short edge, scaled by min(W,H)/1080;
 * em values are of the caption's font size. Layer "behind" is ignored (always drawn in front).
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- bundled fonts
  // [css family, slug in captions/fonts/<slug>-latin-<w>-<style>.woff2, faces "w" or "wi"]
  var FONT_TABLE = [
    ["Abril Fatface", "abril-fatface", "400"], ["Alfa Slab One", "alfa-slab-one", "400"], ["Anton", "anton", "400"],
    ["Archivo Black", "archivo-black", "400"], ["Bangers", "bangers", "400"], ["Barlow Condensed", "barlow-condensed", "500 600 700"],
    ["Bebas Neue", "bebas-neue", "400"], ["Caveat", "caveat", "500 700"], ["Dancing Script", "dancing-script", "700"],
    ["DM Serif Display", "dm-serif-display", "400 400i"], ["Fredoka", "fredoka", "500 600 700"], ["Gochi Hand", "gochi-hand", "400"],
    ["Great Vibes", "great-vibes", "400"], ["Inter", "inter", "400 500 600 700 800 900"], ["Josefin Sans", "josefin-sans", "400 600 700"],
    ["Kaushan Script", "kaushan-script", "400"], ["Lilita One", "lilita-one", "400"], ["Lobster", "lobster", "400"],
    ["Luckiest Guy", "luckiest-guy", "400"], ["Michroma", "michroma", "400"],
    ["Montserrat", "montserrat", "400 500 600 700 800 800i 900 900i"], ["Nunito", "nunito", "700 800"],
    ["Oswald", "oswald", "500 700"], ["Outfit", "outfit", "300 400 600 700 800"], ["Pacifico", "pacifico", "400"],
    ["Permanent Marker", "permanent-marker", "400"], ["Playfair Display", "playfair-display", "400 400i 700 700i 900 900i"],
    ["Poppins", "poppins", "600 700 700i 800 900"], ["Press Start 2P", "press-start-2p", "400"], ["Righteous", "righteous", "400"],
    ["Rye", "rye", "400"], ["Space Mono", "space-mono", "700"], ["Yellowtail", "yellowtail", "400"],
  ];
  var FACES = [];
  FONT_TABLE.forEach(function (f) {
    f[2].split(" ").forEach(function (code) {
      var italic = code.slice(-1) === "i";
      var weight = parseInt(code, 10);
      FACES.push({ family: f[0], weight: weight, style: italic ? "italic" : "normal", file: f[1] + "-latin-" + weight + "-" + (italic ? "italic" : "normal") + ".woff2" });
    });
  });
  var FONTS = FACES.map(function (f) { return (f.style === "italic" ? "italic " : "") + f.weight + ' 32px "' + f.family + '"'; });

  // ---------------------------------------------------------------- data
  var D = null;
  var BY_ID = {};
  var M = {}; // CAPTION_METRICS

  function load(json) {
    D = typeof json === "string" ? JSON.parse(json) : json;
    BY_ID = {};
    D.templates.forEach(function (t) { BY_ID[t.id] = t; });
    M = D.metrics;
    return api;
  }
  function need() { if (!D) throw new Error("CAPTIONS.load(templatesJson) first"); }

  // ---------------------------------------------------------------- colours
  var HEX6 = /^#[0-9a-fA-F]{6}$/;
  var HEX8 = /^#[0-9a-fA-F]{8}$/;
  function themeHex(ref) {
    if (typeof ref !== "string") return null;
    if (ref.indexOf("theme:") === 0) return D.themeColours[ref.slice(6)] || null;
    return HEX6.test(ref) || HEX8.test(ref) ? ref.toUpperCase() : null;
  }
  function rgba(hex, opacity) {
    if (hex == null) return "rgba(0,0,0,0)";
    var a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
    a *= opacity == null ? 1 : Math.max(0, Math.min(1, opacity));
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + Math.round(a * 1000) / 1000 + ")";
  }

  // ---------------------------------------------------------------- resolve (parse.ts)
  var ROW_RANGES = { words: [0, 6], weight: [100, 900], size: [0.3, 3], glow: [0, 0.8], textOutline: [0, 0.16], overlap: [0, 1.2], shift: [-3, 3], rotate: [-15, 15] };
  function clampTo(v, r, fb) { return typeof v === "number" && isFinite(v) ? Math.min(r[1], Math.max(r[0], v)) : fb; }
  function oneOf(list, v, fb) { return list.indexOf(v) >= 0 ? v : fb; }

  function parseRow(r) {
    if (!r || typeof r !== "object") return null;
    var colour = themeHex(r.colour);
    if (!colour) return null;
    return {
      words: Math.round(clampTo(r.words, ROW_RANGES.words, 0)),
      font: oneOf(D.choices.font, r.font, "subtitle"),
      weight: Math.round(clampTo(r.weight, ROW_RANGES.weight, 700) / 100) * 100,
      size: clampTo(r.size, ROW_RANGES.size, 1),
      letterCase: oneOf(D.choices.letterCase, r.letterCase, "as-written"),
      slant: oneOf(D.choices.slant, r.slant, "upright"),
      colour: colour,
      gradient: themeHex(r.gradient),
      glow: clampTo(r.glow, ROW_RANGES.glow, 0),
      textOutline: clampTo(r.textOutline, ROW_RANGES.textOutline, 0),
      box: themeHex(r.box),
      overlap: clampTo(r.overlap, ROW_RANGES.overlap, 0),
      shift: clampTo(r.shift, ROW_RANGES.shift, 0),
      rotate: clampTo(r.rotate, ROW_RANGES.rotate, 0),
    };
  }

  function clampValue(key, value) {
    var r = D.ranges[key];
    var c = Math.min(r.max, Math.max(r.min, value));
    return Number.isInteger(r.step) ? Math.round(c) : c;
  }

  function checked(key, value) {
    if (key === "rows") return Array.isArray(value) ? value.map(parseRow).filter(Boolean).slice(0, D.maxRows) : undefined;
    if (D.numberValues.indexOf(key) >= 0) return typeof value === "number" && isFinite(value) ? clampValue(key, value) : undefined;
    if (D.colourValues.indexOf(key) >= 0) return themeHex(value) || undefined;
    var list = D.choices[key];
    return list && list.indexOf(value) >= 0 ? value : undefined;
  }

  /** A preset's values with overrides applied (invalid overrides ignored, numbers clamped). */
  function resolve(presetId, overrides) {
    need();
    var t = BY_ID[presetId] || BY_ID.professional;
    var base = JSON.parse(JSON.stringify(t.values));
    var out = base;
    if (overrides && typeof overrides === "object") {
      Object.keys(overrides).forEach(function (k) {
        if (!(k in base)) return;
        var v = checked(k, overrides[k]);
        if (v !== undefined) out[k] = v;
      });
    }
    out.preset = t.id;
    return out;
  }

  // ---------------------------------------------------------------- type (layout.ts)
  function familyOf(font) {
    if (D.fontFamilies[font]) return D.fontFamilies[font];
    return font === "headline" ? D.theme.headline.family : D.theme.subtitle.family;
  }
  function typeOf(font) { return font === "headline" ? D.theme.headline : D.theme.subtitle; }
  function frameScale(W, H) { return Math.min(W, H) / D.theme.tokenBaseEdge; }
  function captionSizePx(v, scale) { return typeOf(v.font).fontSize * v.size * scale; }
  function captionLH(v) { return typeOf(v.font).lineHeight * v.lineSpacing; }
  function textScale(v) { return (typeOf(v.font).fontSize * v.size) / D.theme.subtitle.fontSize; }

  // ---------------------------------------------------------------- key words (key-words.ts)
  var SMALL_TALK = {};
  "a an and are as at be been but by can could did do does for from had has have he her here him his how i if in into is it its just me my no not now of on or our out she so than that the their them then there these they this those to too up us very was we were what when where which who why will with would you your"
    .split(" ").forEach(function (w) { SMALL_TALK[w] = 1; });
  function bare(text) {
    try { return text.toLowerCase().replace(new RegExp("[^\\p{L}\\p{N}']", "gu"), ""); }
    catch (e) { return text.toLowerCase().replace(/[^a-z0-9'À-￿]/g, ""); }
  }
  function keyWordIndex(words) {
    var best = -1;
    words.forEach(function (w, i) {
      var word = bare(w.text);
      if (word.length < M.keyWordMinLength || SMALL_TALK[word]) return;
      if (best < 0 || word.length >= bare(words[best].text).length) best = i;
    });
    return best;
  }

  // ---------------------------------------------------------------- grouping (chunking.ts, word-groups.ts)
  var ENDS_PHRASE = /[.!?;:]$/;
  var ENDS_CLAUSE = /[,]$/;

  function wrapWords(words, maxChars) {
    var lines = [], cur = [], len = 0;
    words.forEach(function (w) {
      var next = cur.length ? len + 1 + w.text.length : w.text.length;
      if (cur.length && next > maxChars) { lines.push(cur); cur = [w]; len = w.text.length; }
      else { cur.push(w); len = next; }
    });
    if (cur.length) lines.push(cur);
    return lines;
  }

  function chunkWords(words, maxChars) {
    var C = D.chunking, groups = [], group = [];
    words.forEach(function (w) {
      var prev = group[group.length - 1];
      if (prev && w.start - prev.end >= C.PAUSE_SECONDS) { groups.push(group); group = []; }
      var cand = group.concat([w]);
      if (group.length && wrapWords(cand, maxChars).length > C.MAX_LINES) {
        var cut = -1;
        for (var i = group.length - 1; i >= 0; i--) if (ENDS_CLAUSE.test(group[i].text) || ENDS_PHRASE.test(group[i].text)) { cut = i; break; }
        var keep = cut + 1 >= C.MIN_WORDS_BEFORE_CLAUSE_BREAK ? group.slice(0, cut + 1) : group;
        groups.push(keep);
        group = group.slice(keep.length).concat([w]);
      } else group = cand;
      if (ENDS_PHRASE.test(w.text) && group.length >= 3) { groups.push(group); group = []; }
    });
    if (group.length) groups.push(group);
    return groups;
  }

  function readableEnd(groups, i) {
    var g = groups[i];
    var next = groups[i + 1] ? groups[i + 1][0].start : Infinity;
    return Math.min(Math.max(g[g.length - 1].end, g[0].start + D.chunking.MIN_SECONDS), next);
  }

  function fewWords(words, max) {
    var groups = [];
    words.forEach(function (w) {
      var last = groups[groups.length - 1];
      var prev = last && last[last.length - 1];
      if (last && prev && last.length < max && w.start - prev.end < D.chunking.BREAK_SECONDS) last.push(w);
      else groups.push([w]);
    });
    return groups;
  }

  function lineChars(scale) { return Math.max(D.chunking.MIN_LINE_CHARS, Math.round(D.chunking.MAX_LINE_CHARS / Math.max(1, scale))); }

  function applyCase(text, letterCase) {
    if (letterCase === "upper") return text.toUpperCase();
    if (letterCase === "lower") return text.toLowerCase();
    if (letterCase === "title") return text.replace(/(^|[\s\-“"‘'(…])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
    return text;
  }

  /**
   * Words [{text,s,e,key?|stress?}] -> caption groups [{start,end,words:[{text,s,e,key?,cased}],lines:[[word]]}].
   * "lines": phrase-broken captions of up to two lines that fit (chars per line shrink with bigger type);
   * "words": up to maxWords per group, broken at pauses (stacked templates' maxWords is their rows' word count).
   * With autoStress "key-word", each group's key word gets key:true unless a word is already marked.
   * Letter case is applied when drawing (rows and stressed words have their own case); `cased` shows the caption's case.
   */
  function groupWords(words, values) {
    need();
    var v = values;
    var tw = words.filter(function (w) { return w && String(w.text).trim(); }).map(function (w) {
      return { text: String(w.text), start: w.s, end: w.e, mark: Boolean(w.key || w.stress) };
    }).sort(function (a, b) { return a.start - b.start; });
    var raw;
    if (v.grouping === "lines") {
      var chars = lineChars(textScale(v));
      var gs = chunkWords(tw, chars);
      raw = gs.map(function (g, i) { return { lines: wrapWords(g, chars), start: g[0].start, end: readableEnd(gs, i) }; });
    } else {
      var fs = fewWords(tw, v.maxWords);
      raw = fs.map(function (g, i) {
        var next = fs[i + 1] ? fs[i + 1][0].start : Infinity;
        return { lines: [g], start: g[0].start, end: Math.min(next, g[g.length - 1].end + D.chunking.BREAK_SECONDS) };
      });
    }
    return raw.map(function (g) {
      var flat = [];
      var lines = g.lines.map(function (line) {
        return line.map(function (w) {
          var o = { text: w.text, s: w.start, e: w.end, cased: applyCase(w.text, v.letterCase) };
          if (w.mark) o.key = true;
          flat.push(o);
          return o;
        });
      });
      if (v.autoStress === "key-word" && !flat.some(function (w) { return w.key; })) {
        var k = keyWordIndex(flat);
        if (k >= 0) flat[k].key = true;
      }
      return { start: g.start, end: g.end, words: flat, lines: lines };
    });
  }

  /** splitIntoRows (rows.ts) */
  function splitIntoRows(words, rows) {
    var fixed = rows.reduce(function (s, r) { return s + r.words; }, 0);
    var rest = Math.max(0, words.length - fixed);
    var at = 0;
    return rows.map(function (row, i) {
      var count = i === rows.length - 1 ? words.length - at : row.words || rest;
      var taken = words.slice(at, at + count);
      at += taken.length;
      return { row: row, words: taken };
    }).filter(function (r) { return r.words.length > 0; });
  }

  // ---------------------------------------------------------------- motion (caption-motion.ts)
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(s) { return function (t) { var u = 1 - t; return 1 - u * u * ((s + 1) * u - s); }; }
  function captionProgress(seconds, style, kind) {
    var m = D.motion[style] || D.motion.smooth;
    var len = kind === "pop" ? m.popSeconds : m.seconds;
    var held = m.stepSeconds > 0 ? Math.floor(seconds / m.stepSeconds + 1e-9) * m.stepSeconds : seconds;
    var t = Math.min(1, Math.max(0, held / len));
    var shown = easeOutCubic(t);
    return { shown: shown, moved: m.overshoot > 0 ? easeOutBack(m.overshoot)(t) : shown };
  }

  // Remotion's random(seed: string): mulberry32 of a Java-style string hash.
  function remotionRandom(seed) {
    var hash = 0;
    for (var i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
    var t = hash + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ================================================================ rendering
  var ITALIC_FACES = {};
  FACES.forEach(function (f) { if (f.style === "italic") (ITALIC_FACES[f.family] = ITALIC_FACES[f.family] || []).push(f.weight); });
  var SKEW = -0.22; // synthetic oblique when a family has no italic face (browsers' fake italic is about this)

  // Words in another script (Urdu, Arabic...) fall back to a face that has their letters. The
  // renderer and the board both load these families; add more for other scripts.
  var SCRIPT_FALLBACK = ', "Noto Nastaliq Urdu"';
  // Right-to-left letters (Hebrew, Arabic, Urdu, Persian...).
  var RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  var LTR_RE = /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0900-\u097F]/;
  /** Words of one line in the order they appear on screen: runs of right-to-left words read right
   *  to left, and a line that starts in a right-to-left script lays its runs out right to left. */
  function visualOrder(items) {
    var dir = function (L) { var t = L.text || ""; return RTL_RE.test(t) ? "r" : LTR_RE.test(t) ? "l" : ""; };
    var runs = [], base = "";
    items.forEach(function (L) {
      var d = dir(L); if (!base && d) base = d;
      var last = runs[runs.length - 1];
      if (last && (!d || d === last.d)) last.items.push(L); else runs.push({ d: d, items: [L] });
    });
    if (!base || (base === "l" && runs.every(function (r) { return r.d !== "r"; }))) return items;
    runs.forEach(function (r) { if (r.d === "r") r.items.reverse(); });
    if (base === "r") runs.reverse();
    return runs.reduce(function (a, r) { return a.concat(r.items); }, []);
  }
  // before the generic family (sans-serif, serif...), which would otherwise always match first
  function withScriptFallback(family) {
    if (family.indexOf(SCRIPT_FALLBACK.slice(2)) >= 0) return family;
    var m = /,\s*(sans-serif|serif|cursive|monospace|fantasy|system-ui)\s*$/.exec(family);
    return m ? family.slice(0, m.index) + SCRIPT_FALLBACK + family.slice(m.index) : family + SCRIPT_FALLBACK;
  }
  function primaryFamily(css) { var m = /^\s*['"]?([^'",]+)['"]?/.exec(css); return m ? m[1].trim() : css; }
  /** Font request for a face: italic only when the family ships an italic, else drawn skewed. */
  function fontSpec(family, weight, italic, px) {
    var fam = primaryFamily(family);
    var realItalic = italic && ITALIC_FACES[fam] && ITALIC_FACES[fam].length > 0;
    return { font: (realItalic ? "italic " : "") + weight + " " + Math.max(1, Math.round(px * 100) / 100) + "px " + withScriptFallback(family), skew: italic && !realItalic };
  }

  var measureCache = {};
  var measureCount = 0;
  function measure(ctx, font, text, tracking) {
    var key = font + "|" + tracking + "|" + text;
    var m = measureCache[key];
    if (m) return m;
    if (++measureCount > 20000) { measureCache = {}; measureCount = 0; }
    ctx.font = font;
    setTracking(ctx, tracking);
    var mt = ctx.measureText(text);
    var px = parseFloat(/([\d.]+)px/.exec(font)[1]);
    m = {
      w: mt.width,
      A: mt.fontBoundingBoxAscent != null && isFinite(mt.fontBoundingBoxAscent) ? mt.fontBoundingBoxAscent : px * 0.9,
      D: mt.fontBoundingBoxDescent != null && isFinite(mt.fontBoundingBoxDescent) ? mt.fontBoundingBoxDescent : px * 0.25,
    };
    if (typeof document === "undefined" || !document.fonts || document.fonts.status === "loaded") measureCache[key] = m;
    return m;
  }
  function setTracking(ctx, px) { if ("letterSpacing" in ctx) ctx.letterSpacing = (Math.round(px * 100) / 100) + "px"; }

  /** CSS inline box around the baseline: half-leading split above and below the content area. */
  function inlineExtent(A, D, lineH) { var half = (lineH - A - D) / 2; return { above: A + half, below: D + half }; }

  function stateAt(w, t) { return t < w.s ? "coming" : t < w.e ? "now" : "said"; }

  function glowList(colour, reach, em) {
    return M.glowLayers.map(function (share) { return { dx: 0, dy: 0, blur: reach * share * em, colour: colour }; });
  }
  function captionShadows(v, em) {
    var out = [];
    if (v.shadow > 0 || v.shadowOffset > 0) out.push({ dx: v.shadowOffset * em, dy: v.shadowOffset * em, blur: v.shadow * em, colour: v.shadowColour });
    if (v.echo > 0) { var d = (v.shadowOffset + v.echo) * em; out.push({ dx: d, dy: d, blur: 0, colour: v.echoColour }); }
    if (v.glow > 0) out = out.concat(glowList(v.glowColour, v.glow, em));
    return out;
  }

  /**
   * One word's resolved look, following CaptionBody/wordStyle: the container (caption or row) look,
   * then the word's fill (unless stressed), the stressed look, the popped size, chips, the emphasis
   * colour and shape, and the reveal.
   */
  function wordLook(ctx, w, index, ctn, v, t, motion, fs) {
    var state = stateAt(w, t);
    var stress = Boolean(w.key);
    var L = {
      word: w, state: state, stress: stress,
      family: ctn.family, weight: ctn.weight, italic: ctn.italic, letterCase: ctn.letterCase,
      fill: ctn.fill, stroke: ctn.stroke, shadows: ctn.shadows, opacity: 1, lineH: ctn.lh, own: false,
    };
    var sizeEm = stress ? v.stressScale : 1;
    if (!stress) {
      if (v.textFill === "gradient" || v.textFill === "split") L.fill = { kind: "gradient", from: v.textColour, to: v.gradientColour, dir: v.gradientDirection, split: v.textFill === "split", scope: "word" };
      else if (v.textFill === "hollow") { L.fill = { kind: "none" }; L.stroke = { width: M.strokePerOutline * v.textOutline * fs, colour: v.outlineColour }; L.shadows = []; }
    } else {
      if (v.stressFont !== "same") L.family = familyOf(v.stressFont);
      L.weight = v.stressWeight;
      L.italic = v.stressSlant === "italic";
      if (v.stressCase !== "as-written") L.letterCase = v.stressCase;
      L.fill = { kind: "solid", colour: v.stressColour };
      if (v.stressGlow > 0) L.shadows = "glow";
      if (v.stressLine === "own") { L.own = true; L.lineH = M.ownLineHeight; }
      if (v.stressMark === "box") { L.hl = { colour: v.stressColour, radius: M.boxRadius }; L.fill = { kind: "solid", colour: v.emphasisTextColour }; }
      else if (v.stressMark === "ring") { L.ring = v.stressColour; L.fill = { kind: "solid", colour: v.textColour }; }
      else if (v.stressMark === "underline") L.underline = v.stressColour;
    }
    if (v.emphasis === "pop" && state === "now") sizeEm *= 1 + M.popScale * captionProgress(t - w.s, motion, "pop").moved;
    L.size = ctn.size * sizeEm;
    if (L.shadows === "glow") L.shadows = glowList(v.stressColour, v.stressGlow, L.size);
    if (v.backdrop === "words" || v.backdrop === "torn") {
      L.chip = { colour: rgba(v.backgroundColour, v.backgroundOpacity), padB: v.boxPadding * M.boxPaddingBlockShare * L.size, padI: v.boxPadding * L.size, radius: v.radius * L.size, margin: M.chipGap * L.size, torn: v.backdrop === "torn" };
      if (L.chip.torn) L.shadows = [];
    }
    // emphasis colour (emphasisColour in word-styles.ts)
    var ec = null;
    if (v.emphasis === "karaoke") ec = state === "coming" ? null : v.emphasisColour;
    else if (state === "now") {
      if (v.emphasis === "pill" || v.emphasis === "box") ec = v.emphasisTextColour;
      else if (v.emphasis === "colour" || v.emphasis === "pop" || v.emphasis === "italic") ec = v.emphasisColour;
    }
    if (ec) L.fill = { kind: "solid", colour: ec };
    if (state === "now") {
      if (v.emphasis === "pill") L.hl = { colour: v.emphasisColour, radius: M.pillRadius };
      else if (v.emphasis === "box") L.hl = { colour: v.emphasisColour, radius: M.boxRadius };
      else if (v.emphasis === "hollow") { L.fill = { kind: "none" }; L.stroke = { width: (M.frameWidth / 2) * L.size, colour: v.emphasisColour }; L.shadows = []; }
      else if (v.emphasis === "italic") L.italic = true;
    }
    if (state === "coming" && v.reveal !== "all") L.opacity = v.reveal === "build" ? 0 : M.dimOpacity;
    if (ctn.noShadow) L.shadows = [];

    L.text = applyCase(w.text, L.letterCase);
    if (RTL_RE.test(L.text)) L.text = "\u200F" + L.text + "\u200F";   // punctuation stays on the reading side
    var spec = fontSpec(L.family, L.weight, L.italic, L.size);
    L.font = spec.font; L.skew = spec.skew;

    if (v.backdrop === "ransom") return ransomLook(ctx, L, w, index, v, ctn);

    var m = measure(ctx, L.font, L.text, ctn.tracking);
    L.textW = m.w; L.A = m.A; L.D = m.D;
    var ext = inlineExtent(m.A, m.D, L.lineH * L.size);
    L.above = ext.above; L.below = ext.below;
    L.lead = 0; // space before the text inside the item's advance
    if (L.ring) { var rp = (M.ringReach + M.ringWidth) * L.size; L.lead = rp; L.adv = m.w + 2 * rp; }
    else L.adv = m.w;
    if (L.chip) {
      L.lead += L.chip.margin + L.chip.padI;
      L.adv += 2 * (L.chip.margin + L.chip.padI);
      L.above += L.chip.padB; L.below += L.chip.padB; // inline-block: padding takes line height
    }
    return L;
  }

  /** Cut-out letters (backdrops/RansomWord.tsx): each letter its own scrap, font, ink, tilt and size. */
  function ransomLook(ctx, L, w, index, v, ctn) {
    var seed = w.text + "-" + index;
    var papers = D.ransomColours.papers, inks = D.ransomColours.inks;
    var letters = Array.from ? Array.from(w.text) : w.text.split("");
    var x = 0, above = 0, below = 0;
    L.letters = letters.map(function (ch, i) {
      var pick = function (salt) { return remotionRandom(seed + "-" + i + "-" + salt); };
      var c = Math.floor(pick("paper") * papers.length);
      var tilt = (pick("tilt") * 2 - 1) * M.ransomTilt;
      var fam = familyOf(D.ransomFonts[Math.floor(pick("font") * D.ransomFonts.length)]);
      var size = L.size * (0.85 + pick("size") * 0.35);
      var lc = L.letterCase === "title" ? "upper" : L.letterCase;
      var text = applyCase(ch, lc);
      var spec = fontSpec(fam, L.weight, L.italic, size);
      var m = measure(ctx, spec.font, text, ctn.tracking);
      var padB = M.ransomPadding * size, padI = M.ransomPadding * 1.5 * size, mar = (M.ransomPadding / 2) * size;
      var ext = inlineExtent(m.A, m.D, L.lineH * size);
      var o = { text: text, font: spec.font, skew: spec.skew, paper: papers[c], ink: inks[c], tilt: tilt, size: size, x: x + mar, w: m.w + 2 * padI, padI: padI, padB: padB, A: m.A, D: m.D, above: ext.above + padB, below: ext.below + padB };
      above = Math.max(above, o.above); below = Math.max(below, o.below);
      x += m.w + 2 * padI + 2 * mar;
      return o;
    });
    L.adv = x; L.lead = 0; L.above = above; L.below = below; L.textW = x; L.A = L.size * 0.9; L.D = L.size * 0.25;
    return L;
  }

  /** The container look (caption, row or notification text) words inherit from. */
  function captionContainer(v, fs, scale) {
    var em = fs;
    return {
      family: familyOf(v.font), weight: v.weight, italic: v.slant === "italic", letterCase: v.letterCase, size: fs,
      lh: captionLH(v), tracking: v.tracking * em,
      fill: { kind: "solid", colour: v.backdrop === "notification" ? D.cardColours.text : v.textColour },
      stroke: v.textOutline > 0 && v.textFill !== "hollow" ? { width: M.strokePerOutline * v.textOutline * em, colour: v.outlineColour } : null,
      shadows: v.backdrop === "notification" || v.backdrop === "ransom" ? [] : captionShadows(v, em),
      noShadow: v.backdrop === "ransom" || v.backdrop === "notification",
    };
  }
  function rowContainer(row, base, v, fs) {
    var size = fs * row.size;
    var c = {
      family: familyOf(row.font), weight: row.weight, italic: row.slant === "italic", letterCase: row.letterCase, size: size,
      lh: base.lh, tracking: base.tracking,
      fill: row.gradient ? { kind: "gradient", from: row.colour, to: row.gradient, dir: v.gradientDirection, split: false, scope: "row" } : { kind: "solid", colour: row.colour },
      stroke: row.textOutline > 0 ? { width: M.strokePerOutline * row.textOutline * size, colour: v.outlineColour } : base.stroke,
      shadows: row.glow > 0 ? glowList(row.colour, row.glow, size) : row.gradient ? [] : base.shadows,
      noShadow: base.noShadow, row: row,
    };
    if (row.box) c.box = { colour: row.box, radius: v.radius * size, padB: M.rowPaddingBlock * size, padI: M.rowPaddingInline * size };
    return c;
  }

  /** Words of one container laid into lines no wider than maxW (own-line stressed words alone). */
  function packLines(ctx, looks, logicalBreaks, ctn, maxW) {
    var spaceW = measure(ctx, fontSpec(ctn.family, ctn.weight, ctn.italic, ctn.size).font, " ", ctn.tracking).w;
    var padI = ctn.box ? ctn.box.padI : ctn.linePadI || 0;
    var lines = [], cur = null, wrapped = false;
    function flush() { if (cur && cur.items.length) lines.push(cur); cur = null; }
    looks.forEach(function (L, i) {
      if (L.own || (i > 0 && looks[i - 1].own) || logicalBreaks[i]) flush();
      if (!cur) cur = { items: [], w: 2 * padI, own: L.own };
      var add = cur.items.length ? spaceW + L.adv : L.adv;
      if (cur.items.length && cur.w + add > maxW) { flush(); cur = { items: [], w: 2 * padI }; add = L.adv; wrapped = true; }
      cur.items.push(L);
      cur.w += add;
    });
    flush();
    var strut = measure(ctx, fontSpec(ctn.family, ctn.weight, ctn.italic, ctn.size).font, "Hg", 0);
    lines.forEach(function (ln) {
      var sLH = (ln.own ? ln.items[0].lineH * ln.items[0].size : ctn.lh * ctn.size);
      var sA = ln.own ? ln.items[0].A : strut.A, sD = ln.own ? ln.items[0].D : strut.D;
      var s = inlineExtent(sA, sD, sLH);
      ln.above = s.above; ln.below = s.below;
      ln.items.forEach(function (L) { ln.above = Math.max(ln.above, L.above); ln.below = Math.max(ln.below, L.below); });
      ln.h = ln.above + ln.below;
      ln.spaceW = spaceW; ln.padI = padI; ln.ctn = ctn;
      ln.strutA = strut.A; ln.strutD = strut.D;
    });
    lines.wrapped = wrapped;
    return lines;
  }

  /**
   * Lays out the caption visible at t: returns null when none shows, else
   * {div:{x,y,w,h}, blocks:[{lines, y, h, row, ctn}], v, fs, since, ...} in frame pixels (before the entrance transform).
   */
  function layoutCaption(ctx, o) {
    need();
    var v = o.values, t = o.t, W = o.W, H = o.H, motion = o.motion || "smooth";
    var g = o.group || groupAt(o.groups, t);
    if (!g) return null;
    var scale = frameScale(W, H);
    var fs = captionSizePx(v, scale);
    var portrait = H > W;
    var side = Math.round(W * D.theme.safeSide);
    var end = Math.round(H * (portrait ? D.theme.safeEndPortrait : D.theme.safeEndLandscape));
    var availW = W - 2 * side;
    var whole = v.backdrop === "box" || v.backdrop === "bubble-left" || v.backdrop === "bubble-right" || v.backdrop === "frame";
    var padB = whole ? v.boxPadding * M.boxPaddingBlockShare * fs : 0;
    var padI = whole ? v.boxPadding * fs : 0;
    var border = v.backdrop === "frame" ? M.frameWidth * fs : 0;
    var notif = v.backdrop === "notification";
    var cardW = 0, cardPad = 0, iconS = 0, gap = 0;
    var maxW = availW - 2 * padI - 2 * border;
    if (notif) {
      cardW = Math.min(M.cardWidth * fs, availW); cardPad = M.cardPadding * fs; iconS = M.cardIcon * fs; gap = M.cardGap * fs;
      maxW = cardW - 2 * cardPad - iconS - gap;
    }
    var base = captionContainer(v, fs, scale);
    if (v.backdrop === "lines") base.linePadI = v.boxPadding * fs;
    var words = g.words || [].concat.apply([], g.lines);
    var blocks = [];
    if (v.rows && v.rows.length) {
      splitIntoRows(words, v.rows).forEach(function (r) {
        var ctn = rowContainer(r.row, base, v, fs);
        var looks = r.words.map(function (w) { return wordLook(ctx, w, words.indexOf(w), ctn, v, t, motion, fs); });
        blocks.push({ ctn: ctn, row: r.row, lines: packLines(ctx, looks, {}, ctn, maxW) });
      });
    } else {
      var lines = g.lines || [words];
      var looks = [], breaks = {};
      lines.forEach(function (line) {
        line.forEach(function (w, k) {
          if (k === 0 && looks.length) breaks[looks.length] = true;
          looks.push(wordLook(ctx, w, words.indexOf(w), base, v, t, motion, fs));
        });
      });
      blocks.push({ ctn: base, row: null, lines: packLines(ctx, looks, breaks, base, maxW) });
    }
    // block heights, rows overlapping
    var contentW = 0, y = 0, anyWrapped = false;
    blocks.forEach(function (b, i) {
      b.w = 0; b.h = 0;
      b.lines.forEach(function (ln) { ln.y = b.h; b.h += ln.h; b.w = Math.max(b.w, ln.w); });
      if (b.row && i > 0) y -= b.row.overlap * b.ctn.size;
      b.y = y; y += b.h;
      contentW = Math.max(contentW, b.w);
      if (b.lines.wrapped) anyWrapped = true;
    });
    // CSS: a shrink-to-fit box whose text wraps takes the whole available width.
    if (anyWrapped) contentW = maxW;
    var contentH = y;
    contentW = Math.min(contentW, maxW);
    var div;
    if (notif) {
      var titleSize = M.cardTitleScale * fs;
      var tm = measure(ctx, fontSpec(base.family, M.cardTitleWeight, false, titleSize).font, "Hg", 0);
      var titleH = base.lh * titleSize;
      var colH = titleH + contentH;
      var cardH = 2 * cardPad + Math.max(iconS, colH);
      div = { w: cardW, h: cardH };
      div.card = { pad: cardPad, icon: iconS, gap: gap, titleSize: titleSize, titleH: titleH, titleA: tm.A, titleD: tm.D };
      div.contentX = cardPad + iconS + gap; div.contentY = cardPad + titleH; div.contentW = maxW; div.align = "left";
    } else {
      div = { w: contentW + 2 * padI + 2 * border, h: contentH + 2 * padB + 2 * border };
      div.contentX = padI + border; div.contentY = padB + border; div.contentW = contentW; div.align = v.align;
    }
    div.x = v.align === "left" ? side : side + (availW - div.w) / 2;
    if (v.position === "top") div.y = end;
    else if (v.position === "middle") div.y = (H - div.h) / 2;
    else div.y = H - end - (v.position === "raised" ? H * M.raisedLift : 0) - div.h;
    div.x += v.nudgeX * W; div.y += v.nudgeY * H;
    // x of every line and item (relative to the div)
    blocks.forEach(function (b) {
      b.lines.forEach(function (ln) {
        var lx = div.contentX + (div.align === "left" ? 0 : (div.contentW - ln.w) / 2);
        ln.x = lx;
        var x = lx + ln.padI;
        ln.items = visualOrder(ln.items);
        ln.items.forEach(function (L, k) {
          if (k) x += ln.spaceW;
          L.x = x; L.tx = x + L.lead; L.baseline = div.contentY + b.y + ln.y + ln.above;
          x += L.adv;
        });
      });
    });
    var first = words[0];
    return { group: g, v: v, fs: fs, scale: scale, div: div, blocks: blocks, padB: padB, padI: padI, border: border, base: base, since: t - (first ? first.s : t), motion: motion, W: W, H: H };
  }

  function groupAt(groups, t) {
    if (!groups) return null;
    for (var i = 0; i < groups.length; i++) if (t >= groups[i].start && t < groups[i].end) return groups[i];
    return null;
  }

  // ---------------------------------------------------------------- painting helpers
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function devScale(ctx) { var m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
  function clearShadow(ctx) { ctx.shadowColor = "rgba(0,0,0,0)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

  var FAR = 20000;
  /** Draws only the shadow of `paint(dx)` (shape drawn at local x offset dx), with a local-space offset and blur. */
  function shadowOnly(ctx, s, paint) {
    var m = ctx.getTransform();
    var k = devScale(ctx);
    ctx.shadowColor = rgba(s.colour, 1);
    ctx.shadowBlur = s.blur * k;
    ctx.shadowOffsetX = m.a * s.dx + m.c * s.dy - m.a * FAR;
    ctx.shadowOffsetY = m.b * s.dx + m.d * s.dy - m.b * FAR;
    paint(FAR);
    clearShadow(ctx);
  }

  function glyphs(ctx, L, text, x, y, mode, font, skew) {
    ctx.font = font || L.font;
    if (skew === undefined ? L.skew : skew) {
      ctx.save(); ctx.translate(x, y); ctx.transform(1, 0, SKEW, 1, 0, 0);
      if (mode === "stroke") ctx.strokeText(text, 0, 0); else ctx.fillText(text, 0, 0);
      ctx.restore();
    } else if (mode === "stroke") ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
  }

  function fillStyleFor(ctx, L, fill, rowBounds) {
    if (fill.kind === "solid") return rgba(fill.colour, 1);
    var b = fill.scope === "row" && rowBounds ? rowBounds : { x0: L.tx, x1: L.tx + L.textW, y0: L.baseline - L.A, y1: L.baseline + L.D };
    var gr = fill.dir === "across" ? ctx.createLinearGradient(b.x0, 0, b.x1, 0) : ctx.createLinearGradient(0, b.y0, 0, b.y1);
    var a = rgba(fill.from, 1), z = rgba(fill.to, 1);
    if (fill.split) { var st = M.splitStop / 100; gr.addColorStop(0, a); gr.addColorStop(st, a); gr.addColorStop(Math.min(1, st + 0.0001), z); gr.addColorStop(1, z); }
    else { gr.addColorStop(0, a); gr.addColorStop(1, z); }
    return gr;
  }

  function tornPath(ctx, x, y, w, h) {
    var P = [0, 8, 6, 0, 13, 7, 20, 1, 27, 8, 35, 2, 42, 9, 50, 1, 57, 8, 64, 0, 72, 7, 79, 1, 86, 8, 93, 0, 100, 7, 100, 93, 94, 100, 87, 92, 80, 99, 72, 93, 65, 100, 58, 92, 50, 99, 43, 92, 36, 100, 28, 93, 21, 99, 14, 92, 7, 100, 0, 92];
    ctx.beginPath();
    for (var i = 0; i < P.length; i += 2) { var px = x + (w * P[i]) / 100, py = y + (h * P[i + 1]) / 100; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath();
  }

  // ---------------------------------------------------------------- painting
  function paintBackdrop(ctx, lay) {
    var v = lay.v, d = lay.div, fs = lay.fs;
    if (v.backdrop === "box" || v.backdrop === "bubble-left" || v.backdrop === "bubble-right") {
      ctx.fillStyle = rgba(v.backgroundColour, v.backgroundOpacity);
      rr(ctx, 0, 0, d.w, d.h, v.radius * fs); ctx.fill();
      if (v.backdrop !== "box") { // BubbleTail: a square turned on its corner at the bottom left or right
        var s = M.bubbleTail * fs;
        var cx = v.backdrop === "bubble-left" ? s / 2 + s / 2 : d.w - s / 2 - s / 2;
        var cy = d.h + s / 3 - s / 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
      }
    } else if (v.backdrop === "frame") {
      var bw = M.frameWidth * fs;
      ctx.strokeStyle = rgba(v.backgroundColour, 1); ctx.lineWidth = bw;
      rr(ctx, bw / 2, bw / 2, d.w - bw, d.h - bw, Math.max(0, v.radius * fs - bw / 2)); ctx.stroke();
    } else if (v.backdrop === "notification") paintCard(ctx, lay);
  }

  function paintCard(ctx, lay) {
    var d = lay.div, c = d.card, C = D.cardColours, fs = lay.fs;
    ctx.fillStyle = C.card; rr(ctx, 0, 0, d.w, d.h, M.cardRadius * fs); ctx.fill();
    var ix = c.pad, iy = c.pad;
    var gr = ctx.createLinearGradient(0, iy, 0, iy + c.icon);
    gr.addColorStop(0, C.iconFrom); gr.addColorStop(1, C.iconTo);
    ctx.fillStyle = gr; rr(ctx, ix, iy, c.icon, c.icon, (M.cardRadius / 2) * fs); ctx.fill();
    var gs = c.icon * 0.55, gx = ix + (c.icon - gs) / 2, gy = iy + (c.icon - gs) / 2, u = gs / 24;
    ctx.fillStyle = C.glyph; ctx.beginPath();
    ctx.moveTo(gx + 4 * u, gy + 5 * u); ctx.lineTo(gx + 20 * u, gy + 5 * u); ctx.lineTo(gx + 20 * u, gy + 16 * u);
    ctx.lineTo(gx + 9 * u, gy + 16 * u); ctx.lineTo(gx + 4 * u, gy + 20 * u); ctx.closePath(); ctx.fill();
    var base = lay.base, tx = d.contentX, half = (c.titleH - c.titleA - c.titleD) / 2, by = c.pad + half + c.titleA;
    setTracking(ctx, base.tracking);
    ctx.textAlign = "left";
    ctx.fillStyle = C.title; ctx.font = fontSpec(base.family, M.cardTitleWeight, false, c.titleSize).font;
    ctx.fillText(D.cardText.title, tx, by);
    ctx.font = fontSpec(base.family, M.cardTimeWeight, false, c.titleSize).font; ctx.fillStyle = C.time;
    var tw = ctx.measureText(D.cardText.time).width;
    ctx.fillText(D.cardText.time, d.w - c.pad - tw, by);
  }

  function rowBounds(b, lay) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    b.lines.forEach(function (ln) {
      ln.items.forEach(function (L) { x0 = Math.min(x0, L.tx); x1 = Math.max(x1, L.tx + L.textW); y0 = Math.min(y0, L.baseline - ln.strutA); y1 = Math.max(y1, L.baseline + ln.strutD); });
    });
    return { x0: x0, x1: x1, y0: y0, y1: y1 };
  }

  function paintBlock(ctx, b, lay) {
    var v = lay.v, ctn = b.ctn, bounds = b.row && ctn.fill.kind === "gradient" ? rowBounds(b, lay) : null;
    b.lines.forEach(function (ln) {
      var first = ln.items[0], lastI = ln.items[ln.items.length - 1];
      var base = first.baseline;
      // row box / line band: inline background over the container's content area, cloned per line
      var band = ctn.box || (v.backdrop === "lines" && !b.row ? { colour: rgba(v.backgroundColour, v.backgroundOpacity), radius: v.radius * lay.fs, padB: v.boxPadding * M.boxPaddingBlockShare * lay.fs, padI: v.boxPadding * lay.fs } : null);
      if (band) {
        ctx.fillStyle = band.colour.charAt(0) === "#" ? rgba(band.colour, 1) : band.colour;
        var x0 = first.x - band.padI, x1 = lastI.x + lastI.adv + band.padI;
        rr(ctx, x0, base - ln.strutA - band.padB, x1 - x0, ln.strutA + ln.strutD + 2 * band.padB, band.radius); ctx.fill();
      }
      ln.items.forEach(function (L) { ctx.globalAlpha = lay.alpha * L.opacity; paintItemBack(ctx, L, ln); });
      ln.items.forEach(function (L) { if (L.shadows && L.shadows.length && !L.letters) { ctx.globalAlpha = lay.alpha * L.opacity; paintShadows(ctx, L, lay, ln); } });
      ln.items.forEach(function (L) { ctx.globalAlpha = lay.alpha * L.opacity; paintText(ctx, L, lay, bounds); });
    });
    ctx.globalAlpha = lay.alpha;
  }

  function paintItemBack(ctx, L, ln) {
    if (L.opacity <= 0) return;
    if (L.letters) return;
    if (L.chip) {
      var c = L.chip, x = L.x + c.margin, w = L.adv - 2 * c.margin;
      var h = L.lineH * L.size + 2 * c.padB, top = L.baseline - (inlineExtent(L.A, L.D, L.lineH * L.size).above + c.padB);
      ctx.fillStyle = c.colour;
      if (c.torn) tornPath(ctx, x, top, w, h); else rr(ctx, x, top, w, h, c.radius);
      ctx.fill();
    }
    if (L.hl) {
      var pB = M.pillPaddingBlock * L.size, pI = M.pillPaddingInline * L.size;
      ctx.fillStyle = rgba(L.hl.colour, 1);
      rr(ctx, L.tx - pI, L.baseline - L.A - pB, L.textW + 2 * pI, L.A + L.D + 2 * pB, L.hl.radius * L.size); ctx.fill();
    }
    if (L.ring) {
      var bw = M.ringWidth * L.size, rx = L.tx - M.ringReach * L.size - bw, rw = L.textW + 2 * (M.ringReach * L.size + bw);
      var ry = L.baseline - L.A - bw, rh = L.A + L.D + 2 * bw;
      ctx.strokeStyle = rgba(L.ring, 1); ctx.lineWidth = bw;
      ctx.beginPath(); ctx.ellipse(rx + rw / 2, ry + rh / 2, (rw - bw) / 2, (rh - bw) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function paintShadows(ctx, L, lay, ln) {
    if (L.opacity <= 0) return;
    setTracking(ctx, ln.ctn.tracking);
    ctx.textAlign = "left";
    // CSS paints the first shadow on top: draw them last to first
    for (var i = L.shadows.length - 1; i >= 0; i--) {
      shadowOnly(ctx, L.shadows[i], function (dx) {
        ctx.fillStyle = "#000"; ctx.strokeStyle = "#000";
        if (L.stroke && L.stroke.width > 0) { ctx.lineWidth = L.stroke.width; ctx.lineJoin = "round"; glyphs(ctx, L, L.text, L.tx + dx, L.baseline, "stroke"); }
        if (L.fill.kind !== "none") glyphs(ctx, L, L.text, L.tx + dx, L.baseline, "fill");
      });
    }
  }

  function paintText(ctx, L, lay, bounds) {
    if (L.opacity <= 0) return;
    setTracking(ctx, L.letters ? lay.base.tracking : (L.trk != null ? L.trk : lay.base.tracking));
    ctx.textAlign = "left";
    if (L.letters) return paintRansom(ctx, L);
    if (L.underline) {
      var th = M.underlineWidth * L.size;
      ctx.fillStyle = rgba(L.underline, 1);
      ctx.fillRect(L.tx, L.baseline + Math.max(L.D * 0.35, th), L.textW, th);
    }
    if (L.stroke && L.stroke.width > 0) {
      ctx.strokeStyle = rgba(L.stroke.colour, 1); ctx.lineWidth = L.stroke.width; ctx.lineJoin = "round"; ctx.miterLimit = 2;
      glyphs(ctx, L, L.text, L.tx, L.baseline, "stroke");
    }
    if (L.fill.kind !== "none") {
      ctx.fillStyle = fillStyleFor(ctx, L, L.fill, bounds);
      glyphs(ctx, L, L.text, L.tx, L.baseline, "fill");
    }
  }

  function paintRansom(ctx, L) {
    L.letters.forEach(function (o) {
      var x = L.x + o.x, h = L.lineH * o.size + 2 * o.padB;
      var top = L.baseline - o.above, cx = x + o.w / 2, cy = top + h / 2;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate((o.tilt * Math.PI) / 180); ctx.translate(-cx, -cy);
      ctx.fillStyle = o.paper; ctx.fillRect(x, top, o.w, h);
      ctx.fillStyle = o.ink;
      glyphs(ctx, L, o.text, x + o.padI, L.baseline, "fill", o.font, o.skew);
      ctx.restore();
    });
  }

  /**
   * Draws the caption visible at time t (seconds, same clock as the words) on a W x H frame.
   * opts: {W, H, t, groups, values, motion?: "smooth"|"snappy"|"playful"|"restrained"|"stepped"}.
   * Returns the layout (or null when no caption shows).
   */
  var layerCache = null;
  /** An offscreen canvas the size of ctx's canvas (null when none can be made). */
  function layerFor(ctx) {
    var cv = ctx.canvas;
    if (!cv || !cv.width) return null;
    if (layerCache && layerCache.width === cv.width && layerCache.height === cv.height) return layerCache;
    try {
      if (typeof document !== "undefined" && document.createElement) { layerCache = document.createElement("canvas"); layerCache.width = cv.width; layerCache.height = cv.height; }
      else layerCache = new cv.constructor(cv.width, cv.height);
    } catch (e) { layerCache = null; }
    return layerCache;
  }

  function paintCaption(ctx, lay, o) {
    var v = lay.v, d = lay.div, fs = lay.fs;
    ctx.save();
    clearShadow(ctx);
    ctx.textBaseline = "alphabetic";
    ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
    if (v.entrance === "rise") ctx.translate(0, (1 - lay.moved) * M.entranceRise * fs);
    else if (v.entrance === "slide") ctx.translate((lay.moved - 1) * M.entranceSlide * fs, 0);
    else if (v.entrance === "pop") { var s = M.entrancePopFrom + (1 - M.entrancePopFrom) * lay.moved; ctx.scale(s, s); }
    if (v.rotate) ctx.rotate((v.rotate * Math.PI) / 180);
    ctx.translate(-d.w / 2, -d.h / 2);
    ctx.globalAlpha = lay.alpha;
    paintBackdrop(ctx, lay);
    lay.blocks.forEach(function (b) {
      ctx.save();
      if (b.row && (b.row.shift || b.row.rotate)) {
        var rcx = d.contentX + d.contentW / 2, rcy = d.contentY + b.y + b.h / 2;
        ctx.translate(b.row.shift * b.ctn.size, 0);
        ctx.translate(rcx, rcy); ctx.rotate((b.row.rotate * Math.PI) / 180); ctx.translate(-rcx, -rcy);
      }
      paintBlock(ctx, b, lay);
      ctx.restore();
    });
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.restore();
  }

  /**
   * Draws the caption visible at time t (seconds, same clock as the words) on a W x H frame.
   * o: {W, H, t, groups, values, motion?: "smooth"|"snappy"|"playful"|"restrained"|"stepped", opacity?}.
   * Returns the layout (or null when no caption shows).
   */
  function draw(ctx, o) {
    var lay = layoutCaption(ctx, o);
    if (!lay) return null;
    var v = lay.v;
    var shown = 1;
    lay.moved = 1;
    if (v.entrance !== "none") { var p = captionProgress(lay.since, lay.motion, "entrance"); shown = p.shown; lay.moved = p.moved; }
    var opacity = (v.entrance === "none" ? 1 : shown) * (o.opacity == null ? 1 : o.opacity);
    if (opacity <= 0) return lay;
    var blur = v.entrance === "blur" && shown < 1 ? (1 - shown) * M.entranceBlur * lay.fs : 0;
    var layer = opacity < 1 || blur > 0 ? layerFor(ctx) : null;
    if (!layer) { lay.alpha = opacity; paintCaption(ctx, lay, o); return lay; }
    // CSS opacity and blur act on the whole caption: paint it on a layer, then composite once.
    var lc = layer.getContext("2d");
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, layer.width, layer.height);
    var m = ctx.getTransform();
    lc.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    lay.alpha = 1;
    paintCaption(lc, lay, o);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = opacity;
    if (blur > 0 && "filter" in ctx) ctx.filter = "blur(" + (blur * devScale({ getTransform: function () { return m; } })).toFixed(2) + "px)";
    ctx.drawImage(layer, 0, 0);
    if ("filter" in ctx) ctx.filter = "none";
    ctx.restore();
    return lay;
  }

  var api = {
    load: load,
    resolve: resolve,
    groupWords: groupWords,
    draw: draw,
    layout: layoutCaption,
    groupAt: groupAt,
    splitIntoRows: splitIntoRows,
    keyWordIndex: keyWordIndex,
    captionProgress: captionProgress,
    fonts: FONTS,
    faces: FACES,
    get templates() { return D ? D.templates : []; },
    get data() { return D; },
  };
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.CAPTIONS = api;
  else if (root) root.CAPTIONS = root.CAPTIONS || api;
})(typeof globalThis !== "undefined" ? globalThis : this);
