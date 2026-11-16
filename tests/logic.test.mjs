import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTestCode, formOrder, formForStage, itemsForForm, nextStageAfter } from '../src/lib/forms';
import { evaluate, scoreResponses, itemPoints, isExampleRight } from '../src/lib/scoring';
import { pickPracticeRound } from '../src/lib/selection';
import { validateTrackEvent } from '../src/lib/track-validate';
import { aggregate } from '../src/lib/analytics';
import { buildSampleData } from '../src/lib/sample-data';
import { seededShuffle, mulberry32 } from '../src/lib/rng';

const scenarios = JSON.parse(readFileSync(new URL('../content/scenarios.json', import.meta.url))).scenarios;
const find = (id) => scenarios.find((s) => s.id === id);

test('test codes parse and normalise', () => {
  assert.deepEqual(parseTestCode('t3'), { code: 'T3', n: 3 });
  assert.deepEqual(parseTestCode(' T 03 '), { code: 'T3', n: 3 });
  assert.equal(parseTestCode('T0'), null);
  assert.equal(parseTestCode('hello'), null);
  assert.equal(parseTestCode(''), null);
});

test('form order: odd codes A then B, even codes B then A', () => {
  for (const n of [1, 3, 5]) assert.deepEqual(formOrder(n), ['A', 'B']);
  for (const n of [2, 4]) assert.deepEqual(formOrder(n), ['B', 'A']);
  assert.equal(formForStage(formOrder(2), 'pre'), 'B');
  assert.equal(formForStage(formOrder(2), 'post'), 'A');
  assert.equal(nextStageAfter('pre'), 'practice');
  assert.equal(nextStageAfter('practice'), 'post');
  assert.equal(nextStageAfter('post'), 'done');
});

test('form A = S11,S13,S15,S17,S19 and form B = S12,S14,S16,S18,S20 (any order, stable per code)', () => {
  const a = itemsForForm(scenarios, 'A', 'T1').map((s) => s.id);
  const b = itemsForForm(scenarios, 'B', 'T1').map((s) => s.id);
  assert.deepEqual([...a].sort(), ['S11', 'S13', 'S15', 'S17', 'S19']);
  assert.deepEqual([...b].sort(), ['S12', 'S14', 'S16', 'S18', 'S20']);
  assert.deepEqual(itemsForForm(scenarios, 'A', 'T1').map((s) => s.id), a);
});

test('every Form A item has a Form B twin with the same tactic and verdict', () => {
  for (const a of scenarios.filter((s) => s.form === 'A')) {
    const b = scenarios.find((s) => s.form === 'B' && s.pair_id === a.pair_id);
    assert.ok(b, `no twin for ${a.id}`);
    assert.equal(b.verdict, a.verdict);
    assert.equal(b.tactic, a.tactic);
    assert.equal(b.format, a.format);
  }
});

test('scoring: 1 point for verdict + 1 for safe step; sign is not scored', () => {
  const s = find('S01');
  const all = evaluate(s, { verdict: 'scam', sign: 'a', step: 'a' });
  assert.deepEqual(all, { verdict_correct: true, sign_correct: true, step_correct: true });
  const wrongSign = evaluate(s, { verdict: 'scam', sign: 'b', step: 'a' });
  assert.equal(itemPoints(wrongSign), 2);
  const wrongVerdict = evaluate(s, { verdict: 'real', sign: 'a', step: 'a' });
  assert.equal(itemPoints(wrongVerdict), 1);
  assert.deepEqual(scoreResponses([all, wrongVerdict]), { points: 3, max: 4 });
  assert.equal(isExampleRight(wrongSign), true);
  assert.equal(isExampleRight(wrongVerdict), false);
});

test('practice round: 5 practice items only, always at least one real message, new items first', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const rand = mulberry32(seed);
    const r1 = pickPracticeRound(scenarios, [], rand);
    assert.equal(r1.items.length, 5);
    assert.ok(r1.items.every((s) => s.use === 'practice'), 'test item leaked into practice');
    assert.ok(r1.items.some((s) => s.verdict === 'real'), 'no real message in round');
    assert.equal(new Set(r1.items.map((s) => s.id)).size, 5);
    const r2 = pickPracticeRound(scenarios, r1.seen, rand);
    const ids1 = new Set(r1.items.map((s) => s.id));
    // second round should be the five unseen items (pool of 10) unless the real-message swap needed one back
    const overlap = r2.items.filter((s) => ids1.has(s.id)).length;
    assert.ok(overlap <= 1, `too much overlap (${overlap})`);
  }
});

test('seeded shuffle is repeatable and a real permutation', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(seededShuffle(xs, 'a'), seededShuffle(xs, 'a'));
  assert.deepEqual([...seededShuffle(xs, 'a')].sort(), xs);
});

const UUID = '11111111-2222-4333-8444-555555555555';
const evalFn = (s, c) => evaluate(s, c);

