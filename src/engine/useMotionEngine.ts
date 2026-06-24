// Orchestrates the live loop: frame -> zone scores -> (overlay, auto-capture,
// alert trigger). Keeps the hot path in refs and surfaces throttled state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { computeZoneScores } from '../detection/motion';
import { DEFAULT_GRID, GrayFrame, GridConfig, MotionResult } from '../detection/types';
import { alerter } from '../alert/alertWeb';
import { exampleRepository } from '../labeling/repositoryWeb';
import { deriveZoneConfig, isTriggered, triggeringZones } from '../labeling/thresholds';
import { Label, LabeledExample, ZoneConfig } from '../labeling/types';

const CONSECUTIVE_FRAMES = 3;
const ALERT_COOLDOWN_MS = 5000;
const AUTO_CAPTURE_SCORE = 0.12;
const AUTO_CAPTURE_COOLDOWN_MS = 3500;

export type PendingCapture = {
  scores: number[];
  peakZone: number;
  thumbnail: string | null;
  grid: GridConfig;
  createdAt: number;
};

export type AlertBanner = {
  zones: number[];
  ts: number;
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.abs(hashNow()).toString(36);
}
let counter = 0;
function hashNow(): number {
  counter += 1;
  return (performance.now() * 1000 + counter) | 0;
}

export function useMotionEngine(grid: GridConfig = DEFAULT_GRID) {
  const [scores, setScores] = useState<number[]>(() => new Array(grid.cols * grid.rows).fill(0));
  const [peakZone, setPeakZone] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const [zoneConfig, setZoneConfig] = useState<ZoneConfig | null>(null);
  const [examples, setExamples] = useState<LabeledExample[]>([]);
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [banner, setBanner] = useState<AlertBanner | null>(null);

  // Hot-path refs (avoid re-rendering on every frame for control flow).
  const prevFrameRef = useRef<GrayFrame | null>(null);
  const monitoringRef = useRef(false);
  const zoneConfigRef = useRef<ZoneConfig | null>(null);
  const pendingRef = useRef<PendingCapture | null>(null);
  const triggerStreakRef = useRef(0);
  const lastAlertRef = useRef(0);
  const lastAutoCaptureRef = useRef(0);
  const getThumbnailRef = useRef<() => string | null>(() => null);

  monitoringRef.current = monitoring;
  zoneConfigRef.current = zoneConfig;
  pendingRef.current = pending;

  // Load persisted examples + derive config on mount.
  useEffect(() => {
    (async () => {
      await exampleRepository.init();
      const all = await exampleRepository.all();
      setExamples(all);
      setZoneConfig(deriveZoneConfig(all, grid, Date.now()));
    })().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registerThumbnailSource = useCallback((fn: () => string | null) => {
    getThumbnailRef.current = fn;
  }, []);

  const makePending = useCallback((result: MotionResult): PendingCapture => {
    return {
      scores: result.scores.slice(),
      peakZone: result.peakZone,
      thumbnail: getThumbnailRef.current(),
      grid,
      createdAt: Date.now(),
    };
  }, [grid]);

  const onFrame = useCallback(
    (frame: GrayFrame) => {
      const prev = prevFrameRef.current;
      prevFrameRef.current = frame;
      if (!prev || prev.data.length !== frame.data.length) return;

      const result = computeZoneScores(prev, frame, grid);
      setScores(result.scores);
      setPeakZone(result.peakZone);

      const cfg = zoneConfigRef.current;

      // Alert trigger (only while monitoring).
      if (monitoringRef.current && cfg) {
        if (isTriggered(result.scores, cfg)) {
          triggerStreakRef.current += 1;
        } else {
          triggerStreakRef.current = 0;
        }
        const now = Date.now();
        if (
          triggerStreakRef.current >= CONSECUTIVE_FRAMES &&
          now - lastAlertRef.current > ALERT_COOLDOWN_MS
        ) {
          lastAlertRef.current = now;
          triggerStreakRef.current = 0;
          alerter.fire();
          setBanner({ zones: triggeringZones(result.scores, cfg), ts: now });
        }
      }

      // Auto-capture significant motion for labeling (when nothing is pending).
      const now = Date.now();
      if (
        !pendingRef.current &&
        result.peakScore >= AUTO_CAPTURE_SCORE &&
        now - lastAutoCaptureRef.current > AUTO_CAPTURE_COOLDOWN_MS
      ) {
        lastAutoCaptureRef.current = now;
        setPending(makePending(result));
      }
    },
    [grid, makePending],
  );

  const captureNow = useCallback(() => {
    const prev = prevFrameRef.current;
    if (!prev) return;
    // Use the latest computed scores snapshot.
    setPending({
      scores: scores.slice(),
      peakZone,
      thumbnail: getThumbnailRef.current(),
      grid,
      createdAt: Date.now(),
    });
  }, [scores, peakZone, grid]);

  const discardPending = useCallback(() => setPending(null), []);

  const saveLabel = useCallback(
    async (label: Label, watchedZones: number[]) => {
      const p = pendingRef.current;
      if (!p) return;
      const example: LabeledExample = {
        id: uuid(),
        createdAt: p.createdAt,
        label,
        scores: p.scores,
        peakZone: p.peakZone,
        watchedZones: label === 'not_allowed' ? watchedZones : [],
        grid: p.grid,
        thumbnail: p.thumbnail ?? undefined,
      };
      await exampleRepository.add(example);
      const all = await exampleRepository.all();
      setExamples(all);
      setZoneConfig(deriveZoneConfig(all, grid, Date.now()));
      setPending(null);
    },
    [grid],
  );

  const removeExample = useCallback(
    async (id: string) => {
      await exampleRepository.remove(id);
      const all = await exampleRepository.all();
      setExamples(all);
      setZoneConfig(deriveZoneConfig(all, grid, Date.now()));
    },
    [grid],
  );

  const clearBanner = useCallback(() => setBanner(null), []);

  const primeAlert = useCallback(() => alerter.prime(), []);

  return {
    grid,
    scores,
    peakZone,
    monitoring,
    setMonitoring,
    zoneConfig,
    examples,
    pending,
    banner,
    onFrame,
    registerThumbnailSource,
    captureNow,
    discardPending,
    saveLabel,
    removeExample,
    clearBanner,
    primeAlert,
  };
}
