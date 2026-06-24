// Tier-1 motion detection: frame-differencing into per-zone intensity scores.
// Pure functions — no DOM, no React — so they are unit-testable and shared
// verbatim between the web build and a future native build.

import { GrayFrame, GridConfig, MotionResult, zoneCount } from './types';

/**
 * Convert an RGBA pixel buffer (e.g. from canvas getImageData) to a packed
 * grayscale buffer using Rec. 601 luma weights.
 */
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): GrayFrame {
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    // 0.299 R + 0.587 G + 0.114 B
    out[p] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
  }
  return { data: out, width, height };
}

/**
 * Compute per-zone motion scores between the previous and current grayscale
 * frames. Each zone's score is the fraction of its pixels whose absolute
 * grayscale delta exceeded `pixelNoiseThreshold` (0..1).
 *
 * EXACT SIGNAL: this is the ONLY thing the detector "knows" — sustained pixel
 * change concentrated in a grid region. It has no notion of posture, identity,
 * or gesture.
 */
export function computeZoneScores(
  prev: GrayFrame,
  curr: GrayFrame,
  grid: GridConfig,
): MotionResult {
  const n = zoneCount(grid);
  const changed = new Float64Array(n);
  const total = new Float64Array(n);
  const { width: w, height: h } = curr;

  for (let y = 0; y < h; y++) {
    const zr = Math.min(grid.rows - 1, ((y * grid.rows) / h) | 0);
    const rowBase = y * w;
    const zoneRowBase = zr * grid.cols;
    for (let x = 0; x < w; x++) {
      const zc = Math.min(grid.cols - 1, ((x * grid.cols) / w) | 0);
      const z = zoneRowBase + zc;
      const idx = rowBase + x;
      total[z]++;
      const delta = Math.abs(curr.data[idx] - prev.data[idx]);
      if (delta > grid.pixelNoiseThreshold) changed[z]++;
    }
  }

  const scores = new Array<number>(n);
  let peakZone = 0;
  let peakScore = 0;
  for (let z = 0; z < n; z++) {
    const s = total[z] > 0 ? changed[z] / total[z] : 0;
    scores[z] = s;
    if (s > peakScore) {
      peakScore = s;
      peakZone = z;
    }
  }
  return { scores, peakZone, peakScore };
}

/** Human-readable label for a zone index, e.g. "R1C3" (1-based). */
export function zoneLabel(zone: number, grid: GridConfig): string {
  const r = Math.floor(zone / grid.cols) + 1;
  const c = (zone % grid.cols) + 1;
  return `R${r}C${c}`;
}
