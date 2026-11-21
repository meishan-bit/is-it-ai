#!/usr/bin/env node
// Checks Check It copy and settings against the Build Brief rules. Runs with the content checks on every build and in CI.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const check = read('content/check.json');
const tactics = read('content/tactics.json').tactics;
const glossary = read('content/glossary.json').terms;

const errors = [];
const err = (m) => errors.push(m);
const words = (t) => t.trim().split(/\s+/).filter(Boolean);

// ---- every phone number is the sample number, in the fictional 555-01xx range
const PHONE = /(?:\+?1[\s-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-](\d{4})/g;
const flat = JSON.stringify(check);
for (const m of flat.matchAll(PHONE)) {
  if (!(m[2] === '555' && /^01\d\d$/.test(m[3]))) err(`check.json: phone number "${m[0]}" must use 555-01xx`);
}
if (check.sample_number.display !== '(613) 555-0142') err('check.json: sample_number.display must be (613) 555-0142 (decided Nov 20)');
if (check.sample_number.tel !== 'tel:+16135550142') err('check.json: sample_number.tel must be tel:+16135550142');
if (/https?:\/\//i.test(flat)) err('check.json: no links in Check It copy');

// ---- the verdict text never says safe, real or OK (the "In real use" phone-number note is not verdict text)
const BANNED = /\b(safe|safely|real|really|ok|okay)\b/i;
const verdictStrings = [
  ...Object.values(check.levels).flatMap((l) => Object.values(l)),
  check.general_step.text,
  check.still_personal,
];
for (const s of verdictStrings) if (BANNED.test(s)) err(`Result wording must not say safe, real or OK: "${s}"`);
// The team's vetted next steps (tactics.json) are shown on results too. They are not edited here, so a hit is a warning for the team.
for (const t of tactics) {
  for (const s of [t.safe_step, ...t.red_flags]) {
    if (BANNED.test(s)) console.warn(`  warning: tactics.json ${t.id} says "${s.match(BANNED)[0]}" and is shown on a Check It result: "${s}"`);
  }
}

// ---- levels
for (const k of ['strong', 'some', 'none_found']) if (!check.levels[k]?.heading) err(`levels.${k} needs a heading`);
if (!check.levels.strong.body_known.includes('{tactic}')) err('levels.strong.body_known needs {tactic}');

// ---- learn links point at real glossary words, and every scam tactic has one
const slugs = new Set(glossary.map((g) => g.slug));
for (const t of tactics.filter((t) => /^T\d+$/.test(t.id))) {
  const slug = check.learn[t.id];
  if (!slug) err(`learn: no glossary word for ${t.id}`);
  else if (!slugs.has(slug)) err(`learn.${t.id}: glossary word "${slug}" does not exist`);
}

// ---- call questions
const KEYS = ['family_trouble', 'official_caller', 'asked_payment', 'secret_or_stay', 'remote_access', 'money_back'];
const qk = check.call_questions.map((q) => q.key);
if (JSON.stringify(qk) !== JSON.stringify(KEYS)) err(`call_questions keys must be exactly ${KEYS.join(', ')}`);
const tacticIds = new Set(tactics.map((t) => t.id));
for (const q of check.call_questions) {
  if (!q.text.endsWith('?')) err(`call question ${q.key} should be a question`);
  if (words(q.text).length > 20) err(`call question ${q.key} is too long for one screen`);
  for (const id of q.points_to) if (!tacticIds.has(id)) err(`call question ${q.key} points to unknown tactic ${id}`);
}

// ---- errors: the four cases from the brief, each kind and each with a way out
for (const k of ['unreadable', 'offline', 'too_many', 'wrong']) {
  const e = check.errors[k];
  if (!e?.body || !e?.primary) err(`errors.${k} needs body and primary button`);
  if (e && /\b(you|your)\b.*\b(wrong|fault|mistake)\b/i.test(e.body)) err(`errors.${k} must never blame the person`);
}

// ---- the unvetted general step is flagged until the team signs it off
if (check.general_step.vetted === false) console.log('Note: the general safe step in check.json is still waiting for the team to vet it.');
if (check.talk.hours_to_confirm) console.log('Note: confirm the CAFC phone hours before any real release (listings differ).');

if (errors.length) {
  console.error(`\n${errors.length} Check It content problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('Check It content OK');
