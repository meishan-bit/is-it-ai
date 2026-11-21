# Changelog

All notable changes to **Is It AI?**. The app version (package.json) and the content version (content/meta.json) are tracked separately.
Format: [app x.y.z] for code, [content x.y.z] for scenarios, glossary and tactic guides.

## [app 2.1.1] - 2026-11-21
- Check It photos: each picture is read twice and the words joined, so white text on a coloured bubble in dark mode (a blue reply bubble was skipped in the Nov 21 phone test) and dark text on a pale bubble are both read. Name finder: names whose surname is also a word (Susan Park) are hidden; Bill, Mark, Chase, May and business names (Chase Bank, Canada Post) are not treated as names.

## [app 2.1.0] - 2026-11-21
- Check It: PR #1 port. A name finder (compromise, about 150 KB, on the phone) now runs on photos and pasted text, so names with no cue word are hidden. PR #1's rules added: wrapped link codes, Alberta health numbers, 3+3 and verification codes, card expiry right after a card, health-card labels. PR #1's tests and licences added. image-pii-redactor and its 279 MB model are not used.

## [content 2.2.1] - 2026-11-21
- Check It choose screen: heading "What did you get?" is now "What do you want to check?" (content/check.json 1.0.1). Read-aloud text uses the same string. Scenarios, glossary, tactics and test forms unchanged.

## [app 2.0.0] - 2026-11-21
- Check It: check a message you got, from a photo or screenshot, a pasted message, or answers about a phone call. Personal details are hidden on the phone and reviewed with tap-to-hide chips before anything is sent. The result counts warning signs, never says safe, and always ends with a vetted next step, Report it and Talk to a person (sample number (613) 555-0142).
- Check It is last on Home under "Got a message right now?" and has one link on the practice Finished screen. It is hidden during test sessions; /check shows a locked screen instead.
- /api/check (Claude, structured outputs; the server writes the safe step from tactics.json), rate limits (10 per person and 300 overall per day), check_events table (counts and outcomes only), Check It results page in the admin.
- Nine Canadian redaction rules (ID numbers, postal codes, health cards, phone numbers, cards, codes and PINs, email names, link codes, birth dates), plus helpers for names and addresses, with unit tests.
- Version management: app 2.0.0. Existing screens, content, test forms and data are unchanged.

## [content 2.2.0] - 2026-11-21
- content/check.json added: Check It copy, errors, six call questions, learn links, the sample phone number. Scenarios, glossary and tactics unchanged.

## [app 1.1.1] - 2026-11-20
- My progress: the CAFC phone number is replaced with the sample number (613) 555-0142, labelled as standing in for the Canadian Anti-Fraud Centre in real use.

## [content 2.1.0] - 2026-11-20
- S05 explanation: the CAFC phone number is replaced with the sample number (613) 555-0142 (NANPA fictional range), so no real line is dialled during testing. Practice item only; test forms unchanged.

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
