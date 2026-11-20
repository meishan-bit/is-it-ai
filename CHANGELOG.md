# Changelog

All notable changes to **Is It AI?**. The app version (package.json) and the content version (content/meta.json) are tracked separately.
Format: [app x.y.z] for code, [content x.y.z] for scenarios, glossary and tactic guides.

## [content 2.0.0] - 2026-11-20
- Week 3 content pack. Answer options rewritten for all 20 items: the correct answer is now the longest option in 5 of 20 sign questions (was 19) and 7 of 20 safe-step questions (was 18), and only by 1-5 characters.
- Pair P2 replaced: S13 is a real power bill reminder (Northshore Power) and S14 a real phone bill reminder (Lakeshore Mobile). Each test form is now 3 scams + 2 real; 14 scams + 6 real overall. The old S13-S14 CRA refund and benefit scams (T3) are reserve items, not in the app.
- S06: "license" corrected to "licence". Glossary: Phishing links to S03 and S06 only.
- Major version because the test forms changed. No test sessions have run yet.

## [app 1.1.0] - 2026-11-20
- Admin dashboard reports scams caught and real messages trusted separately, before and after, alongside the 10-point total.
- My progress: scam types that are in no example (T3 for now) say so instead of pointing to the research check.

## [content 1.1.0] - 2026-11-20
- New voice clips M2-M5 for S08, S10, S11 and S12 (V1 recordings). Converted to mono 64 kbps and levelled to about -16 LUFS so all four play at a similar volume (they ranged from -21 to -17.5). Total size 520 KB, was 1.6 MB as supplied.
- S11 and S12 are test items. No test sessions have run yet, so earlier results are not affected.

## [app 1.0.0] - 2026-11-14
- First full build: practice rounds (5 examples, 3 questions each), Learn glossary (8 terms), test mode with Form A/B counterbalancing and debrief, "My progress" dashboard, admin dashboard, anonymous tracking to Supabase with offline fallback, read-aloud on every screen.
- Version management: version footer, /api/version, versions saved with every attempt, release script, CI checks.

## [content 1.0.0] - 2026-11-14
- S01-S20 (10 practice, 5 pre / 5 post matched pairs, 16 scams + 4 genuine), 8 glossary terms, 10 tactic guides, from the Week 1 and Week 2 content packs.
- S07: "camera on the oil rig" changed to "camera on the boat" to match the sailboat photo (M1).
- Voice clips M2-M5 produced with a fully synthetic neural voice; all four are labelled "Made with AI for training".
