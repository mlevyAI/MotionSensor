// Derive runtime alert thresholds from the user's labeled examples.
// Pure + shared (web and future native use the identical rule).

import { GridConfig, zoneCount } from '../detection/types';
import { LabeledExample, ZoneConfig } from './types';

/** A zone is never triggered unless its derived threshold is below this. */
const NEVER = 1.01;
/** Minimum motion in a not-allowed example for a zone to be "watched". */
const MIN_WATCH_SCORE = 0.05;

/**
 * For each zone, separate the score distributions of allowed vs not-allowed
 * examples and place the threshold so allowed motion falls below and
 * not-allowed motion falls above:
 *
 *  - no not-allowed evidence for the zone  -> not watched (threshold = NEVER)
 *  - clean separation (min not-allowed > max allowed) -> midpoint threshold
 *  - overlap -> lean sensitive (just below the lowest not-allowed score)
 *
 * Only zones the user explicitly marked as watched on a not-allowed example
 * (or that were strongly active there) become watched zones.
 */
export function deriveZoneConfig(
  examples: LabeledExample[],
  grid: GridConfig,
  updatedAt: number,
): ZoneConfig {
  const n = zoneCount(grid);
  const thresholds = new Array<number>(n).fill(NEVER);
  const watched = new Array<boolean>(n).fill(false);

  for (let z = 0; z < n; z++) {
    const allowedScores: number[] = [];
    const notAllowedScores: number[] = [];

    for (const ex of examples) {
      // Skip examples computed with an incompatible grid.
      if (ex.scores.length !== n) continue;
      const s = ex.scores[z];
      if (ex.label === 'allowed') {
        allowedScores.push(s);
      } else {
        // not_allowed: only counts toward this zone if the user attributed the
        // zone (watchedZones) or it was clearly active.
        const attributed = ex.watchedZones.includes(z) || s >= MIN_WATCH_SCORE;
        if (attributed) notAllowedScores.push(s);
      }
    }

    if (notAllowedScores.length === 0) continue; // stays unwatched

    const naMin = Math.min(...notAllowedScores);
    const alMax = allowedScores.length ? Math.max(...allowedScores) : 0;

    let threshold: number;
    if (naMin > alMax) {
      threshold = (naMin + alMax) / 2;
    } else {
      // overlap between allowed and not-allowed: prefer catching the event.
      threshold = naMin * 0.9;
    }

    thresholds[z] = clamp(threshold, 0.03, 0.95);
    watched[z] = naMin >= MIN_WATCH_SCORE;
  }

  return { thresholds, watched, grid, updatedAt };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** True when at least one watched zone is currently over its threshold. */
export function isTriggered(scores: number[], cfg: ZoneConfig): boolean {
  for (let z = 0; z < scores.length; z++) {
    if (cfg.watched[z] && scores[z] >= cfg.thresholds[z]) return true;
  }
  return false;
}

/** Zones currently over threshold (for explaining WHY an alert fired). */
export function triggeringZones(scores: number[], cfg: ZoneConfig): number[] {
  const out: number[] = [];
  for (let z = 0; z < scores.length; z++) {
    if (cfg.watched[z] && scores[z] >= cfg.thresholds[z]) out.push(z);
  }
  return out;
}
