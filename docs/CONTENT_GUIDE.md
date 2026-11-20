# Content guide

All learning content lives in `/content` as JSON, separate from the code, so the content team can edit it without touching the app.

| File | What it holds |
|------|---------------|
| `scenarios.json` | The 20 examples S01-S20: message, media, the two questions, the explanation, sources |
| `glossary.json` | The 8 glossary terms: definition, Canadian example, "what to do", linked practice items |
| `tactics.json` | The 10 scam types (T1-T10) plus "real", used by the "My progress" guide cards |
| `meta.json` | `content_version` and its history |

## Editing steps
1. Edit the JSON. Keep each explanation to 60 words or fewer, phone numbers in the 555-01xx range, links as plain text.
2. Run `npm run validate:content`. It enforces the Week 1 and Week 2 writing rules (see below) and fails with a clear message.
3. Record the change: `npm run release -- content-patch "what changed"` (typo), `content-minor` (item added or reworded), `content-major` (test forms changed).
4. Commit, push. Vercel redeploys. Every saved attempt carries the content version it was shown, so results always trace back to the exact wording.

**Changing a test item (S11-S20) after testing has started makes earlier pre/post results hard to compare. Tell Tiffany first.**

## What `validate:content` checks
20 scenarios; 10 practice, 5 pre (Form A) and 5 post (Form B) in 5 matched pairs with the same tactic, verdict and format; 14 scams and 6 genuine messages, with 3 scams + 2 real in each test form;
exactly 3 options and 1 correct answer per question; explanations of 60 words or fewer; every phone number in 555-01xx (except the real CAFC number in S05);
no clickable links in scenario text; media file exists; images have alt text; audio has a transcript; AI-made media carries `ai_generated: true`;
highlight phrases really appear in the text; glossary "what to do" of 30 words or fewer and at least one practice item per term; every tactic exists.
It also prints an approximate reading grade for the explanations (the Grade 6-8 check from Week 2 is still open: the estimate is a rough screen, not a replacement).

## Scenario fields
Same fields as the Week 1 content pack, with these differences:

| Field | Note |
|-------|------|
| `form` (new) | `A` for pre items, `B` for post items, `null` for practice |
| `media_id`, `media_kind` (new), `caption` (new), `media_orientation` (new) | `media_url`, `alt_text`, `transcript` are as in Week 1. `caption` is the text layer under M8 and M9 |
| `highlights` (new) | Phrases shown highlighted in the feedback screen (the Week 1 "warning signs highlighted inside the message") |
| `source_urls` + `source_labels` (new) | URLs plus matching names, so the feedback screen can show readable links |
| Option `id` (new) | `a`, `b`, `c`. The correct option is stored first in the file; the app shuffles on screen |

## Differences from the Week 1 and Week 2 packs to confirm with Erika
1. **Scam / real count.** The Week 3 doc's scope line says "13 scams and 7 real", but its own items have 6 real messages (S04, S09, S13, S14, S19, S20) and 14 scams. The app follows the items.
2. **S07 wording.** The text said the camera "on the oil rig" was broken, but M1 is a sailboat photo. Changed to "on the boat". Revert in `scenarios.json` if you prefer.
3. **AI label on S08 and S10.** Week 2 marks the label "No" for the voicemails. They use synthetic voices, and the proposal promises all AI-made examples are clearly labelled, so all four clips show "Made with AI for training".
4. **Audio length labels.** The "0:20 / 0:25" in the sender lines was removed. The Play button shows the real length.
5. **Glossary "learn more" buttons.** Week 2 lists test items (S11-S18) under some terms. Test items must never appear in practice, so the buttons only offer practice items.
6. **Glossary sources.** Week 2 asks to recheck the Money.ca and TELUS figures (nearly $3 million; 27%) against the CAFC. Still open.
7. **WCAG.** The proposal says WCAG 2.1 AA and 18px text; Week 1 says WCAG 2.2 AA and 22px. The app uses 22px and is checked against 2.2 AA.
8. **Reading level.** The Grade 6-8 readability check on explanations is still open (see above).

## Tactics that are test-only
T3 (government refund) and T7 (famous face ad) only appear as test items (S13, S14, S17, S18), so they are not in practice rounds. Their guide cards in "My progress" still teach the signs.
