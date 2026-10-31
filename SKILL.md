---
name: "video-to-motion-clips"
description: Turn a long video or audio recording (YouTube link, Google Drive link, or an uploaded video or audio file) into short motion-design clips voiced by the original speaker. Transcribes and separates speakers, lets the user pick whose voices to use, extracts self-contained moments on clean sentence boundaries, reviews them on a live board with playable audio, then builds a motion-design video for each clip with live previews, captions and one-click MP4 rendering. Use this whenever someone wants clips, shorts, reels or highlights cut from a podcast, talk, interview, lecture or episode and turned into animated / motion graphics videos, even if they only say "make clips from this video", share a podcast MP3, or paste a YouTube link.
---

# Video to motion clips

You take a long video or audio recording, find its best self-contained moments, cut the original voiceover for each
one, and build a motion-design video around that voice. Everything the user reviews lives on one
board (a published artifact): sound clips first, then live motion previews they can play, comment
on, restyle and render.

This skill sets up the workflow, the steps and the tools. It deliberately does not prescribe what
the videos should look like. Every clip is a fresh piece of motion design, and the goal is the
best video you can make for that moment of speech. Where this file offers creative thoughts, take
them as encouragement, not rules.

## The flow at a glance

1. Open the board straight away on its Setup tab; the user answers the intake there and presses Start.
2. Audio: download or receive the media; extract audio.
3. Transcribe and separate speakers.
4. Voices first: the user picks whose voices to use on the board.
5. Pick clips from those voices only, cut them cleanly, check every edge.
6. Sound-clip review on the board (play, delete, notes, style, format).
7. Build every clip's motion design at once; publish each preview to the board as it lands.
8. Iterate from board feedback; render MP4s only when asked.

Keep a task list running so the user can see where things are, and send short updates when
something lands or changes. Don't stop to ask for approval between steps that the user didn't
ask to review.

## 1. Setup, on the board

The first thing to do, however the request is phrased, is give the user the board, opened on its
**Setup** tab, before any downloading or research. Everything happens in that one artifact from
here on, so the user has a proper UI from the start rather than a run of chat questions.
`references/board.md` covers building and publishing it (`assets/board.html` is the working page).
Tell the user in a line: fill in Setup and press **Start**.

The Setup tab asks, with sensible defaults preselected:
- **The video or audio:** a YouTube link, or a Google Drive link to a video or an audio file. Big
  files can't go into the board, so a file from their computer is attached in the chat (or shared
  from Drive) instead. Only the sound is used, so an audio file works as well as a video.
- **Brief:** what kind of moments to extract (optional).
- **How many clips:** a number, or as many meaningful moments as exist.
- **Style:** Claude picks per clip, one style for all, from a shortlist they choose, or mixed
  (set per clip later). A large grouped catalogue to choose from, plus "describe your own".
- **Dimensions:** all 9:16, all 16:9, both, or mixed per clip.
- **Text in the videos** (captions and every other word on screen), shown on the Setup tab with an
  example line from a speaker who mixes languages:
  - `english`: all English; other-language parts translated.
  - `native`: all in the video's language, in its own script; English parts translated.
  - `roman`: all in the video's language, in English letters (Roman Urdu; the first run's choice).
  - `mixed-roman`: follow the speaker, all in English letters: English stays English, Urdu stays
    Urdu written in English letters.
  - `mixed-native`: follow the speaker, each in its own script: English in English letters, Urdu
    in Urdu script.
  Plus captions on or off, and **caption wording** (shown when captions are on):
  - `verbatim`: exactly as spoken, every word including repeats, fillers and restarts.
  - `refined` (default): lightly refined; fillers, repeats and false starts removed, the
    speaker's own words and meaning kept.
  See "Languages on screen" and "Captions" under step 7.
- **Where finished MP4s go:** the chat, a Google Drive folder (name), or both.
- **Notes.**

Answers save as they're typed into `intake/current`. **Start** sends a short message to this
session (an artifact comment); read `intake/current` and begin. If the page can't reach Claude, it
shows a handoff card with the exact prompt and a Copy button for the user to paste into the chat.

If the user already gave answers in chat (or a link with their first message), seed
`intake/current` yourself so they don't repeat anything, and start once the source is known.
Once you've detected the video's language (step 3), write `detectedLanguage` into the intake so
the Setup tab names it, and ask about text language then if it's still unanswered.

