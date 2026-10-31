# Video to Motion Clips

**A Claude skill that turns a long video or podcast into short motion-design clips, voiced by the original speaker.** Give it a YouTube link, a Google Drive link or an uploaded file. Claude finds the best self-contained moments, cuts the speaker's real voice for each one, and builds an animated video around it. You review it all on one live board, with playable audio, live previews, captions and one-click MP4 rendering.

---

## What it does

Ask Claude for clips from a talk, interview, lecture or episode, for example *"make 5 shorts from this podcast"* with a link. Claude opens a board with a Setup tab, and the rest happens there.

1. **Setup.** Choose:
   - the source: a YouTube link, a Google Drive link, or a video or audio file attached in the chat;
   - a brief for the kind of moments you want, and how many clips;
   - a style: Claude picks per clip, one style for all, a shortlist, or your own description;
   - the shape: 9:16, 16:9, both, or mixed per clip;
   - the text language: English, the video's language in its own script, Roman Urdu, or mixed the way the speaker talks;
   - captions on or off, worded verbatim or lightly refined;
   - where the finished MP4s go: the chat, a Google Drive folder, or both.
2. **Transcribe and separate speakers.** Whisper transcribes with word timings, and voice embeddings tell the speakers apart.
3. **Pick the voices.** Hear a sample of each speaker on the board and choose whose words become clips.
4. **Clean cuts.** Clips start and end on sentence boundaries, and every edge is checked so no clip starts or stops mid-word.
5. **Sound review.** Play each clip, delete the ones you don't want, add notes, and set the style and shape per clip.
6. **Motion design.** Every clip gets its own animated video, built in parallel. Previews appear on the board one by one as they're ready, playing in sync with the voice.
7. **Iterate and render.** Send feedback per clip and Claude rebuilds it. Press **Render MP4** on a clip, or **Render all MP4s**, when you're happy.

## Highlights

- **The speaker's own voice.** Clips use the original audio, not a synthetic voiceover.
- **Videos about what's being said.** Each clip is designed around its moment, with scenes, metaphors and objects that react to the voice, not just a background with text on top.
- **Multilingual and code-switching.** Handles speakers who switch between Urdu and English mid-sentence. Text can follow the speaker word by word, in Urdu script (right to left, Noto Nastaliq) or in English letters.
- **150+ caption styles.** Captions are designed per clip by default, or chosen from a gallery with word-by-word highlighting, key-word emphasis, stacked rows and more.
- **The preview is the render.** Board previews draw exactly the same frames as the final MP4, and a check script confirms they match.

## Install

**Claude (claude.ai and the desktop app):** download this repo as a ZIP (or zip the folder yourself) and add it as a skill in Claude's settings.

**Claude Code:**

```bash
git clone https://github.com/Aimen-Khalid/video-to-motion-clips ~/.claude/skills/video-to-motion-clips
```

### Requirements

Claude installs what's missing when the skill runs:

- `ffmpeg`, Node.js, and Python 3
- Transcription and speaker separation: `faster-whisper`, `speechbrain`, `scikit-learn` and CPU `torch`
- Rendering: `npm install` in `motion/` (`@napi-rs/canvas` and the fonts), plus `playwright` for the preview check
- YouTube links: `yt-dlp`. Some cloud machines are blocked by YouTube. If yours is, upload the file or share it from Google Drive instead.

## How it's organised

```
SKILL.md                    the workflow Claude follows
assets/board.html           the live review board (setup, voices, sound clips, previews, render)
scripts/
  transcribe.py             Whisper transcription with word timings
  diarize.py                speaker separation (ECAPA voice embeddings, clustered)
  speaker_samples.py        voice samples for the speaker picker
  cut_clips.py              clean cuts on sentence boundaries
  clip_timing.py            word timings per clip, with language re-identification
motion/
  engine.js                 renders a clip's style module to stills or MP4 with its voice
  build.js                  bundles styles for the board's live previews
  check-preview.js          confirms board previews match the render
  styles/                   an example style module
  captions/                 the caption-style library, its fonts and licences
references/                 board, caption library and style-module guides
```

## Credits

- Transcription: [faster-whisper](https://github.com/SYSTRAN/faster-whisper). Speaker embeddings: [SpeechBrain](https://speechbrain.github.io/) ECAPA-TDNN.
- The caption-style library is ported from [Animora](https://github.com/Aimen-Khalid/animora).
- Caption fonts are open-source Google Fonts. Each font's licence is in `motion/captions/fonts/licenses/`.
- Made by [Aimen Khalid](https://github.com/Aimen-Khalid) with Claude.
