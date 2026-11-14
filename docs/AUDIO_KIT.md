# Audio kit (voice-over for M2-M5)

Four scenarios need voice: S08, S10, S11 and S12. They are built and in the app already
(`public/media/audio/m2.mp3` to `m5.mp3`). This page records exactly how, so the team can change or replace them.

## How they were made
- **Voices:** fully synthetic neural text-to-speech (Kokoro, running offline). No voice is a clone of a real person,
  which keeps the ethics commitment in the proposal ("only consenting team members' voices or fully synthetic people").
- **Phone-line processing:** ffmpeg band-pass filter (so they sound like a call or voicemail), light compression, and a
  stronger low-pass on M4/M5 for the "a little muffled" excuse.
- **Source of truth:** `scripts/audio/audio_script.json` (text, voice, speed, filter). `scripts/audio/generate_audio.py` is the
  record of how the files were produced. It needs the `lumina-tts` command and ffmpeg, so most team members will not run it.

| Clip | Scenario | Voice(s) | Length | Direction |
|------|----------|----------|--------|-----------|
| M2 | S08 | Emily: `af_nova` (young woman, quick, upset). Caller: `am_onyx` (calm, firm) | about 17 s | Crying and rushed, then a flat, controlled threat |
| M3 | S10 | `am_echo` | about 28 s | Polite, slightly robotic, with a faint echo |
| M4 | S11 | `am_liam` | about 15 s | Young man, upset, muffled |
| M5 | S12 | `am_liam` (same voice as M4) | about 15 s | Shaken, muffled, same voice so pair P1 stays equally hard |

Lengths are shorter than the "about 20 / 25 s" in the Week 2 pack. The app reads the real length from the file and shows it on the Play
button, so nothing needs updating if you swap files.

## Limits to know about
- Emotion is limited. A crying voice is the hardest thing for text-to-speech, so M2's "Emily" sounds worried rather than sobbing.
  That is a trade-off with the "easy to hear" request from the team (Week 1 comment). If you want more emotion, use option B below.
- Every clip shows "Made with AI for training", a transcript ("Read what was said"), and falls back to the transcript if the file
  cannot play.

## Replace a clip (no code change)
**Option A: Mei's voice app (the Week 2 plan).** Record or generate the lines from `audio_script.json`, export MP3, overwrite
`public/media/audio/m2.mp3` (and so on). If the words change, change `transcript` in `content/scenarios.json` and the matching entry
in `audio_script.json`, then run `npm run release -- content-patch "Updated M2 audio"`.

**Option B: a cloud neural voice service with emotion styles** (for example Azure AI Speech, which can be used from a free tier).
Use the same text and settings: mono, MP3, under 30 s, a young adult voice for Emily, a calm adult male for the caller, one young male
voice for both M4 and M5. Keep voices synthetic: do not clone a real person's voice, even a team member's, without written consent.

## Accessibility notes for Mei's review
- Check each clip is easy to hear on a phone speaker at low volume.
- Check the transcript matches the audio word for word (the validator checks the transcript exists, not that it matches).
