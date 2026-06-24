// On-device data model for the labeling / feedback loop.
import { GridConfig } from '../detection/types';

export type Label = 'allowed' | 'not_allowed';

/** One reviewed motion event the user has tagged. */
export type LabeledExample = {
  id: string;
  createdAt: number;
  label: Label;
  /** Per-zone motion scores at the captured peak frame, 0..1. */
  scores: number[];
  /** Zone that was most active when captured. */
  peakZone: number;
  /** Zones the user marked as "this is what should be watched" (not_allowed only). */
  watchedZones: number[];
  /** Grid the scores were computed with, so old examples stay interpretable. */
  grid: GridConfig;
  /** Small JPEG/PNG data-URL thumbnail of the captured frame (evidence). */
  thumbnail?: string;
};

/** Derived runtime configuration applied by the detector to fire alerts. */
export type ZoneConfig = {
  /** Per-zone alert threshold (0..1). A zone with threshold > 1 never fires. */
  thresholds: number[];
  /** Whether each zone is actively watched for not-allowed motion. */
  watched: boolean[];
  grid: GridConfig;
  updatedAt: number;
};