test('track validation: start, response (server recomputes correctness), complete', () => {
  const start = validateTrackEvent(
    { event: 'start', anon_id: 'T1', age_band: '60-69', device_type: 'phone', is_test_code: true,
      attempt: { attempt_id: UUID, mode: 'pre', form: 'A', started_at: new Date().toISOString(), app_version: '1.0.0', content_version: '1.0.0' } },
    find, evalFn);
  assert.equal(start.ok, true);

  const resp = validateTrackEvent(
    { event: 'response', attempt_id: UUID,
      response: { scenario_id: 'S11', verdict_choice: 'scam', verdict_correct: false, sign_choice: 'a', sign_correct: false, step_choice: 'b', step_correct: true, time_ms: 12000.4, answered_at: new Date().toISOString() } },
    find, evalFn);
  assert.equal(resp.ok, true);
  assert.equal(resp.event.response.verdict_correct, true, 'client flag must be ignored');
  assert.equal(resp.event.response.step_correct, false, 'client flag must be ignored');
  assert.equal(resp.event.response.time_ms, 12000);

  assert.equal(validateTrackEvent({ event: 'complete', attempt_id: UUID, completed_at: new Date().toISOString() }, find, evalFn).ok, true);
});

test('track validation rejects bad input', () => {
  const bad = (b) => assert.equal(validateTrackEvent(b, find, evalFn).ok, false);
  bad(null); bad([]); bad({ event: 'nope' });
  bad({ event: 'complete', attempt_id: 'not-a-uuid', completed_at: new Date().toISOString() });
  bad({ event: 'response', attempt_id: UUID, response: { scenario_id: 'S99', verdict_choice: 'scam', sign_choice: 'a', step_choice: 'a', time_ms: 1, answered_at: new Date().toISOString() } });
  bad({ event: 'response', attempt_id: UUID, response: { scenario_id: 'S01', verdict_choice: 'maybe', sign_choice: 'a', step_choice: 'a', time_ms: 1, answered_at: new Date().toISOString() } });
  bad({ event: 'response', attempt_id: UUID, response: { scenario_id: 'S01', verdict_choice: 'scam', sign_choice: 'a', step_choice: 'a', time_ms: -5, answered_at: new Date().toISOString() } });
  bad({ event: 'start', anon_id: 'has space', attempt: { attempt_id: UUID, mode: 'pre', form: 'A', started_at: new Date().toISOString(), app_version: '1', content_version: '1' } });
  bad({ event: 'start', anon_id: 'ok', attempt: { attempt_id: UUID, mode: 'hack', form: 'A', started_at: new Date().toISOString(), app_version: '1', content_version: '1' } });
});

test('analytics: pre/post change, completion and pair balance', () => {
  const meta = scenarios.map((s) => ({ id: s.id, use: s.use, tactic: s.tactic, pair_id: s.pair_id, form: s.form }));
  const mk = (id, anon, mode, form, done = true) => ({ attempt_id: id, anon_id: anon, mode, form, started_at: '2026-11-10T10:00:00Z', completed_at: done ? '2026-11-10T10:10:00Z' : null, app_version: '1.0.0', content_version: '1.0.0' });
  const attempts = [mk('a1', 'T1', 'pre', 'A'), mk('a2', 'T1', 'post', 'B'), mk('a3', 'T2', 'pre', 'B'), mk('a4', 'T2', 'post', 'A', false), mk('p1', 'u1', 'practice', null), mk('p2', 'u2', 'practice', null, false)];
  const resp = (att, sid, v, s) => ({ attempt_id: att, scenario_id: sid, verdict_correct: v, sign_correct: true, step_correct: s, time_ms: 10000 });
  const responses = [
    ...['S11', 'S13', 'S15', 'S17', 'S19'].map((id) => resp('a1', id, true, false)), // pre: 5 points of 10
    ...['S12', 'S14', 'S16', 'S18', 'S20'].map((id) => resp('a2', id, true, true)), // post: 10 of 10
    ...['S12', 'S14', 'S16', 'S18', 'S20'].map((id) => resp('a3', id, false, false)), // T2 pre 0
    resp('p1', 'S01', true, true), resp('p1', 'S02', false, true),
  ];
  const stats = aggregate([], attempts, responses, meta, new Date('2026-11-12T00:00:00Z'));
  assert.equal(stats.testing.testers, 2);
  assert.equal(stats.testing.completed_both, 1, 'T2 has no completed post-test');
  assert.equal(stats.testing.completion_rate, 50);
  assert.equal(stats.testing.avg_change_points, 5);
  assert.equal(stats.testing.avg_change_pp, 50);
  assert.equal(stats.testing.target_met, true);
  assert.equal(stats.practice.attempts, 2);
  assert.equal(stats.practice.completion_rate, 50);
  assert.equal(stats.practice.avg_round_score_pct, 50);
  const p1 = stats.pairs.find((p) => p.pair === 'P1');
  assert.equal(p1.status, 'too_few');
  assert.equal(stats.activity.length, 14);
});

test('sample data produces a full, sane dashboard', () => {
  const meta = scenarios.map((s) => ({ id: s.id, use: s.use, tactic: s.tactic, pair_id: s.pair_id, form: s.form }));
  const d = buildSampleData(meta, new Date('2026-11-12T12:00:00Z'));
  const stats = aggregate(d.participants, d.attempts, d.responses, meta, new Date('2026-11-12T12:00:00Z'));
  assert.equal(stats.testing.testers, 5);
  assert.ok(stats.testing.completed_both >= 3);
  assert.ok(stats.practice.attempts >= 18);
  assert.ok(stats.by_tactic.length >= 5);
  assert.ok(stats.by_scenario.every((s) => s.both_pct === null || (s.both_pct >= 0 && s.both_pct <= 100)));
  const again = buildSampleData(meta, new Date('2026-11-12T12:00:00Z'));
  assert.equal(JSON.stringify(again), JSON.stringify(d), 'sample data must be deterministic');
});