Speaker choice isn't in Setup: it happens on the board after speaker separation (step 4),
because people can only choose once they can hear the voices.

## 2. Getting the audio
The source can be a video or an audio file. Everything after this step uses only the two audio
files made below, so the rest of the workflow is the same either way.

**Audio file** (MP3, M4A, WAV, AAC, OGG, FLAC...): use it directly; there's nothing to extract.
Copy it to the working directory and make the two working files from it with the ffmpeg commands
below.

**Video file:** copy it to the working directory (uploads are read-only); the commands below take
its sound track.

**Google Drive link:** use the Google Drive connector to download the file (video or audio).

**YouTube link:** try `yt-dlp` in the workspace first (`pip install yt-dlp`). Cloud workspaces are
often blocked by YouTube ("Sign in to confirm you're not a bot", HTTP 429, IP blocked), and the
block is per machine, so it can work in one session and not the next. If it's blocked:
- Say so plainly first, in one or two sentences.
- Don't try to get around the block (alternate player clients, proxies, mirror front-ends,
  third-party downloader services). It's YouTube refusing this machine, and dodging it isn't ours to do.
- Offer the user ways forward:
  - They download the video or just its audio on their own machine and upload it here or share it
    from Drive. Don't name or recommend downloader websites (they're unofficial and mostly shady).
    If it's their own channel, YouTube Studio's download option is the official route.
  - If Claude in Chrome is connected: open the video in their Chrome, read YouTube's transcript
    panel, pick the clips from it, then record only those segments' audio from the playing video.
    Recording a whole long video in real time is too slow; the user rejected that.
  - If the session is linked to their computer through the desktop app, run yt-dlp there.

Then make the two working audio files (keep both). `source` is the video or the audio file, in any
format ffmpeg reads; `-vn` just ignores the picture when there is one:
```bash
ffmpeg -i source.<ext> -vn -ac 1 -ar 16000 audio16k.wav       # for transcription / analysis
ffmpeg -i source.<ext> -vn -ac 1 -ar 48000 -c:a pcm_s16le audio48k.wav   # for clip cuts
```
If the file has several audio tracks (some videos carry other languages or commentary), check with
`ffprobe` and pick the speaker's track with `-map 0:a:<n>`.

## 3. Transcribe and separate speakers

Scripts are in `scripts/`. Install: `pip install --break-system-packages faster-whisper speechbrain
scikit-learn` and CPU torch (`pip install torch torchaudio --index-url
https://download.pytorch.org/whl/cpu`).

1. Detect the language on a short sample (seconds): `python scripts/transcribe.py audio16k.wav
   sample.json --start 60 --end 120`. Ask the language question from step 1 now if needed.
2. Transcribe the whole thing in the source language with word timestamps:
   `python scripts/transcribe.py audio16k.wav transcript.json --lang <code>`. Run it in the
   background and watch `transcript.json.progress` (about 4-5x realtime on 2 CPU cores; an hour of
   audio is ~12 minutes, but on a busy machine it can run near real time). Don't end your turn while
   it runs: in a claude.ai chat, a finished background job doesn't always bring the session back, and
   in the first demo the board sat idle for about 10 minutes until the user asked how it was going.
   Chain the next steps (transcribe, then separate voices, then cut samples) into one job and wait
   for it within the turn, or check on it until the next board step is up. Read the source language yourself if you can; if you need an English
   gloss too, a second pass with `--task translate` gives one (its timings drift, so never cut on it).
3. Separate speakers: `python scripts/diarize.py audio16k.wav transcript.json transcript_spk.json`
   (ECAPA voice embeddings on 2 s windows, clustered; labels S1, S2… by talk time; ~10 min per
   hour of audio). Raise or lower the threshold argument if voices merge or split.
4. Voice samples for the picker: `python scripts/speaker_samples.py transcript_spk.json
   audio16k.wav audio48k.wav samples/`.

While these run, keep the user posted with a line now and then; the board is already open.

## 4. The board, and voices first

Upload the voice samples, write the speakers into `board/meta`, and move the board to stage
**voices** (it switches to the Review tab). Stage **voices**: the board shows one sample per voice with checkboxes (several voices can be
ticked, not just one) and a Confirm voices button. Speakers aren't named in the audio, so label
them Voice A, B, C… unless the user tells you who's who. Clips are picked only after the user
confirms, and only from the confirmed voices.

## 5. Pick and cut the clips

