// PR #1's redaction tests (the five fake samples and the Canadian formats), ported to v2's findCanadianPii(text, extra) API,
// plus tests for the name finder (names.ts). All details are fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findCanadianPii } from '../src/lib/check/ca-patterns';
import { chipsFromText, maskedText } from '../src/lib/check/chips';
import { cleanNameSpans, dropStatusBar, findNames } from '../src/lib/check/names';
import { REDACTION_LABELS } from '../src/lib/check/labels';

// The five test samples from PR #1, as OCR text. "\n" marks a line break in the screenshot.
const SAMPLES = {
  parcel:
    'Hi Margaret Whitfield, your parcel could not be delivered to 142 Willow Crescent, Regina SK S4T 2L9.\n' +
    'An unpaid shipping fee of $1.95 is due. Pay within 24 hours or it will be returned: cpost-parcelfee.example/track\n?id=MW88421',
  bank:
    'MapleTrust Fraud Dept: We blocked a $1,940.00 purchase on your card. To stop it, reply with your full card number and expiry date.\n' +
    '4111 1111 1111 1111 exp 08/28\nThank you Robert. We sent a security code to your phone. Reply with the code. Please keep this confidential.\nThe code is 482913',
  refund:
    'Canada Revenue Agency notice@cra-refund-portal.example To: Gerald Fontaine <g.fontaine58@example.com>\n' +
    'Dear Gerald Fontaine, Our records show you are owed a refund of $486.20 for the 2025 tax year.\n' +
    'Details on file: SIN 046 454 286, date of birth March 14, 1952.\nAccept your Interac e-Transfer by Nov 22 or the refund will be cancelled:\n' +
    'https://cra-refund-portal.example/claim?ref=G\nF0464',
  grandchild:
    "+1 (306) 555-0142\nGrandma it's Tyler. I broke my phone so this is a friend's. I need $3,000 for bail. " +
    "Please call my lawyer Mr. Davies at 306-555-0177. Please don't tell Mom.",
  clinic:
    'Prairie Family Clinic: Hi Dorothy Nguyen, reminder of your appointment with Dr. Patel on Tue Nov 25 at 10:30 am.\n' +
    'Please bring your health card (123 456 789). Questions? Call us at 306-555-0110. Reply C to confirm.',
};

const hidden = (text, extra = []) => findCanadianPii(text, extra).map((s) => text.slice(s.start, s.end));
const labelOf = (text, piece) => findCanadianPii(text).find((s) => text.slice(s.start, s.end) === piece)?.label;
const masked = (text, extra = []) => maskedText(text, chipsFromText(text, findCanadianPii(text, extra)));
const kept = (text, extra = []) => {
  const m = masked(text, extra);
  return (s) => assert.ok(m.includes(s), `expected "${s}" to stay visible in: ${m}`);
};

// ------------------------------------------------------------------ PR #1 samples
test('PR #1 sample 1 parcel: postal code and the wrapped tracking code hidden; amount, deadline and domain kept', () => {
  const h = hidden(SAMPLES.parcel);
  assert.ok(h.includes('S4T 2L9'));
  assert.ok(h.includes('?id=MW88421'), 'the part of the link on the next line is hidden');
  const k = kept(SAMPLES.parcel);
  k('$1.95');
  k('24 hours');
  k('cpost-parcelfee.example');
});

test('PR #1 sample 2 bank: card, expiry and code hidden; amount kept', () => {
  const h = hidden(SAMPLES.bank);
  assert.ok(h.includes('4111 1111 1111 1111'));
  assert.ok(h.includes('08/28'));
  assert.ok(h.includes('482913'));
  kept(SAMPLES.bank)('$1,940.00');
});

test('PR #1 sample 3 refund: SIN, birth date, email names and both parts of the wrapped link code hidden; domains and deadline kept', () => {
  const h = hidden(SAMPLES.refund);
  assert.ok(h.includes('046 454 286'));
  assert.equal(labelOf(SAMPLES.refund, '046 454 286'), 'id number');
  assert.ok(h.includes('March 14, 1952'));
  assert.ok(h.includes('g.fontaine58'));
  assert.ok(h.includes('notice'));
  assert.ok(h.some((t) => t.includes('?ref=G')));
  assert.ok(h.includes('F0464'), 'the part of the link on the next line is hidden');
  const k = kept(SAMPLES.refund);
  k('cra-refund-portal.example');
  k('example.com');
  k('$486.20');
  k('Nov 22');
  k('2025 tax year');
});

test('PR #1 sample 4 grandchild: both phone formats hidden; amount kept', () => {
  const h = hidden(SAMPLES.grandchild);
  assert.ok(h.includes('+1 (306) 555-0142'));
  assert.ok(h.includes('306-555-0177'));
  kept(SAMPLES.grandchild)('$3,000');
});

test('PR #1 sample 5 clinic: 9-digit number after "health card" is labelled a health card number', () => {
  assert.equal(labelOf(SAMPLES.clinic, '123 456 789'), 'health card number');
  assert.ok(hidden(SAMPLES.clinic).includes('306-555-0110'));
  kept(SAMPLES.clinic)('Nov 25 at 10:30');
});

