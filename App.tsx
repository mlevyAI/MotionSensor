import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView } from './src/camera/CameraView';
import { CameraStatus } from './src/camera/types';
import { DEFAULT_GRID } from './src/detection/types';
import { zoneLabel } from './src/detection/motion';
import { triggeringZones } from './src/labeling/thresholds';
import { Sensitivity, useMotionEngine } from './src/engine/useMotionEngine';
import { ZoneOverlay } from './src/ui/ZoneOverlay';

const GRID = DEFAULT_GRID;

const SENSITIVITY_LABELS: { key: Sensitivity; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Med' },
  { key: 'high', label: 'High' },
  { key: 'max', label: 'Max' },
];

export default function App() {
  const engine = useMotionEngine(GRID);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [statusDetail, setStatusDetail] = useState<string | undefined>();

  const start = async () => {
    await engine.primeAlert(); // unlock audio under this user gesture (iOS)
    setCameraOn(true);
  };
  const stop = () => {
    setCameraOn(false);
    engine.setMonitoring(false);
  };

  const forbiddenCount = engine.forbiddenZones.length;
  const editing = cameraOn && !engine.monitoring;
  const liveTriggers = engine.monitoring ? triggeringZones(engine.scores, engine.zoneConfig) : [];

  // Full-screen red flash on each alert (guaranteed visual, even on silent mode).
  const [flash, setFlash] = useState(false);
  const bannerTs = engine.banner?.ts;
  useEffect(() => {
    if (!bannerTs) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 6000);
    return () => clearTimeout(id);
  }, [bannerTs]);

  const arm = () => {
    if (!engine.monitoring) engine.primeAlert(); // re-unlock audio under this tap
    engine.setMonitoring(!engine.monitoring);
  };

  const dismissAlert = () => {
    setFlash(false);
    engine.clearBanner();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>MotionSensor</Text>
        <Text style={styles.sub}>Mark off-limits zones · alert on movement there</Text>

        {/* Camera + overlay */}
        <View style={styles.stage}>
          {cameraOn ? (
            <>
              <CameraView
                grid={GRID}
                active={cameraOn}
                sampleFps={12}
                onStatus={(s, d) => {
                  setStatus(s);
                  setStatusDetail(d);
                }}
                onFrame={engine.onFrame}
              />
              <ZoneOverlay
                grid={GRID}
                scores={engine.scores}
                zoneConfig={engine.zoneConfig}
                selectable={editing}
                selectedZones={editing ? engine.forbiddenZones : undefined}
                onToggleZone={engine.toggleZone}
                triggeredZones={engine.monitoring ? liveTriggers : []}
                showLabels
              />
            </>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.dim}>Camera off</Text>
            </View>
          )}

          {engine.monitoring && engine.banner ? (
            <View style={styles.alertBanner} pointerEvents="box-none">
              <Text style={styles.alertText}>
                ⚠ Movement in off-limits zone · {engine.banner.zones.map((z) => zoneLabel(z, GRID)).join(', ')}
              </Text>
              <Pressable onPress={engine.clearBanner} style={styles.alertClear}>
                <Text style={styles.alertClearText}>dismiss</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <StatusLine status={status} detail={statusDetail} cameraOn={cameraOn} />

        {cameraOn && status === 'streaming' ? (
          <Text style={styles.motion}>
            Live motion (busiest zone): <Text style={styles.motionPct}>{Math.round(engine.peakScore * 100)}%</Text>
          </Text>
        ) : null}

        {editing ? (
          <View style={styles.zoneTools}>
            <Pressable style={styles.zoneToolBtn} onPress={engine.selectAllZones}>
              <Text style={styles.zoneToolText}>Select all</Text>
            </Pressable>
            <Pressable style={styles.zoneToolBtn} onPress={engine.clearZones}>
              <Text style={styles.zoneToolText}>Clear</Text>
            </Pressable>
          </View>
        ) : null}

        {editing ? (
          <Text style={styles.guide}>
            📌 Prop the phone up and keep it still. Tap the zones where movement is{' '}
            <Text style={styles.bold}>not allowed</Text> (they turn blue), pick a sensitivity, then{' '}
            <Text style={styles.bold}>Arm watch</Text>. While armed, any movement in those zones
            triggers an alert.
          </Text>
        ) : null}

        {/* Sensitivity (setup only) */}
        {editing ? (
          <View style={styles.sensRow}>
            <Text style={styles.sensLabel}>Sensitivity</Text>
            <View style={styles.sensBtns}>
              {SENSITIVITY_LABELS.map((s) => {
                const active = engine.sensitivity === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => engine.setSensitivity(s.key)}
                    style={[styles.sensBtn, active && styles.sensBtnActive]}
                  >
                    <Text style={[styles.sensBtnText, active && styles.sensBtnTextActive]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Primary controls */}
        <View style={styles.controls}>
          {!cameraOn ? (
            <Pressable style={[styles.ctrl, styles.primary]} onPress={start}>
              <Text style={styles.ctrlText}>Start camera</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.ctrl, engine.monitoring ? styles.armed : styles.primary]}
                onPress={arm}
                disabled={forbiddenCount === 0}
              >
                <Text style={styles.ctrlText}>
                  {engine.monitoring ? 'Disarm' : forbiddenCount === 0 ? 'Mark zones first' : 'Arm watch'}
                </Text>
              </Pressable>
              <Pressable style={[styles.ctrl, styles.stop]} onPress={stop}>
                <Text style={styles.ctrlText}>Stop</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Status / stats */}
        <View style={styles.stats}>
          <Stat label="Off-limits zones" value={String(forbiddenCount)} />
          <Stat label="Sensitivity" value={cap(engine.sensitivity)} />
          <Stat label="State" value={engine.monitoring ? 'ARMED' : cameraOn ? 'Setup' : 'Off'} />
        </View>

        {forbiddenCount > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {engine.monitoring ? 'Watching for movement in' : 'Off-limits zones'}
            </Text>
            <Text style={styles.zoneList}>
              {engine.forbiddenZones
                .slice()
                .sort((a, b) => a - b)
                .map((z) => zoneLabel(z, GRID))
                .join(' · ')}
            </Text>
            {engine.monitoring ? (
              <Text style={styles.dim}>Armed — any movement here plays the alarm.</Text>
            ) : (
              <Text style={styles.dim}>Tap a highlighted zone again to unset it.</Text>
            )}
          </View>
        ) : null}

        <Text style={styles.footer}>
          Foreground-only · all on-device · keep the phone still while watching
        </Text>
      </ScrollView>

      {flash && engine.banner ? (
        <Pressable style={styles.flash} onPress={dismissAlert}>
          <Text style={styles.flashTitle}>⚠ MOVEMENT</Text>
          <Text style={styles.flashZones}>
            {engine.banner.zones.map((z) => zoneLabel(z, GRID)).join(' · ')}
          </Text>
          <Text style={styles.flashDismiss}>tap to dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusLine({
  status,
  detail,
  cameraOn,
}: {
  status: CameraStatus;
  detail?: string;
  cameraOn: boolean;
}) {
  if (!cameraOn) return null;
  const map: Record<CameraStatus, string> = {
    idle: 'Idle',
    requesting: 'Requesting camera permission…',
    streaming: 'Camera live',
    denied: 'Camera permission denied — allow it in your browser and reload.',
    notfound: 'No camera found.',
    unsupported: 'Camera needs HTTPS (a secure URL).',
    error: 'Camera error.',
  };
  const ok = status === 'streaming';
  return (
    <Text style={[styles.status, ok ? styles.statusOk : styles.statusWarn]}>
      {map[status]}
      {detail && !ok ? ` (${detail})` : ''}
    </Text>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f14' },
  scroll: { padding: 16, paddingTop: 48, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  h1: { color: '#fff', fontSize: 26, fontWeight: '800' },
  sub: { color: '#7c8896', fontSize: 13, marginTop: -6 },
  stage: {
    aspectRatio: 4 / 3,
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  placeholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  alertBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(192,57,43,0.92)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertText: { color: '#fff', fontWeight: '700', flex: 1 },
  alertClear: { paddingHorizontal: 8, paddingVertical: 4 },
  alertClearText: { color: '#ffd9d3', fontSize: 12 },
  status: { fontSize: 13, fontWeight: '600' },
  statusOk: { color: '#43c47a' },
  statusWarn: { color: '#e8b04b' },
  guide: {
    color: '#c5ced8',
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: '#172230',
    borderRadius: 10,
    padding: 12,
  },
  bold: { color: '#fff', fontWeight: '700' },
  motion: { color: '#9aa5b1', fontSize: 13, fontVariant: ['tabular-nums'] },
  motionPct: { color: '#43c47a', fontWeight: '800' },
  zoneTools: { flexDirection: 'row', gap: 10 },
  zoneToolBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: '#1b2430',
  },
  zoneToolText: { color: '#c5ced8', fontWeight: '700', fontSize: 13 },
  sensRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sensLabel: { color: '#9aa5b1', fontSize: 13, fontWeight: '600' },
  sensBtns: { flexDirection: 'row', gap: 8 },
  sensBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9, backgroundColor: '#1b2430' },
  sensBtnActive: { backgroundColor: '#2d6cdf' },
  sensBtnText: { color: '#9aa5b1', fontWeight: '700', fontSize: 13 },
  sensBtnTextActive: { color: '#fff' },
  controls: { flexDirection: 'row', gap: 10 },
  ctrl: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  ctrlText: { color: '#fff', fontWeight: '700' },
  primary: { backgroundColor: '#2d6cdf' },
  armed: { backgroundColor: '#c0392b' },
  neutral: { backgroundColor: '#37414d' },
  stop: { backgroundColor: '#5a3030' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#11161d', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#7c8896', fontSize: 12, textAlign: 'center' },
  card: { backgroundColor: '#11161d', borderRadius: 12, padding: 14, gap: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  zoneList: { color: '#ffd23d', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dim: { color: '#7c8896', fontSize: 13 },
  footer: { color: '#5a6573', fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(214,40,40,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 100,
  },
  flashTitle: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 1 },
  flashZones: { color: '#fff', fontSize: 22, fontWeight: '700' },
  flashDismiss: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 },
});
