# Style modules (the motion design for one clip)

A clip's motion design is one JS module. The same file renders the MP4 in Node
(`@napi-rs/canvas` -> ffmpeg) and the live preview on the board (bundled by `build.js`).

## Shape
```js
module.exports = {
  setup(H) { /* build anything reusable once: offscreen layers, textures, paths */ return state; },
  frame(ctx, t, H, state) { /* paint the whole frame for time t (seconds) */ },
};
```
`frame` must depend only on `t` (and what `setup` built), because the board scrubs and the
stills command samples arbitrary moments. Paint the full frame each time.

## Helpers on H
- `W`, `H`: frame size (1080x1920 for 9:16, 1920x1080 for 16:9). Read these, don't hard-code.
- `dur`, `clip` (the spec entry), `beats`: `[{t, text, en, kind, tag?, i, start, end}]`.
  `text` is the on-screen language the user chose; `en` an English gloss; `kind` is a loose
  hint (hook, line, key, quote, end); `tag` marks moments a style may want to find.
- `voice(t)`: the speaker's loudness 0..1 at t (smoothed), for motion that reacts to the voice.
- `beatAt(t)`, `phase(beat, t, inDur, outDur)` -> `{inT, outT, age, life}`.
- `ease.*` (outCubic, inOutCubic, outBack, outElastic, outExpo, ...), `rng(seed)`,
  `noise1(x, seed)`, `wrap`, `fitText(ctx, text, fontFn, maxW, maxSize, minSize, maxLines)`,
  `clamp`, `lerp`.
- `meta.label`, `meta.credit`: the show name and credit line from `spec.json`, if the design wants them.
- `externalCaptions`: true when the user picked a caption template for this clip on the board;
  the module must then not draw its own captions (start its caption function with
  `if (H.externalCaptions) return;`). Read it at draw time, since the user can switch live.

## The canvas a module gets
`frame` always gets a canvas of exactly `H.W` x `H.H` with an identity transform, in engine.js and
on the board alike (the board shows that canvas smaller with CSS). So any standard canvas call is
fine, including `setTransform`/`resetTransform` for a camera. `check-preview.js` confirms the two
match.

## What the tooling needs (and nothing more)
- Standard Canvas 2D, so it runs in both Node and browsers. Offscreen canvases come from
  `require("@napi-rs/canvas").createCanvas(w, h)` (shimmed in the browser); no other require or
  Node API. `ctx.filter` works in Node and Chrome but not Safari, so treat it as a bonus.
- Fonts: the families registered in `engine.js` (and loaded by the board). To use another Google
  font, add it to both.
- Frames fast enough to preview smoothly in a browser; pre-bake static layers in `setup`.
  Measured in the first run (@napi-rs/canvas): filling the whole frame with a pattern costs
  ~30 ms, drawing a large offscreen canvas ~5-9 ms each, clipping a large area ~10 ms, and
  enlarging an image with smoothing on ~2x the cost. Bake textures once and draw them as one
  image; turn smoothing off when zoomed in; clip only when an edge is on screen.
- If a clip needs more than this (WebGL/3D, SVG, video footage, generated images), change the
  tooling rather than the idea: see SKILL.md.

## Checking
`node engine.js <n> --stills 1,6.5,12,20` writes PNGs to `out/stills/`; join several into one sheet
(`ffmpeg -i a.png -i b.png ... -filter_complex "hstack=N,scale=1600:-1" sheet.png`) and look at it
with Read. Cover transitions and tagged moments, and look at frames a couple of seconds apart.
Two questions to ask of every sheet: with the sound off, would a viewer get the gist from the
pictures? And does every frame use the whole screen, with nothing cut off that shouldn't be (a
scene sliced at the edge, the edge of a page or desk showing during a push-in, a scene filling
only half of a tall frame)?
Don't run full renders while others share the CPU.

## Briefing a builder subagent
Give it: the clip's beats (with `en`), its style and format, this file, the example module path,
and the encouragement in SKILL.md's motion section. Ask it to sketch what's on screen moment by
moment as a comment at the top of the module, build, check stills, run `node build.js`, message
the main session that the clip is ready, and report back with its sheets. Leave the creative
decisions to it.
