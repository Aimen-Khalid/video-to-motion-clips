# The review board

One published artifact carries the whole review: voice picking, sound-clip review, live motion
previews, feedback and render requests. `assets/board.html` is the working page from the first
run. Reuse it: change its `<title>` (and the fallback header text) to the new video's name, and
change anything else that this project needs. It's a starting point, not a fixed design.

Load the `artifact-capabilities` and `artifact-design` skills before publishing it.

## Capabilities
Publish with `capabilities: {db: {}, assets: {}, comments: {}}`, and supporting files
`motion/styles.bundle.js`, `motion/data.js`, `motion/captions.js` and `motion/captions-data.js` (built by `motion/build.js` into
`<board dir>/motion/`). Republish with the same file path to keep the URL; pass the `files` map
again whenever the bundle changes.

## Tabs
- **Setup**: the intake form (see SKILL.md step 1). It opens first on a new board (no
  `board/meta` yet, or stage `setup`), and stays available later so the user can check or change
  answers.
- **Review**: voices, clips, previews, depending on the stage.
The URL hash (`#setup`, `#review`) remembers the tab.

## Database
- `intake/current`: the Setup answers: `source` (a link to a video or audio file, or empty when it's attached in the chat), `brief`, `countMode` (auto|fixed), `count`,
  `styleMode` (auto|same|shortlist|mixed), `styles[]`, `styleCustom`, `format` (9:16|16:9|both|mixed),
  `textLang` (english|native|roman|mixed-roman|mixed-native), `captions` (on|off), `captionWording` (verbatim|refined), `destination` (chat|drive|both),
  `driveFolder`, `notes`, `detectedLanguage` (you write it), `startRequestedAt`.
- `board/meta`: `title`, `source` (eyebrow line), `stage` (`voices` -> `clips` -> `motion`),
  `speakers` `{S1: {label, minutes, sample: <asset id>}, ...}` (stages now: `setup` -> `voices` -> `clips` -> `motion`), `speakersSelected` (array),
  `overall` (overall notes), `mp4Destination`, and timestamps the page writes when the user acts:
  `voicesConfirmedAt`, `submittedAt`, `renderAllRequestedAt`.
- `clips/<id>`: `n`, `title`, `idea`, `start`, `end`, `speaker`, `speakerLabel`, `transcript`,
  `style`, `format`, `audio` (asset id), `deleted`, `notes`, `renderRequestedAt`, `renderedAt`,
  and `captionStyle` once the caption library is wired in.
- Seed and update rows with `ArtifactData` (`batch` for many rows; pin `if_version` on existing
  documents; on a version conflict re-read and redo, since the user may have just edited).
- Never write invented data the user didn't give; rows are the real clips.

## Assets
Upload clip audio and voice samples with the Artifact tool (`asset: true`, `file_paths`). Audio-only
`.mp4` (AAC) uploads as `video/mp4` and plays fine in `<audio>`; plain audio types aren't accepted.
Rows hold the asset id; the page plays `"/_blob/" + id`. After a re-cut, upload the new file and
update the row's `audio` (the page rebinds its player when the id changes).

## Stages
- **voices**: samples with checkboxes (multi-select) and Confirm voices. Clip list hidden.
- **clips**: one card per clip: number, title, idea, in/out times, length, voice, play button with
  the real audio, delete/restore, transcript (say if it's machine-translated), style picker (a big
  grouped catalogue; any other style the user writes in notes is fine too), format picker, notes;
  plus overall notes and Send review to Claude.
- **motion**: each card also shows the live preview (canvas synced to the clip audio: tap to
  play/pause, scrub, full-screen button with its own controls, Esc to close), a Captions button
  (a modal gallery of every caption template, plus "Designed for this clip"; picking one saves
  `captionStyle` and applies it live). Each tile shows only the caption, in the clip's own words,
  on a plain dark gradient, cropped to the caption and enlarged; the user found tiles drawn over
  the clip's frame too hard to read. With a template chosen, the card shows Caption position
  (Top / Middle / Raised / Bottom, Reset) and the caption can be dragged on the preview or in
  full screen (a dashed outline while dragging; it snaps to the centre line). Position and drag
  save as `captionStyle.overrides` (`position`, `nudgeX`, `nudgeY`), which the renderer applies
  too. A tap that ends a drag must not also start playback. Then a Render MP4 button
  with status, and the header gets Render all MP4s. The send button becomes Send feedback to
  Claude.

## Keep the user's place
Every edit saves to the database, and the page re-renders from the snapshot it gets back. Make
sure that never moves the page: preserve the scroll position around re-renders and around
overlays (the caption gallery, full screen), only reorder cards when the order really changed,
and focus with `preventScroll`. In the first run, picking a caption for clip #10 threw the user
back to the top of the page, which was confusing.

## Messages from the board
The page calls `comments.sendToClaude` (anchored to the button) with a one-line summary, e.g.
"Voices confirmed: Voice A, Voice C…", "Review done. Keep 10 clip(s)… Notes on #1…",
"Render MP4: clip #4 (Origami paper folds, 9:16)". It arrives in this session as an artifact
comment. Handle it like any request: re-read the rows (the summary is only a pointer), do the
work, update the board, reply in that thread with what you did, and resolve the thread. If the
page can't reach Claude (no session listening), it shows a handoff card under the button: what
Claude will do, the exact prompt, and Copy prompt. The user pastes it into the chat; treat that
as the go-ahead and read the rows.

## Previews
The preview canvas is the render canvas: `width`/`height` are the clip's frame size (from
`data.js`), the context is never pre-scaled, and CSS shows it smaller; full screen copies its
pixels. Run `motion/check-preview.js` after changing the board, `build.js` or `engine.js`.
`motion/build.js` writes `styles.bundle.js` (every style module wrapped for the browser, with a
`require("@napi-rs/canvas").createCanvas` shim) and `data.js` (beats, durations, voice envelope per
clip). It falls back to a style's last good copy if a file is mid-edit, so republishing while
builders work is safe. The page loads the fonts the styles use from Google Fonts and waits for
them before drawing; add any family a new style uses to the page's font link and preload list.
