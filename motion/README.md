# motion/

- `npm install` here (fonts come from @fontsource packages; add any new family to engine.js FONT_SETS).
- `spec.json` (you write it): `{ "label": "...", "credit": "...", "clips": [{ "n", "title", "style",
  "styleFile", "format": "9:16"|"16:9", "audio": "audio/clipNN.mp4", "dur", "beats": [...] }] }`.
- `styles/<styleFile>.js`: one module per clip (see references/style-modules.md).
- `node engine.js <n> --stills 1,8` -> out/stills/; `node engine.js <n>` -> out/clipNN.mp4.
- `node build.js` -> ../board/motion/styles.bundle.js + data.js for the board's live previews
  (data.js carries each clip's frame size and the spec's label/credit, so previews get exactly
  what engine.js gives a module).
- `node check-preview.js --board ../board [--clips 2,6] [--times 4,12]` -> draws the same moments
  in the real board page (headless Chromium, `npm i playwright && npx playwright install chromium`)
  and with engine.js, writes side-by-side sheets to out/preview-check/, exits 1 if they differ.
  Run it whenever styles, the board, build.js or engine.js change.