Choose self-contained moments from the confirmed voices that fit the brief and the requested
count: each one should make sense on its own, start on the beginning of a thought and end on the
end of one. One voice per clip; if someone else interjects, trim around it or flag it.

Write a plan (`[{id, start, end, speaker, extend_to?}]`) and cut with
`python scripts/cut_clips.py plan.json transcript_spk.json audio16k.wav audio48k.wav clips/ --lang <code>`.
It snaps every start and end to real silences (transcript word times run early by up to a
second, which otherwise clips sentences) and then re-transcribes a few seconds at each edge in the
source language and prints them. Read every edge. In the first run this caught clips that ended on
the first words of the next sentence or the start of a new story, and clips that opened on the
tail of another speaker's sentence. Fix those with `--no-snap` and exact times, and re-check. The
user cares a lot about this: clips must never end abruptly or cut a sentence in half; if the
thought carries on past the planned end, extend the clip to finish it.

Upload the cut audio to the board's asset store and seed one database row per clip (title, the
main idea in a sentence or two, times, speaker, transcript, your style pick, format, audio asset
id). Move the board to stage **clips** and tell the user it's ready.

## 6. Sound-clip review

On the board each clip has a play button with its real audio, delete/restore, a notes box, a style
picker and a format picker, plus an overall notes box. The user sends their review from the board
(it arrives here as an artifact comment, or as a pasted prompt from the handoff card). Read every row and note,
act on all of it (re-cut, delete, add requested moments, change style/format), update the board,
and reply in the comment thread. Deleted clips never become videos.

## 7. Motion design

### Timing
Get word timings for each final clip in the source language: `python scripts/clip_timing.py
clips/cuts.json audio16k.wav timing.json --lang <code>`. Write each clip's spoken lines as timed
"beats" in the chosen text language (`text`), with an English gloss (`en`) for builders who don't
read the language, and `tag` on any moment a style needs to find (styles key off tags or beat
index, never by matching text). Time every beat to when its words are actually said.

### The renderer
`motion/` holds the tooling from the first run: `engine.js` renders a style module to PNG stills
(`node engine.js <n> --stills 1,8.5`) or a full MP4 with the clip's voice (`node engine.js <n>`),
and `build.js` bundles every style module plus beats and a voice-loudness envelope for the board's
live previews. A style module is `{ setup(H), frame(ctx, t, H, state) }`, drawn with Canvas 2D,
with `frame` a pure function of time so any moment can be previewed or scrubbed;
`references/style-modules.md` has the full contract and helpers. `motion/styles/example-rain-on-glass.js`
is one finished module, there to show the API, not a look to copy.

This tooling exists to make previews and renders easy. It isn't a ceiling. If a clip wants
something it can't do well (WebGL or 3D, SVG, real footage, generated imagery, particle systems,
a different renderer entirely), extend or replace it. One approach is rendering frames from the
same preview page in headless Chromium. Keep the board preview and the final render showing the
same thing.

**The preview must be the render.** The board draws each frame on a canvas of exactly the clip's
frame size (1080x1920 or 1920x1080) with an untouched transform, the same canvas engine.js gives
the module, and shows it smaller with CSS. Never shrink the canvas and scale the context under a
module: modules set their own transforms (a camera is normal canvas code), which silently undoes
that scale, so the render looks right while the board shows a zoomed-in corner. That happened in
the first run, and the user saw it before Claude did, because every check used engine.js stills.
So check the board itself: after `node build.js`, run
`node motion/check-preview.js --board <board dir>` (headless Chromium; it draws the same moments in
the board and in engine.js, writes side-by-side sheets to `motion/out/preview-check/` and fails if
they differ). Do it before telling the user previews are ready, and after any change to the board,
build.js or engine.js.

### Building every clip
Build all clips in one go: brief one subagent per clip or two, in parallel, rather than doing a
few and waiting for approval. Each subagent gets the clip's beats, style, format, the module
contract, and room to make it its own. The moment a subagent finishes and checks its stills,
rebuild the bundle (`node build.js`) and republish the board, so previews appear one by one as
they land. Tell the user when the full set is up.

Some thoughts from the first run that made the videos better (pass them on to builders as
encouragement, not as a checklist):
- The weakest first versions were "a nice background with the line appearing on top". The
  stronger ones show what's being said: scenes, characters, metaphors, objects that transform,
  diagrams, a world that reacts to the voice. Text can still lead when that's the idea.
