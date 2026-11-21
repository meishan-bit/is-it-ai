#!/usr/bin/env node
// Applies the v2.0 edits to existing v1.1 files, so nothing in them is replaced or lost.
// Every edit finds its place by a short, unique line, checks it before changing anything, and is safe to run twice.
// Run once from the project folder after copying the v2.0 files in:   node scripts/apply-v2-patches.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const results = [];
const problems = [];

function load(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    problems.push(`${rel}: file not found`);
    return null;
  }
  const raw = readFileSync(p, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { p, rel, eol, lines: raw.split(/\r?\n/), endsWithNewline: /\r?\n$/.test(raw) };
}
function save(f) {
  const text = f.lines.join(f.eol);
  writeFileSync(f.p, text);
}
function indentOf(line) {
  return line.match(/^\s*/)[0];
}
function findOne(f, test, what) {
  const hits = f.lines.map((l, i) => (test(l) ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) {
    problems.push(`${f.rel}: expected exactly one line for "${what}", found ${hits.length}. Nothing was changed in this file.`);
    return -1;
  }
  return hits[0];
}
const done = (rel, msg) => results.push(`  changed  ${rel}: ${msg}`);
const skip = (rel, msg) => results.push(`  already  ${rel}: ${msg}`);

// ---------------------------------------------------------------- src/components/HomeScreen.tsx
{
  const f = load('src/components/HomeScreen.tsx');
  if (f) {
    if (f.lines.some((l) => l.includes('CheckEntry'))) skip(f.rel, 'Check It entry already there');
    else {
      const imp = findOne(f, (l) => l.trim() === "import ThemeSwitch from './ThemeSwitch';", 'ThemeSwitch import');
      const anchor = findOne(f, (l) => l.trim() === '{ready && !session && (', 'research-session note');
      if (imp >= 0 && anchor >= 0) {
        f.lines.splice(anchor, 0, `${indentOf(f.lines[anchor])}<CheckEntry variant="home" />`);
        f.lines.splice(imp + 1, 0, "import CheckEntry from './check/CheckEntry';");
        save(f);
        done(f.rel, 'Check It added last on Home, under its own heading');
      }
    }
  }
}

// ---------------------------------------------------------------- src/components/PracticeFlow.tsx
{
  const f = load('src/components/PracticeFlow.tsx');
  if (f) {
    if (f.lines.some((l) => l.includes('CheckEntry'))) skip(f.rel, 'Check It link already there');
    else {
      const imp = findOne(f, (l) => l.trim() === "import ScreenHeader from './ScreenHeader';", 'ScreenHeader import');
      const link = findOne(f, (l) => l.includes('See my progress</Link>'), 'See my progress link');
      if (imp >= 0 && link >= 0) {
        let close = -1;
        for (let i = link + 1; i < f.lines.length; i++) if (f.lines[i].trim() === '</div>') { close = i; break; }
        if (close < 0) problems.push(`${f.rel}: could not find the end of the button row. Nothing was changed in this file.`);
        else {
          f.lines.splice(close + 1, 0, `${indentOf(f.lines[close])}<CheckEntry variant="finished" />`);
          f.lines.splice(imp + 1, 0, "import CheckEntry from './check/CheckEntry';");
          save(f);
          done(f.rel, 'Check It link added to the practice Finished screen');
        }
      }
    }
  }
}

// ---------------------------------------------------------------- src/app/about/page.tsx
{
  const f = load('src/app/about/page.tsx');
  if (f) {
    if (f.lines.some((l) => l.includes('Check a message'))) skip(f.rel, 'Check It privacy note already there');
    else {
      const a = findOne(f, (l) => l.includes('Research sessions are run with your consent.'), 'consent line');
      if (a >= 0) {
        const ind = indentOf(f.lines[a]);
        f.lines.splice(a, 0,
          `${ind}<li>If you use Check a message I got, personal details are hidden on your phone first. A copy of your message with those details hidden is then sent to Anthropic's Claude to be checked. It is not stored by us, and the pictures, text and answers are never kept. We only count that a check happened.</li>`);
        save(f);
        done(f.rel, 'privacy note for Check It');
      }
    }
  }
}

// ---------------------------------------------------------------- src/components/AdminDashboard.tsx
{
  const f = load('src/components/AdminDashboard.tsx');
  if (f) {
    if (f.lines.some((l) => l.includes('/admin/check'))) skip(f.rel, 'Check It results link already there');
    else {
      const a = findOne(f, (l) => l.includes('onClick={logout}>Sign out</button>'), 'Sign out button');
      if (a >= 0) {
        f.lines.splice(a, 0, `${indentOf(f.lines[a])}<Link className="btn btn-secondary" href="/admin/check">Check It results</Link>`);
        save(f);
        done(f.rel, 'Check It results link in the admin header');
      }
    }
  }
}

// ---------------------------------------------------------------- package.json
{
  const p = join(root, 'package.json');
  if (!existsSync(p)) problems.push('package.json: file not found');
  else {
    const raw = readFileSync(p, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const pkg = JSON.parse(raw);
    let changed = false;
    if (pkg.version !== '2.0.0') { pkg.version = '2.0.0'; changed = true; }
    if (!pkg.scripts['validate:content'].includes('validate-check')) {
      pkg.scripts['validate:content'] = 'node scripts/validate-content.mjs && node scripts/validate-check.mjs';
      changed = true;
    }
    if (pkg.scripts.prebuild !== 'npm run validate:content') { pkg.scripts.prebuild = 'npm run validate:content'; changed = true; }
    if (!pkg.dependencies['tesseract.js']) { pkg.dependencies['tesseract.js'] = '^5.1.1'; changed = true; }
    if (changed) {
      writeFileSync(p, JSON.stringify(pkg, null, 2).replace(/\n/g, eol) + eol);
      done('package.json', 'version 2.0.0, content checks include Check It, tesseract.js added');
    } else skip('package.json', 'already updated');
  }
}

// ---------------------------------------------------------------- content/meta.json
{
  const p = join(root, 'content/meta.json');
  if (!existsSync(p)) problems.push('content/meta.json: file not found');
  else {
    const raw = readFileSync(p, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const meta = JSON.parse(raw);
    if (meta.history.some((h) => h.version === '2.2.0')) skip('content/meta.json', 'already 2.2.0');
    else {
      meta.content_version = '2.2.0';
      meta.updated = TODAY;
      meta.history.unshift({
        version: '2.2.0',
        date: TODAY,
        summary: 'Check It copy and settings added (content/check.json): screens, errors, call questions, learn links. Scenarios, glossary and tactics are unchanged; test forms unchanged.',
      });
      writeFileSync(p, JSON.stringify(meta, null, 2).replace(/\n/g, eol) + eol);
      done('content/meta.json', 'content version 2.2.0');
    }
  }
}

// ---------------------------------------------------------------- CHANGELOG.md
{
  const f = load('CHANGELOG.md');
  if (f) {
    if (f.lines.some((l) => l.startsWith('## [app 2.0.0]'))) skip(f.rel, 'already has 2.0.0');
    else {
      const first = f.lines.findIndex((l) => l.startsWith('## ['));
      const entry = [
        `## [app 2.0.0] - ${TODAY}`,
        '- Check It: check a message you got, from a photo or screenshot, a pasted message, or answers about a phone call. Personal details are hidden on the phone and reviewed with tap-to-hide chips before anything is sent. The result counts warning signs, never says safe, and always ends with a vetted next step, Report it and Talk to a person (sample number (613) 555-0142).',
        '- Check It is last on Home under "Got a message right now?" and has one link on the practice Finished screen. It is hidden during test sessions; /check shows a locked screen instead.',
        '- /api/check (Claude, structured outputs; the server writes the safe step from tactics.json), rate limits (10 per person and 300 overall per day), check_events table (counts and outcomes only), Check It results page in the admin.',
        '- Nine Canadian redaction rules (ID numbers, postal codes, health cards, phone numbers, cards, codes and PINs, email names, link codes, birth dates), plus helpers for names and addresses, with unit tests.',
        '- Version management: app 2.0.0. Existing screens, content, test forms and data are unchanged.',
        '',
        `## [content 2.2.0] - ${TODAY}`,
        '- content/check.json added: Check It copy, errors, six call questions, learn links, the sample phone number. Scenarios, glossary and tactics unchanged.',
        '',
      ];
      f.lines.splice(first < 0 ? f.lines.length : first, 0, ...entry);
      save(f);
      done(f.rel, 'app 2.0.0 and content 2.2.0 entries');
    }
  }
}

// ---------------------------------------------------------------- supabase/schema.sql
{
  const f = load('supabase/schema.sql');
  if (f) {
    if (f.lines.some((l) => l.includes('check_events'))) skip(f.rel, 'check_events already there');
    else {
      const sql = `
-- Check It (v2.0): one row for every check. Counts and outcomes only, never the message, picture or answers.
-- Run in the Supabase SQL editor before deploying v2.0. Safe to run more than once.
create table if not exists check_events (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  anon_id          text not null references participants(anon_id),
  input_type       text not null check (input_type in ('photo','paste','call')),
  tactic_id        text check (tactic_id in ('T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','real','unknown')),
  signal_level     text check (signal_level in ('strong','some','none_found')),
  outcome          text not null check (outcome in ('ok','timeout','rate_limited','model_error','invalid_output')),
  redaction_counts jsonb not null default '{}'::jsonb,  -- e.g. {"card number":1,"name":2}: counts only
  user_unhid_count integer not null default 0 check (user_unhid_count >= 0),
  user_added_count integer not null default 0 check (user_added_count >= 0),
  still_personal   boolean,
  model            text not null,
  latency_ms       integer check (latency_ms >= 0),
  content_version  text not null
);
create index if not exists check_events_anon_day_idx on check_events (anon_id, created_at);
alter table check_events enable row level security;
grant select, insert on check_events to service_role;
grant usage, select on sequence check_events_id_seq to service_role;
revoke all on check_events from anon, authenticated;
`;
      while (f.lines.length && f.lines[f.lines.length - 1] === '') f.lines.pop();
      f.lines.push(...sql.split('\n'));
      save(f);
      done(f.rel, 'check_events table');
    }
  }
}

// ---------------------------------------------------------------- .env.example
{
  const f = load('.env.example');
  if (f) {
    if (f.lines.some((l) => l.includes('ANTHROPIC_API_KEY'))) skip(f.rel, 'already has the Check It settings');
    else {
      while (f.lines.length && f.lines[f.lines.length - 1] === '') f.lines.pop();
      f.lines.push(
        '',
        '# Check It (v2.0). Needed for /api/check. Without a key, Check It shows "Something went wrong" and the rest of the app is unaffected.',
        '# Add in Vercel for Production only, like the Supabase keys. Never prefix with NEXT_PUBLIC_.',
        'ANTHROPIC_API_KEY=your-anthropic-key',
        '# Optional. Defaults shown.',
        '# CHECK_MODEL=claude-haiku-5-5',
        '# CHECK_MAX_TOKENS=1024',
        '# CHECK_DAILY_LIMIT=10',
        '# CHECK_GLOBAL_LIMIT=300',
        '',
      );
      save(f);
      done(f.rel, 'Check It settings');
    }
  }
}

// ---------------------------------------------------------------- README.md
{
  const f = load('README.md');
  if (f) {
    if (f.lines.some((l) => l.includes('docs/CHECK_IT.md'))) skip(f.rel, 'already links the Check It guide');
    else {
      while (f.lines.length && f.lines[f.lines.length - 1] === '') f.lines.pop();
      f.lines.push(
        '',
        '## Check It (v2.0)',
        '',
        'Check It lets someone check a message they got: a photo or screenshot, a pasted message, or answers about a phone call.',
        'Setup (one database table, one API key), how it works, privacy rules and the sign-off checklist are in `docs/CHECK_IT.md`.',
        'Upgrading from v1.1: `docs/V2_UPGRADE.md`.',
        '',
      );
      save(f);
      done(f.rel, 'Check It section');
    }
  }
}

console.log('\nIs It AI? v2.0 patches\n');
console.log(results.join('\n') || '  (nothing to do)');
if (problems.length) {
  console.error('\nSome edits could not be applied:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nThe files named above were left exactly as they were. Send this message to whoever is helping you and the edit can be done by hand.');
  process.exit(1);
}
console.log('\nDone. Next: npm install   then   npm run ci');
