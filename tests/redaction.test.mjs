import test from 'node:test';
import assert from 'node:assert/strict';
import { findCanadianPii, redactText, luhnValid, bcPhnValid } from '../src/lib/redaction/ca-patterns';
import { spanToBoxes, filterLibraryEntities, houseNumberBefore } from '../src/lib/redaction/boxes';

// The five test samples (all details fake), as OCR text. "\n" marks a line break in the screenshot.
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
    '+1 (306) 555-0142\nGrandma it\'s Tyler. I broke my phone so this is a friend\'s. I need $3,000 for bail. ' +
    'Please call my lawyer Mr. Davies at 306-555-0177. Please don\'t tell Mom.',
  clinic:
    'Prairie Family Clinic: Hi Dorothy Nguyen, reminder of your appointment with Dr. Patel on Tue Nov 25 at 10:30 am.\n' +
    'Please bring your health card (123 456 789). Questions? Call us at 306-555-0110. Reply C to confirm.',
};

const hidden = (text) => findCanadianPii(text).matches.map((m) => m.text);
const kept = (text) => {
  const r = redactText(text);
  return (s) => assert.ok(r.includes(s), `expected "${s}" to stay visible in: ${r}`);
};

test('checks: Luhn and BC PHN', () => {
  assert.equal(luhnValid('4111111111111111'), true);
  assert.equal(luhnValid('4111111111111112'), false);
  assert.equal(luhnValid('046454286'), true); // CRA's published sample SIN
  assert.equal(bcPhnValid('9698658215'), true); // passes the MOD-11 check
  assert.equal(bcPhnValid('9698658216'), false);
});

test('sample 1 parcel: postal code and tracking code hidden; amount, deadline and domain kept', () => {
  const h = hidden(SAMPLES.parcel);
  assert.ok(h.includes('S4T 2L9'));
  assert.ok(h.includes('?id=MW88421'));
  const k = kept(SAMPLES.parcel);
  k('$1.95');
  k('24 hours');
  k('cpost-parcelfee.example/track');
});

test('sample 2 bank: card, expiry and code hidden; amount kept', () => {
  const h = hidden(SAMPLES.bank);
  assert.ok(h.includes('4111 1111 1111 1111'));
  assert.ok(h.includes('08/28'));
  assert.ok(h.includes('482913'));
  kept(SAMPLES.bank)('$1,940.00');
});

test('sample 3 refund: SIN, birth date, email names and link code hidden; domains and deadline kept', () => {
  const h = hidden(SAMPLES.refund);
  assert.ok(h.includes('046 454 286'));
  assert.ok(h.includes('March 14, 1952'));
  assert.ok(h.includes('g.fontaine58@'));
  assert.ok(h.includes('notice@'));
  assert.ok(h.includes('?ref=G'));
  assert.ok(h.includes('F0464'));
  const sin = findCanadianPii(SAMPLES.refund).matches.find((m) => m.text === '046 454 286');
  assert.equal(sin.label, 'SIN');
  const k = kept(SAMPLES.refund);
  k('cra-refund-portal.example');
  k('example.com');
  k('$486.20');
  k('Nov 22');
  k('2025 tax year');
});

test('sample 4 grandchild: both phone formats hidden; amount kept', () => {
  const h = hidden(SAMPLES.grandchild);
  assert.ok(h.some((t) => t.includes('(306) 555-0142')));
  assert.ok(h.includes('306-555-0177'));
  kept(SAMPLES.grandchild)('$3,000');
});

test('sample 5 clinic: 9-digit health card number hidden and labelled', () => {
  const m = findCanadianPii(SAMPLES.clinic).matches;
  const card = m.find((x) => x.text === '123 456 789');
  assert.ok(card);
  assert.equal(card.label, 'health card number');
  assert.ok(m.some((x) => x.text === '306-555-0110'));
  kept(SAMPLES.clinic)('Nov 25 at 10:30');
});

