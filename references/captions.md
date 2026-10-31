# Captions

## Default: designed per clip
Caption wording follows the intake's `captionWording` (exactly as spoken, or lightly refined); see
"Captions" in SKILL.md.
When the user wants captions, each clip's style module draws them as part of its look, in the
language/script chosen at intake (for example Roman Urdu, or English and Urdu script mixed as
spoken; see "Languages on screen" in SKILL.md). Placement, type, motion and treatment
are design decisions for that clip.

Captions should follow what's being said. For word-by-word effects, give every caption word a
start and end: map the caption's words onto the source-language word timestamps from
`scripts/clip_timing.py` within each beat's window (proportionally, snapping to source word
boundaries where the counts allow). When the caption is a transliteration or a condensed
paraphrase of the speech, say so to the user rather than presenting it as verbatim.

## Optional: the caption-style library (from the user's Animora repo)
The user's own project Animora (github `Aimen-Khalid/animora`, `library/caption-style` and
`library/captions`) has a caption-style system the user likes. It's ported to Canvas 2D in
`motion/captions/`, and draws identically in Node renders and board previews:
- `templates.json`: all 151 templates (id, label, hint, group, values fully resolved), extracted
  by running Animora's own code (`tools/extract.ts`), plus the group list.
- `captions.js` (Node and browser; `window.CAPTIONS` in the page): `load(json)`,
  `resolve(presetId, overrides)`, `groupWords(words, values)` (Animora's chunking, stacked rows,
  key-word picking), `draw(ctx, {W, H, t, groups, values, motion})`, `fonts` (strings to preload),
  `templates`, `data.groups`.
- `fonts/` + `fonts-node.js` (registers them for renders) and `fonts-google.txt` (one Google Fonts
  URL for the page).
- `word-times.js`: gives every caption word a start/end by spreading each beat's words over the
  source-language words spoken in that beat (from `scripts/clip_timing.py`); writes `words.json`
  keyed `clip<n>`. Adapt its input paths to the project.
- `demo.js`: a contact sheet of templates over a grey frame, for checking.

What it offers:
- 151 templates in groups: Classic, Key word, Stacked, Spotlight, Glow, Boxes, One word, Lines, Fun.
- The word being said: emphasis by colour, pill, box, pop, karaoke fill, hollow or italic; words to
  come shown, built up word by word, or dimmed.
- Key words: picked automatically per caption and given their own font, colour, size, glow, and
  a box, ring or underline, inline or on their own row.
- Stacked rows with per-row font, size, colour, gradient, outline, box, overlap, shift, tilt.
- Backdrops: box, line bands, word chips, frame, chat bubbles, notification card, torn paper,
  ransom letters.
- Fill (solid, gradient, split, hollow), outline, shadow, echo, glow; entrances (fade, rise, pop,
  blur, slide) with a motion feel; position, alignment, rotation; whole lines or N words at a time.

How it's used: each video card on the board has a Captions button that opens a gallery of the
templates as live mini previews, plus "Designed for this clip" (the default). Choosing a template
saves `captionStyle` (`{preset, overrides}`; overrides hold the user's position: `position`, `nudgeX`, `nudgeY`, shares of the frame, clamped to ±0.45) on that clip's row; the preview switches at once, and the render uses it.
With a template chosen, `H.externalCaptions` is true, the style module skips its own captions,
and the shared caption layer draws them after the frame (in `engine.js` from `clip.captionStyle`
in spec.json, which you copy from the clip's board row before rendering; on the board from the
row directly). `build.js` copies `captions.js` and writes `captions-data.js` (templates, word
timings, font URL) next to the preview bundle; publish both with the board.

If the repo is needed again (to refresh templates), add it with the add_repo tool and read
`library/caption-style/README.md` first.
