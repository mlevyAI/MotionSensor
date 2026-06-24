// Headless verification of the pure detection + threshold logic.
// Run: bun run scripts/selftest.ts
import assert from 'node:assert';
import { computeZoneScores, rgbaToGray } from '../src/detection/motion';
import { DEFAULT_GRID, GrayFrame, GridConfig } from '../src/detection/types';
import { deriveZoneConfig, isTriggered, triggeringZones } from '../src/labeling/thresholds';
import { LabeledExample } from '../src/labeling/types';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('  ✓', name);
}

const grid: GridConfig = { cols: 4, rows: 4, sampleWidth: 8, sampleHeight: 8, pixelNoiseThreshold: 20 };

function blank(w: number, h: number, v = 0): GrayFrame {
  return { data: new Uint8Array(w * h).fill(v), width: w, height: h };
}

console.log('motion detection');

check('identical frames => zero motion', () => {
  const a = blank(8, 8, 100);
  const b = blank(8, 8, 100);
  const r = computeZoneScores(a, b, grid);
  assert.equal(r.peakScore, 0);
  assert.deepEqual(r.scores, new Array(16).fill(0));
});

check('change in bottom-right zone => that zone peaks', () => {
  const a = blank(8, 8, 0);
  const b = blank(8, 8, 0);
  // Bottom-right 2x2 px block goes bright (zone R4C4 = index 15).
  for (let y = 6; y < 8; y++) for (let x = 6; x < 8; x++) b.data[y * 8 + x] = 255;
  const r = computeZoneScores(a, b, grid);
  assert.equal(r.peakZone, 15, `expected peak zone 15, got ${r.peakZone}`);
  assert.ok(r.scores[15] > 0.9, `expected zone15 ~1, got ${r.scores[15]}`);
  assert.equal(r.scores[0], 0);
});

check('sub-threshold change is ignored as noise', () => {
  const a = blank(8, 8, 100);
  const b = blank(8, 8, 110); // delta 10 < noise threshold 20
  const r = computeZoneScores(a, b, grid);
  assert.equal(r.peakScore, 0);
});

check('rgbaToGray luma weighting', () => {
  // pure red pixel
  const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
  const g = rgbaToGray(rgba, 1, 1);
  assert.equal(g.data[0], 76); // 255*0.299 = 76.2 -> 76
});

console.log('threshold derivation');

const mkEx = (label: 'allowed' | 'not_allowed', scores: number[], watched: number[] = []): LabeledExample => ({
  id: Math.random().toString(36),
  createdAt: 0,
  label,
  scores,
  peakZone: scores.indexOf(Math.max(...scores)),
  watchedZones: watched,
  grid: DEFAULT_GRID,
});

const N = 16;
const z = (idx: number, v: number) => {
  const a = new Array(N).fill(0);
  a[idx] = v;
  return a;
};

check('no examples => nothing watched', () => {
  const cfg = deriveZoneConfig([], DEFAULT_GRID, 0);
  assert.equal(cfg.watched.filter(Boolean).length, 0);
});

check('not-allowed example marks zone watched with separating threshold', () => {
  const examples = [
    mkEx('not_allowed', z(5, 0.6), [5]),
    mkEx('allowed', z(5, 0.1)),
  ];
  const cfg = deriveZoneConfig(examples, DEFAULT_GRID, 0);
  assert.equal(cfg.watched[5], true);
  assert.ok(cfg.thresholds[5] > 0.1 && cfg.thresholds[5] < 0.6, `threshold between allowed & not-allowed, got ${cfg.thresholds[5]}`);
  assert.equal(cfg.watched[0], false);
});

check('isTriggered fires only above threshold on watched zone', () => {
  const examples = [mkEx('not_allowed', z(5, 0.6), [5]), mkEx('allowed', z(5, 0.1))];
  const cfg = deriveZoneConfig(examples, DEFAULT_GRID, 0);
  assert.equal(isTriggered(z(5, 0.6), cfg), true);
  assert.equal(isTriggered(z(5, 0.15), cfg), false); // below midpoint
  assert.equal(isTriggered(z(0, 0.9), cfg), false); // unwatched zone
  assert.deepEqual(triggeringZones(z(5, 0.6), cfg), [5]);
});

check('allowed-only motion never arms a zone', () => {
  const cfg = deriveZoneConfig([mkEx('allowed', z(7, 0.8))], DEFAULT_GRID, 0);
  assert.equal(cfg.watched[7], false);
  assert.equal(isTriggered(z(7, 0.99), cfg), false);
});

console.log(`\nAll ${passed} checks passed.`);
