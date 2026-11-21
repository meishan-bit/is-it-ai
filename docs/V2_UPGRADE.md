# Upgrading v1.1 to v2.0

v2.0 adds Check It. Nothing in v1.1 is replaced: the 20 scenarios, glossary, tactics, test forms, audio, admin dashboard and data are untouched. Ten existing files get a few lines added by a script that checks before it edits.

1. Unzip `is-it-ai-v2.0-overlay.zip` **over** your `is-it-ai` folder (the one with `package.json`). Say yes to adding files. It only adds new files.
2. Open a terminal in that folder and run: `node scripts/apply-v2-patches.mjs`
   It lists each file it changed. If it says it could not find a place, it leaves that file as it was; send the message to whoever is helping you.
3. `npm install` (adds Tesseract.js and creates the new lockfile), then `npm run ci`.
4. Look at `git diff` before committing: you should see small additions only.
5. `git add -A`, `git commit -m "app 2.0.0: Check It"`, `git tag v2.0.0 content-v2.2.0`, `git push --follow-tags`
6. Set up Check It: `docs/CHECK_IT.md`, "One-time set-up" (SQL, API key, Vercel).
7. `node scripts/check-smoke.mjs https://YOUR-APP.vercel.app`, then try the three paths on a phone.

**Files changed by the script:** `HomeScreen.tsx` (+2 lines), `PracticeFlow.tsx` (+2), `AdminDashboard.tsx` (+1), `about/page.tsx` (+1), `package.json` (version, one script, one dependency), `content/meta.json` (content 2.2.0), `CHANGELOG.md`, `supabase/schema.sql` (check_events), `.env.example`, `README.md`.
**Versions:** app 1.1.1 to **2.0.0**; content 2.1.0 to **2.2.0** (new `content/check.json` only; test forms unchanged, so earlier results stay comparable).