test('other Canadian formats', () => {
  assert.deepEqual(hidden('OHIP 1234-567-890-AB'), ['1234-567-890-AB']);
  assert.deepEqual(hidden('RAMQ ABCD 1234 5678'), ['ABCD 1234 5678']);
  assert.deepEqual(hidden('PIN: 4821'), ['4821']);
  assert.deepEqual(hidden('CVV 123'), ['123']);
  assert.deepEqual(hidden('call 1-888-495-8501'), ['1-888-495-8501']);
  assert.deepEqual(hidden('Mail to K1A 0B1 please'), ['K1A 0B1']);
});

test('no false alarms on scam clues', () => {
  assert.deepEqual(hidden('Pay $2,500.00 by 3 pm or within 24 hours. Order 12 items.'), []);
  assert.deepEqual(hidden('Your code expired. Visit canadapost.example now.'), []);
  assert.deepEqual(hidden('Buy 4 gift cards worth $500 each'), []);
  assert.deepEqual(hidden('Born to win. Tax year 2025.'), []);
});

// ---------- boxes ----------

// Two words on one line: "Email:" (x 0-60) and "notice@cra.example" (x 70-250, 18 characters).
const WORDS = [
  { text: 'Email:', bbox: { x0: 0, y0: 100, x1: 60, y1: 120 }, confidence: 95, charStart: 0, charEnd: 6, lineIndex: 0 },
  { text: 'notice@cra.example', bbox: { x0: 70, y0: 100, x1: 250, y1: 120 }, confidence: 95, charStart: 7, charEnd: 25, lineIndex: 0 },
];

test('boxes: part of a word is hidden in proportion (email name part only)', () => {
  // "notice@" = characters 7..14 of the text, the first 7 of 18 in the word.
  const [box] = spanToBoxes(WORDS, 7, 14, { imageWidth: 400, imageHeight: 800 });
  assert.ok(box.x0 <= 70);
  assert.ok(box.x1 > 70 + (180 * 7) / 18 && box.x1 < 70 + (180 * 9) / 18, `x1 was ${box.x1}`);
});

test('filter: drops amounts, kept zones, stray words and status-bar items', () => {
  const ocr = {
    fullText: '9:41 MapleTrust blocked a $1,940.00 purchase at the bank notice@cra.example Robert',
    imageWidth: 1000,
    imageHeight: 2000,
    words: [
      { text: '9:41', bbox: { x0: 100, y0: 20, x1: 160, y1: 60 }, confidence: 90, charStart: 0, charEnd: 4, lineIndex: 0 },
      { text: 'Robert', bbox: { x0: 100, y0: 900, x1: 200, y1: 940 }, confidence: 90, charStart: 75, charEnd: 81, lineIndex: 3 },
    ],
  };
  const e = (id, label, start, end) => ({ id, label, start, end, text: ocr.fullText.slice(start, end), score: 0.9, source: 'ner' });
  const entities = [
    e('time', 'TIME', 0, 4),
    e('money', 'ACCOUNTNUM', 26, 44),
    e('at', 'GIVENNAME', 45, 47),
    e('mail', 'EMAIL', 57, 74),
    e('name', 'GIVENNAME', 75, 81),
  ];
  const keep = [{ start: 64, end: 74 }];
  const keptIds = filterLibraryEntities(entities, ocr, keep).map((x) => x.id);
  assert.deepEqual(keptIds, ['name']);
});

test('street number before a street name is found', () => {
  const words = [
    { text: 'to', bbox: { x0: 0, y0: 0, x1: 20, y1: 10 }, confidence: 90, charStart: 0, charEnd: 2, lineIndex: 0 },
    { text: '142', bbox: { x0: 30, y0: 0, x1: 60, y1: 10 }, confidence: 90, charStart: 3, charEnd: 6, lineIndex: 0 },
    { text: 'Willow', bbox: { x0: 70, y0: 0, x1: 120, y1: 10 }, confidence: 90, charStart: 7, charEnd: 13, lineIndex: 0 },
  ];
  assert.equal(houseNumberBefore(words, 7)?.text, '142');
});
