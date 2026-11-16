#!/usr/bin/env node
// Checks the content files against the team's writing rules (Week 1 and Week 2 content packs).
// Runs automatically before every build (npm run build) and in CI, so a content mistake cannot ship.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const scenarios = read('content/scenarios.json').scenarios;
const glossary = read('content/glossary.json').terms;
const tactics = read('content/tactics.json').tactics;
const meta = read('content/meta.json');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const words = (t) => t.trim().split(/\s+/).filter(Boolean);

// ---- version
if (!/^\d+\.\d+\.\d+$/.test(meta.content_version)) err(`meta.json: content_version "${meta.content_version}" is not x.y.z`);
if (meta.history?.[0]?.version !== meta.content_version) err('meta.json: first history entry must match content_version');

// ---- overall scope (Week 1: 20 scenarios, 10 practice + 10 test in 5 pairs, 15 scams + 5 real)
const ids = scenarios.map((s) => s.id);
if (new Set(ids).size !== ids.length) err('Duplicate scenario ids');
if (scenarios.length !== 20) err(`Expected 20 scenarios, found ${scenarios.length}`);
const count = (f) => scenarios.filter(f).length;
if (count((s) => s.use === 'practice') !== 10) err('Expected 10 practice scenarios');
if (count((s) => s.use === 'pre') !== 5) err('Expected 5 pre-test (Form A) scenarios');
if (count((s) => s.use === 'post') !== 5) err('Expected 5 post-test (Form B) scenarios');
// NOTE: the Week 1 text says "15 scams + 5 genuine", but its own scenario table (and Week 2) has 16 scams + 4 genuine (S04, S09, S19, S20).
if (count((s) => s.verdict === 'scam') !== 16 || count((s) => s.verdict === 'real') !== 4) err('Expected 16 scam + 4 real scenarios (see content/README note)');

