// Persists the forbidden-zone setup + sensitivity on-device (localStorage).
export type Sensitivity = 'low' | 'medium' | 'high';

export type ZoneSettings = {
  forbiddenZones: number[];
  sensitivity: Sensitivity;
};

const KEY = 'motionsensor.zones.v1';

export function loadZoneSettings(): ZoneSettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.forbiddenZones)) return null;
    const sensitivity: Sensitivity =
      parsed.sensitivity === 'low' || parsed.sensitivity === 'high' ? parsed.sensitivity : 'medium';
    return { forbiddenZones: parsed.forbiddenZones.filter((z: unknown) => typeof z === 'number'), sensitivity };
  } catch {
    return null;
  }
}

export function saveZoneSettings(s: ZoneSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota/availability errors */
  }
}
