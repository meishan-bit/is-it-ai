# Is It AI?

A senior-friendly, mobile-first web app that helps adults 60+ recognize and respond safely to AI-enabled scams.
DTO 5839, Group 6. Built from the project proposal and the Week 1 and Week 2 content packs.

**What it does**
- **Practise:** rounds of 5 examples. Each example asks three things: real or scam, the warning sign, the safe next step. Plain-language feedback after each one.
- **Learn the words:** 8 glossary terms with a real Canadian example and a "what to do" step.
- **My progress** (learner dashboard): rounds finished, how well scams were handled, five simple rules, and a guide card for each of the 10 scam types.
- **Test session** (research): a tester code (T1-T5) sets the order of Form A and Form B. Before check, practice, final check, then a debrief. No feedback during the checks.
- **Admin dashboard** (`/admin`, passcode): completion, average improvement against the 20-point goal, per-tester change, accuracy by scam type and example, and whether the Form A/B twins are equally hard. CSV export.
- 20 scenarios, 4 with AI-generated voice (M2-M5) and 5 with images (M1, M6-M9). Read-aloud on every screen. Every example is labelled "Training example", and AI-made ones "Made with AI for training".

**Stack (from the proposal):** Next.js (React, TypeScript), Supabase (anonymous answers), Vercel (hosting), browser text-to-speech.
Content lives in `/content` as JSON and Supabase stores only anonymous answers.

---

## 1. Put it on GitHub (about 5 minutes)

This folder is already a git repository with the first commit and tags `v1.0.0` and `content-v1.0.0`.

1. On github.com create a **new empty repository** called `is-it-ai` (no README, no .gitignore). Public is simplest; Vercel's free plan works best with a personal account.
2. In a terminal, inside this folder:
   ```bash
   npm install                       # creates package-lock.json (needed once)
   git add package-lock.json && git commit -m "Add lockfile"
   git remote add origin https://github.com/YOUR-USERNAME/is-it-ai.git
   git push -u origin main --tags
   ```
3. The **CI** workflow (Actions tab) checks content rules, types, tests and the build on every push.
4. The first commit uses a placeholder author. Set your own with `git config user.name` and `git config user.email` for later commits.

## 2. Create the database (Supabase, about 5 minutes)

Optional: without it the app still works and answers stay on each person's device, but the admin dashboard shows sample data only.

1. supabase.com > **New project**.
2. **SQL Editor** > **New query** > paste `supabase/schema.sql` > **Run**. This creates three tables (`participants`, `attempts`, `responses`) and locks them so the public key can read and write nothing.
3. **Project Settings > API**: copy the **Project URL** and the **service_role** key. The service-role key is a secret: only ever put it in Vercel's environment variables, never in code or GitHub.

## 3. Deploy (Vercel, about 5 minutes)

1. vercel.com > **Add New > Project** > import the GitHub repo. It detects Next.js, so keep the defaults.
2. Under **Environment Variables** add:

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
   | `ADMIN_PASSCODE` | a long passphrase of your choosing |

3. **Deploy.** You get a link like `https://is-it-ai.vercel.app`. Share it as the app link. The admin dashboard is at `/admin`.
4. Every push to `main` redeploys automatically; every pull request gets its own preview link.

Quick check after deploying: open `/api/version` (should show the versions), do one practice round, then sign in at `/admin` and see the "Live data" banner.

## 4. Run it on your own computer

```bash
npm install
cp .env.example .env.local     # optional: fill in Supabase / admin values
npm run dev                    # http://localhost:3000
npm run ci                     # content rules + types + tests + build
```
Needs Node 22 or newer.

---

## Version management

| What | Where | How to change |
|------|-------|---------------|
| App version | `package.json` | `npm run release -- patch "what changed"` (or `minor`, `major`) |
| Content version | `content/meta.json` | `npm run release -- content-patch "what changed"` (or `content-minor`, `content-major`) |
| History | `CHANGELOG.md` | Updated by the same command |