const PHONE = /(?:\+?1[\s-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-](\d{4})/g;
const ALLOWED_REAL_NUMBERS = new Set(['8884958501']); // real CAFC number quoted in S05

for (const s of scenarios) {
  const p = `${s.id}`;
  // use / form / pair consistency
  if (s.use === 'practice') {
    if (s.form !== null || s.pair_id !== null) err(`${p}: practice items must have form=null and pair_id=null`);
  } else {
    if (!s.pair_id) err(`${p}: test item needs a pair_id`);
    if (s.use === 'pre' && s.form !== 'A') err(`${p}: pre items are Form A`);
    if (s.use === 'post' && s.form !== 'B') err(`${p}: post items are Form B`);
    const twin = scenarios.find((o) => o.pair_id === s.pair_id && o.id !== s.id);
    if (!twin) err(`${p}: pair ${s.pair_id} has no twin`);
    else {
      if (twin.tactic !== s.tactic) err(`${p}: twin ${twin.id} has a different tactic`);
      if (twin.verdict !== s.verdict) err(`${p}: twin ${twin.id} has a different verdict`);
      if (twin.format !== s.format) err(`${p}: twin ${twin.id} has a different format`);
    }
  }
  if (!tactics.find((t) => t.id === s.tactic)) err(`${p}: tactic "${s.tactic}" is not in tactics.json`);
  if (s.verdict === 'real' && s.tactic !== 'real') err(`${p}: real messages use tactic "real"`);

  // explanation length (60 words or fewer) and approximate reading level
  if (words(s.explanation).length > 60) err(`${p}: explanation is ${words(s.explanation).length} words (max 60)`);
  if (!s.explanation.startsWith(s.verdict === 'scam' ? 'This is a scam.' : 'This one is likely real.'))
    warn(`${p}: explanation should start with the verdict sentence`);

  // questions
  for (const qn of ['sign_question', 'step_question']) {
    const q = s[qn];
    if (!q?.prompt) err(`${p}: ${qn} needs a prompt`);
    if (q?.options?.length !== 3) err(`${p}: ${qn} needs exactly 3 options`);
    if (q?.options?.filter((o) => o.correct).length !== 1) err(`${p}: ${qn} needs exactly 1 correct option`);
    if (new Set(q?.options?.map((o) => o.id)).size !== 3) err(`${p}: ${qn} option ids must be unique`);
    for (const o of q?.options ?? []) if (!/^[a-z]$/.test(o.id)) err(`${p}: option id "${o.id}" must be a single lowercase letter`);
  }

  // text rules: invented numbers (555-01xx), no clickable links, no overly long bubbles
  const spoken = [...s.message, s.transcript ?? '', s.alt_text ?? '', s.caption ?? '', s.sender_label];
  for (const t of spoken) {
    for (const m of t.matchAll(PHONE)) {
      const digits = `${m[1]}${m[2]}${m[3]}`;
      if (ALLOWED_REAL_NUMBERS.has(digits)) continue;
      if (!(m[2] === '555' && /^01\d\d$/.test(m[3]))) err(`${p}: phone number "${m[0]}" must use 555-01xx`);
    }
    if (/https?:\/\//i.test(t)) err(`${p}: scenario text must not contain clickable links ("${t.slice(0, 40)}...")`);
  }

  // format <-> media consistency
  if (s.format === 'text') {
    if (s.media_id || s.message.length === 0) err(`${p}: text items need messages and no media`);
  } else if (s.format === 'text_image') {
    if (s.media_kind !== 'image' || s.message.length === 0) err(`${p}: text_image needs messages and an image`);
  } else if (s.format === 'image') {
    if (s.media_kind !== 'image') err(`${p}: image items need an image`);
  } else if (s.format === 'audio') {
    if (s.media_kind !== 'audio') err(`${p}: audio items need an audio clip`);
  } else err(`${p}: unknown format ${s.format}`);

  if (s.media_id) {
    const file = join(root, 'public', s.media_url?.replace(/^\//, '') ?? '');
    if (!s.media_url || !existsSync(file)) err(`${p}: media file missing (${s.media_url})`);
    if (s.media_kind === 'image' && !s.alt_text) err(`${p}: image needs alt_text`);
    if (s.media_kind === 'audio' && !s.transcript) err(`${p}: audio needs a transcript`);
    if (s.media_id !== s.media_id.toUpperCase() || !/^M\d$/.test(s.media_id)) err(`${p}: media_id format`);
  }
  // Everything made with AI must carry the label (proposal: all examples clearly labelled)
  if (['M1', 'M2', 'M3', 'M4', 'M5', 'M8', 'M9'].includes(s.media_id ?? '') && !s.ai_generated)
    err(`${p}: ${s.media_id} is AI-made and must set ai_generated=true`);

  // highlights must really appear in the shown text
  const hayAll = [...s.message, s.transcript ?? ''].join('\n');
  for (const h of s.highlights ?? []) if (!hayAll.includes(h)) err(`${p}: highlight "${h}" not found in message or transcript`);
  if (s.source_labels.length !== s.source_urls.length) err(`${p}: source_labels and source_urls differ in length`);
  if (s.verdict === 'scam' && s.source_urls.length === 0) err(`${p}: scam items need at least one source`);
}

// ---- glossary
if (glossary.length < 6 || glossary.length > 8) err(`Glossary should have 6-8 terms, found ${glossary.length}`);
for (const g of glossary) {
  if (!g.definition || !g.example || !g.what_to_do) err(`Glossary "${g.term}": needs definition, example and what_to_do`);
  if (words(g.what_to_do).length > 30) err(`Glossary "${g.term}": what_to_do is ${words(g.what_to_do).length} words (max 30)`);
  const usable = g.practice_items.includes('ALL') || g.practice_items.some((id) => scenarios.find((s) => s.id === id)?.use === 'practice');
  if (!usable) err(`Glossary "${g.term}": needs at least one practice item for the "practise this" button`);
  for (const id of g.practice_items) if (id !== 'ALL' && !ids.includes(id)) err(`Glossary "${g.term}": unknown scenario ${id}`);
  for (const src of g.example_sources) if (!/^https:\/\//.test(src.url)) err(`Glossary "${g.term}": source needs an https URL`);
}
if (new Set(glossary.map((g) => g.slug)).size !== glossary.length) err('Glossary slugs must be unique');

// ---- approximate reading level (Flesch-Kincaid) for the "Grade 6-8" check that is still open in Week 2
function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return w ? 1 : 0;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}
function fkGrade(text) {
  const sentences = text.split(/[.!?]+/).filter((x) => x.trim()).length || 1;
  const ws = words(text).filter((w) => /[a-z]/i.test(w));
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  return 0.39 * (ws.length / sentences) + 11.8 * (syl / ws.length) - 15.59;
}
const grades = scenarios.map((s) => ({ id: s.id, g: fkGrade(s.explanation) }));
const avg = grades.reduce((a, x) => a + x.g, 0) / grades.length;
const tooHigh = grades.filter((x) => x.g > 8.5).map((x) => `${x.id} (${x.g.toFixed(1)})`);

// ---- report
console.log(`Content ${meta.content_version}: ${scenarios.length} scenarios, ${glossary.length} glossary terms, ${tactics.length} tactic guides`);
console.log(`Readability (approximate Flesch-Kincaid) of explanations: average grade ${avg.toFixed(1)}`);
if (tooHigh.length) console.log(`  Above grade 8.5, worth a look: ${tooHigh.join(', ')}`);
for (const w of warnings) console.warn(`  warning: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} content problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('Content OK');
