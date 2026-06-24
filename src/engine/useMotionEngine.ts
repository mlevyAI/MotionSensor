// Orchestrates the live loop: frame -> per-zone motion scores -> alert.
// The user directly marks "forbidden" zones (where movement is not allowed) and
// picks a sensitivity; while armed, any movement in a forbidden zone fires the
// alert. No per-movement labeling. Hot path stays in refs.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeZoneScores } from '../detection/motion';
import { DEFAULT_GRID, GrayFrame, GridConfig, zoneCount } from '../detection/types';
import { alerter } from '../alert/alertWeb';
import { isTriggered, triggeringZones } from '../labeling/thresholds';
import { ZoneConfig } from '../labeling/types';
import { Sensitivity, loadZoneSettings, saveZoneSettings } from './zoneStore';

const CONSECUTIVE_FRAMES = 2;
const ALERT_COOLDOWN_MS = 5000;

/** Fraction of a zone's pixels that must change to count as "movement". */
export const SENSITIVITY_THRESHOLD: Record<Sensitivity, number> = {
  low: 0.12, // only clear, nearby movements
  medium: 0.04,
  high: 0.015,
  max: 0.005, // tiny / distant movement (noisier)
};

export type { Sensitivity };

export type AlertBanner = { zones: number[]; ts: number };

function buildConfig(forbidden: number[], sensitivity: Sensitivity, grid: GridConfig): ZoneConfig {
  const n = zoneCount(grid);
  const thresholds = new Array<number>(n).fill(SENSITIVITY_THRESHOLD[sensitivity]);
  const watched = new Array<boolean>(n).fill(false);
  for (const z of forbidden) if (z >= 0 && z < n) watched[z] = true;
  return { thresholds, watched, grid, updatedAt: 0 };
}

export function useMotionEngine(grid: GridConfig = DEFAULT_GRID) {
  const [scores, setScores] = useState<number[]>(() => new Array(zoneCount(grid)).fill(0));
  const [peakZone, setPeakZone] = useState(0);
  const [peakScore, setPeakScore] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const [forbiddenZones, setForbiddenZones] = useState<number[]>(
    () => loadZoneSettings()?.forbiddenZones ?? [],
  );
  const [sensitivity, setSensitivity] = useState<Sensitivity>(
    () => loadZoneSettings()?.sensitivity ?? 'medium',
  );
  const [banner, setBanner] = useState<AlertBanner | null>(null);

  const prevFrameRef = useRef<GrayFrame | null>(null);
  const monitoringRef = useRef(false);
  const zoneConfigRef = useRef<ZoneConfig | null>(null);
  const triggerStreakRef = useRef(0);
  const lastAlertRef = useRef(0);

  const zoneConfig = useMemo(
    () => buildConfig(forbiddenZones, sensitivity, grid),
    [forbiddenZones, sensitivity, grid],
  );

  monitoringRef.current = monitoring;
  zoneConfigRef.current = zoneConfig;

  // Persist setup whenever it changes (on-device).
  useEffect(() => {
    saveZoneSettings({ forbiddenZones, sensitivity });
  }, [forbiddenZones, sensitivity]);

  const onFrame = useCallback(
    (frame: GrayFrame) => {
      const prev = prevFrameRef.current;
      prevFrameRef.current = frame;
      if (!prev || prev.data.length !== frame.data.length) return;

      const result = computeZoneScores(prev, frame, grid);
      setScores(result.scores);
      setPeakZone(result.peakZone);
      setPeakScore(result.peakScore);

      const cfg = zoneConfigRef.current;
      if (monitoringRef.current && cfg) {
        if (isTriggered(result.scores, cfg)) triggerStreakRef.current += 1;
        else triggerStreakRef.current = 0;

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
    },
    [grid],
  );

  const toggleZone = useCallback((z: number) => {
    setForbiddenZones((cur) => (cur.includes(z) ? cur.filter((x) => x !== z) : [...cur, z]));
  }, []);

  const clearZones = useCallback(() => setForbiddenZones([]), []);
  const selectAllZones = useCallback(
    () => setForbiddenZones(Array.from({ length: zoneCount(grid) }, (_, i) => i)),
    [grid],
  );
  const clearBanner = useCallback(() => setBanner(null), []);
  const primeAlert = useCallback(() => alerter.prime(), []);

  return {
    grid,
    scores,
    peakZone,
    peakScore,
    monitoring,
    setMonitoring,
    forbiddenZones,
    toggleZone,
    clearZones,
    selectAllZones,
    sensitivity,
    setSensitivity,
    zoneConfig,
    banner,
    onFrame,
    clearBanner,
    primeAlert,
  };
}
