// Shared, platform-agnostic detection types.
// These carry over unchanged to the native (VisionCamera) build.

export type GridConfig = {
  cols: number;
  rows: number;
  /** Width the camera frame is downscaled to before differencing. */
  sampleWidth: number;
  /** Height the camera frame is downscaled to before differencing. */
  sampleHeight: number;
  /** Per-pixel grayscale delta above which a pixel counts as "changed" (0-255). */
  pixelNoiseThreshold: number;
};

export const DEFAULT_GRID: GridConfig = {
  cols: 4,
  rows: 4,
  sampleWidth: 96,
  sampleHeight: 72,
  pixelNoiseThreshold: 22,
};

export const zoneCount = (g: GridConfig): number => g.cols * g.rows;

/** A grayscale buffer: one byte (0-255) per sampled pixel, row-major. */
export type GrayFrame = {
  data: Uint8Array;
  width: number;
  height: number;
};

export type MotionResult = {
  /** Per-zone fraction of changed pixels, 0..1, length = cols*rows. */
  scores: number[];
  /** Index of the zone with the highest score. */
  peakZone: number;
  /** Highest single-zone score this frame. */
  peakScore: number;
};