- The footer on every screen shows `v1.0.0 · content 1.0.0 · <git commit>`. `/api/version` returns the same as JSON.
- **Every attempt saved to the database records the app version and content version it was shown**, so results always trace to the exact build and wording.
- After a release command: `git add -A && git commit -m "..." && git tag vX.Y.Z && git push && git push --tags`. Pushing a tag creates a GitHub Release (see `.github/workflows/release.yml`).
- Use app versions for code and content versions for wording. A `content-major` bump means the test forms changed (earlier pre/post results are no longer comparable).
- Defensive workflow from the proposal: small changes, one feature at a time, commit working versions, use pull requests (there is a checklist template).

## Repository map

```
content/        scenarios, glossary, tactics, version (edit without touching code)  -> docs/CONTENT_GUIDE.md
public/media/   the 5 images and 4 audio clips                                      -> public/media/README.md
src/app/        pages: / /practice /learn /progress /test /admin /about + API routes
src/components/ screens (ItemRunner is the 3-question flow shared by practice and test)
src/lib/        pure logic (forms, scoring, analytics, validation) and server helpers
supabase/       schema.sql
scripts/        validate-content.mjs, release.mjs, audio/ (how the voice clips were made)
tests/          unit tests (node --test)
analysis/       analyze_results.py: pre/post analysis of the admin CSV (pandas, for Erika)
docs/           AUDIO_KIT.md, CONTENT_GUIDE.md, ACCESSIBILITY_CHECKLIST.md
```

## Running a test session (for Tiffany)

1. Give each tester a code from your session sheet: **T1 to T5**. Odd codes take Form A first, even codes Form B first. Keep the code-to-person list on paper, never in the app.
2. On the phone, open the app link > "Start your test here" > type the code (an age group is optional) > Start.
3. Part 1 (5 examples, no feedback) > "Start practising" (rounds as long as you like) > "I am ready for the final check" (5 examples) > debrief with explanations.
4. If a tester stops, reopening the app and tapping "Continue test session" resumes where they left off. "End this test session" on the debrief clears the phone for the next person.
5. Results appear in `/admin`. **Download responses (CSV)** feeds `analysis/analyze_results.py`.

Scoring (Week 1): 1 point for real-or-scam plus 1 for the safe step, per example, so 10 points per form. The warning-sign answer is recorded but not scored. In test mode the second question uses a neutral prompt ("What is the most important clue?") so its wording cannot give away the answer to question 1.

## Privacy and safety
- No names, emails or phone numbers are asked for or stored. Answers are saved under a random id, or the session code (T1...).
- Supabase tables have Row Level Security on with no public policies. Only the server, holding the service-role key, can read or write.
- The server recalculates whether each answer was right from the content file, so a tampered browser cannot write fake scores.
- `/admin` is closed unless `ADMIN_PASSCODE` is set; the session cookie is signed, HttpOnly and expires after 8 hours.
- Fully synthetic voices and invented people. M8 and M9 are fictional and do not resemble real people.

## Known limits
- **Not built with `next build` in the environment where this was written** (the package registry was not reachable). The logic was unit-tested, the whole `src` tree was type-checked against stubs, and every screen and API route was run in a real browser (Chromium) through a test harness with a mock Supabase. The first real `npm run ci` / Vercel build is the first time the project meets the actual Next.js compiler: if it reports an error, it will be small and local. The CI workflow will show it.
- The Supabase calls follow the PostgREST rules but were tested against a mock, not a live Supabase project. The Vercel deploy check above covers it.
- `/api/track` is public (it must be, for testers) and has no rate limiting. For a larger rollout turn on Vercel's firewall / rate limiting.
- The browser voice used by "Listen" differs by phone. Check it on the testers' devices.
- The Google Fonts request for Atkinson Hyperlegible Next means a third-party call; self-host the font if that matters.
- The admin page reads the whole database on each load. That is fine for a class project, not for thousands of testers.