- Short clips feel best fast-paced: something new on screen every couple of seconds, with visual
  changes landing on the phrases and emphases in the voice, not only on beat boundaries.
- Texture and dimension help: grain, paper, ink, light and shadow with volume, layers at different
  depths, atmosphere. Bring that depth inside a frame that's composed for the screen. In the first
  run, asking for "a physical world" and "a camera" led three builders to turn the artwork into
  an object on a desk (a comic page, a notebook) filmed by a moving camera; the content was laid
  out for the object, not the screen, so pans and push-ins sliced it at the edges. A camera can
  still travel, as long as what it lands on is composed for the frame.
- Sketching what's on screen moment by moment before building helps the piece hold together.
- Compose for the frame the clip will be watched in. A portrait clip laid out with wide panels
  or landscape-shaped scenes ends up looking like a landscape video cropped to fit (the user
  spotted exactly this in the first run). Using the full height of a tall frame, or the full
  width of a wide one, makes it feel native.

Builders should check their own work with stills (contact sheets of several moments) and look at
them. A useful question: with the sound off, would a viewer still get the gist from the pictures?
When a builder reports back, run the preview check on its clip before publishing.

### Languages on screen
Honour `textLang` exactly, in captions and in every other word on screen.
- **Follow the speaker** (`mixed-*`): each word or phrase keeps the language it was spoken in.
  Speakers often switch mid-sentence ("...yaani there is a balance, number one"), so decide word
  by word. In a source-language pass Whisper writes clearly spoken English in English letters but
  often writes English words in Urdu script (میڈیا ٹیم for "media team"). Read every line and mark
  what was said in which language; `scripts/clip_timing.py --langs ur,en` also re-identifies whole
  sentences spoken in the other language and re-transcribes them in it. Common loanwords spoken
  as part of an Urdu sentence are your call; keep the choice consistent across clips.
- **Own script** (`native`, `mixed-native`): Urdu is written in Urdu script and reads right to
  left. Canvas `fillText` lays out a mixed line correctly when the font list covers both scripts
  (e.g. `'600 64px Inter, "Noto Nastaliq Urdu"'`); a style that places words one by one must
  order right-to-left runs itself (see `visualOrder` in `motion/captions/captions.js`). The caption
  templates already do this, with an Urdu fallback font, right-to-left word order and the
  word-highlight moving right to left. Templates that cut words into separate letters (ransom
  letters) break joined scripts; avoid them for Urdu script.
- **English letters** (`roman`, `mixed-roman`): one consistent Roman Urdu spelling across a clip.
- Beats keep `text` in the chosen form and `en` as the English gloss. Tell the user when text is
  translated or condensed rather than verbatim.

### Captions
**Wording** follows `captionWording`:
- `verbatim`: caption every word in the transcript for that span, in order, nothing dropped or
  reworded ("So I, I think, umm, we should start."). Each caption word gets the start and end of
  the spoken word it came from. Fix only mishearings, by listening, not by tidying. With a
  translated or transliterated text choice, keep it as complete and literal as the language allows.
- `refined`: take out fillers (umm, you know, yaani as a filler), stutters, repeated words and
  false starts, and fix obvious slips, but keep the speaker's own words, order and meaning; never
  paraphrase or summarise ("I think we should start."). Remaining words keep their spoken timing,
  so a dropped filler leaves a short gap rather than shifting later words.
Both apply to the captions only. Other words on screen (headlines, key phrases) are design and
can be condensed as the clip needs.

If the user wants captions, design them as part of each clip's look by default, in the language
chosen at intake. The board also offers an optional caption-style library (ported from the user's
Animora project: 150+ templates with word-by-word highlighting, key-word emphasis, stacked rows,
backdrops, entrances); if the user picks a template for a video, that video switches to the shared
caption layer. See `references/captions.md`.

## 8. Iterate and render

Previews live on the board: each video plays in its card synced to its audio, can be scrubbed, and
has a full-screen button. Feedback arrives from per-clip notes and Send to Claude; act on it,
rebuild, republish, and reply in the thread.

Don't render MP4s until asked. Every video card has a **Render MP4** button and the board has
**Render all MP4s**; each sends a request here. Render exactly what was asked (`node engine.js
<n>`, H.264 at `-preset veryfast`), deliver to the destination chosen at intake (Drive folder via
the Drive connector, and/or SendUserFile in the chat), and mark the clip rendered on the board.

When the user gives feedback about the workflow itself, it's worth noting it for the next run.