test('PR #1 other Canadian formats', () => {
  assert.deepEqual(hidden('OHIP 1234-567-890-AB'), ['1234-567-890-AB']);
  assert.deepEqual(hidden('RAMQ ABCD 1234 5678'), ['ABCD 1234 5678']);
  assert.deepEqual(hidden('PIN: 4821'), ['4821']);
  assert.deepEqual(hidden('CVV 123'), ['123']);
  assert.deepEqual(hidden('call 1-888-495-8501'), ['1-888-495-8501']);
  assert.deepEqual(hidden('Mail to K1A 0B1 please'), ['K1A 0B1']);
  assert.deepEqual(hidden('PHN 9698658215'), ['9698658215']);
});

test('PR #1 gaps now closed: Alberta 5-4, 3+3 verification codes, expiry right after a card', () => {
  assert.deepEqual(hidden('Alberta health 12345-6789'), ['12345-6789']);
  assert.equal(labelOf('Alberta health 12345-6789', '12345-6789'), 'health card number');
  assert.deepEqual(hidden('Your verification number: 556 677'), ['556 677']);
  assert.deepEqual(hidden('verify with 908172'), ['908172']);
  assert.deepEqual(hidden('4111111111111111 08/28'), ['4111111111111111', '08/28']);
  assert.deepEqual(hidden('Card 4111 1111 1111 1111 08/28 thanks'), ['4111 1111 1111 1111', '08/28']);
});

test('PR #1 no false alarms on scam clues', () => {
  assert.deepEqual(hidden('Pay $2,500.00 by 3 pm or within 24 hours. Order 12 items.'), []);
  assert.deepEqual(hidden('Your code expired. Visit canadapost.example now.'), []);
  assert.deepEqual(hidden('Buy 4 gift cards worth $500 each'), []);
  assert.deepEqual(hidden('Born to win. Tax year 2025.'), []);
  assert.deepEqual(hidden('Enter code $5000 now'), [], 'a dollar amount after "code" is not a code');
  assert.deepEqual(hidden('Visit canadapost.example\nThank you'), [], 'an ordinary word on the next line is not a link code');
  assert.deepEqual(hidden('Pay by 08/28 at noon'), [], 'a date with no card nearby stays visible');
});

test('every label the new rules produce is on the allowed list', () => {
  const all = Object.values(SAMPLES).join('\n') + '\nAlberta health 12345-6789 verification number: 556 677 4111111111111111 08/28';
  for (const s of findCanadianPii(all)) assert.ok(REDACTION_LABELS.includes(s.label), s.label);
});

// ------------------------------------------------------------------ name finder (compromise)
test('name finder: finds names that have no cue word', async () => {
  const t = 'Thank you Robert. Barbara, this is Kevin from support. Your package for Linda Chen is waiting.';
  const names = (await findNames(t)).map((s) => t.slice(s.start, s.end));
  for (const n of ['Robert', 'Barbara', 'Kevin', 'Linda Chen']) assert.ok(names.includes(n), `${n} in ${JSON.stringify(names)}`);
});

test('name finder: results merge into findCanadianPii and are hidden on the review screen', async () => {
  const t = "Grandma it's Tyler. Please don't tell Mom. Send $500 in gift cards.";
  const m = masked(t, await findNames(t));
  assert.ok(!m.includes('Tyler'), m);
  assert.ok(m.includes('$500'), m);
  assert.ok(m.includes('Grandma') && m.includes('Mom'), m);
});

test('name finder: rules still win where they overlap, and labels stay on the allowed list', async () => {
  const t = SAMPLES.parcel;
  const spans = findCanadianPii(t, await findNames(t));
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i].start >= spans[i - 1].end);
  assert.ok(spans.some((s) => t.slice(s.start, s.end) === 'S4T 2L9' && s.label === 'postal code'));
  for (const s of spans) assert.ok(REDACTION_LABELS.includes(s.label), s.label);
});

test('clean-up: trims punctuation and titles; drops amounts, ordinary words, lowercase and domains', () => {
  const t = 'Mr. Davies, the $1,940.00 Grandma at MapleTrust.ca robert';
  const span = (piece) => ({ start: t.indexOf(piece), end: t.indexOf(piece) + piece.length });
  const out = cleanNameSpans([span('Mr. Davies,'), span('$1,940.00'), span('Grandma'), span('MapleTrust.ca'), span('robert')], t);
  assert.deepEqual(out.map((s) => t.slice(s.start, s.end)), ['Davies']);
  assert.ok(out.every((s) => s.label === 'name'));
});

test('status bar: names in the top strip of a tall screenshot are dropped', () => {
  const words = [
    { text: 'Rogers', bbox: { x0: 10, y0: 10, x1: 80, y1: 50 }, line: 0 },
    { text: 'Robert', bbox: { x0: 10, y0: 900, x1: 90, y1: 940 }, line: 1 },
  ];
  const spans = [{ start: 0, end: 6, label: 'name' }, { start: 7, end: 13, label: 'name' }];
  assert.deepEqual(dropStatusBar(spans, words, 1000, 2000).map((s) => s.start), [7]);
  assert.equal(dropStatusBar(spans, words, 1000, 1200).length, 2, 'not a tall screenshot: nothing dropped');
});

test('no look-behind in Check It source files that load with the page (older iPhones cannot load them)', () => {
  for (const f of ['ca-patterns.ts', 'names.ts', 'chips.ts', 'engine.ts']) {
    const src = readFileSync(new URL(`../src/lib/check/${f}`, import.meta.url), 'utf8');
    assert.ok(!/\(\?<[=!]/.test(src), f);
  }
});
