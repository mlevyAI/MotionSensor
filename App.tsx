import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView } from './src/camera/CameraView';
import { CameraHandle, CameraStatus } from './src/camera/types';
import { DEFAULT_GRID } from './src/detection/types';
import { zoneLabel } from './src/detection/motion';
import { triggeringZones } from './src/labeling/thresholds';
import { useMotionEngine } from './src/engine/useMotionEngine';
import { ZoneOverlay } from './src/ui/ZoneOverlay';
import { LabelModal } from './src/ui/LabelModal';

const GRID = DEFAULT_GRID;

export default function App() {
  const engine = useMotionEngine(GRID);
  const cameraRef = useRef<CameraHandle>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [statusDetail, setStatusDetail] = useState<string | undefined>();

  // Let the engine pull thumbnails straight from the camera adapter.
  useEffect(() => {
    engine.registerThumbnailSource(() => cameraRef.current?.captureThumbnail() ?? null);
  }, [engine]);

  const start = async () => {
    await engine.primeAlert(); // unlock audio under this user gesture (iOS)
    setCameraOn(true);
  };

  const stop = () => {
    setCameraOn(false);
    engine.setMonitoring(false);
  };

  const watchedCount = engine.zoneConfig?.watched.filter(Boolean).length ?? 0;
  const liveTriggers = engine.zoneConfig
    ? triggeringZones(engine.scores, engine.zoneConfig)
    : [];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>MotionSensor</Text>
        <Text style={styles.sub}>On-device motion watch · web preview</Text>

        {/* Camera + overlay */}
        <View style={styles.stage}>
          {cameraOn ? (
            <>
              <CameraView
                ref={cameraRef}
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
                ⚠ NOT-ALLOWED motion · {engine.banner.zones.map((z) => zoneLabel(z, GRID)).join(', ')}
              </Text>
              <Pressable onPress={engine.clearBanner} style={styles.alertClear}>
                <Text style={styles.alertClearText}>dismiss</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <StatusLine status={status} detail={statusDetail} cameraOn={cameraOn} />

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
                onPress={() => engine.setMonitoring(!engine.monitoring)}
                disabled={watchedCount === 0}
              >
                <Text style={styles.ctrlText}>
                  {engine.monitoring ? 'Disarm' : watchedCount === 0 ? 'Label first' : 'Arm watch'}
                </Text>
              </Pressable>
              <Pressable style={[styles.ctrl, styles.neutral]} onPress={engine.captureNow}>
                <Text style={styles.ctrlText}>Capture</Text>
              </Pressable>
              <Pressable style={[styles.ctrl, styles.stop]} onPress={stop}>
                <Text style={styles.ctrlText}>Stop</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <Stat label="Examples" value={String(engine.examples.length)} />
          <Stat label="Watched zones" value={String(watchedCount)} />
          <Stat label="Peak zone" value={zoneLabel(engine.peakZone, GRID)} />
        </View>

        {/* Derived thresholds */}
        {watchedCount > 0 && engine.zoneConfig ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Derived alert thresholds</Text>
            {engine.zoneConfig.watched.map((w, z) =>
              w ? (
                <Text key={z} style={styles.thresholdRow}>
                  {zoneLabel(z, GRID)} → fires at ≥ {Math.round(engine.zoneConfig!.thresholds[z] * 100)}%
                  motion
                </Text>
              ) : null,
            )}
          </View>
        ) : null}

        {/* Examples */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Labeled examples</Text>
          {engine.examples.length === 0 ? (
            <Text style={styles.dim}>
              None yet. Move in front of the camera — a capture pops up to label, or tap Capture.
            </Text>
          ) : (
            engine.examples.map((ex) => (
              <View key={ex.id} style={styles.exRow}>
                {ex.thumbnail ? (
                  <Image source={{ uri: ex.thumbnail }} style={styles.exThumb} />
                ) : (
                  <View style={[styles.exThumb, styles.noThumb]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exLabel, ex.label === 'not_allowed' ? styles.deny : styles.allow]}>
                    {ex.label === 'not_allowed' ? 'NOT ALLOWED' : 'ALLOWED'}
                  </Text>
                  <Text style={styles.dim}>
                    peak {zoneLabel(ex.peakZone, GRID)}
                    {ex.watchedZones.length ? ` · watch ${ex.watchedZones.map((z) => zoneLabel(z, GRID)).join(',')}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => engine.removeExample(ex.id)} style={styles.del}>
                  <Text style={styles.delText}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          Foreground-only · all data stays on this device · web/PWA preview build
        </Text>
      </ScrollView>

      <LabelModal pending={engine.pending} onSave={engine.saveLabel} onDiscard={engine.discardPending} />
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
  controls: { flexDirection: 'row', gap: 10 },
  ctrl: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  ctrlText: { color: '#fff', fontWeight: '700' },
  primary: { backgroundColor: '#2d6cdf' },
  armed: { backgroundColor: '#c0392b' },
  neutral: { backgroundColor: '#37414d' },
  stop: { backgroundColor: '#5a3030' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#11161d', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#7c8896', fontSize: 12 },
  card: { backgroundColor: '#11161d', borderRadius: 12, padding: 14, gap: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  thresholdRow: { color: '#c5ced8', fontSize: 13, fontVariant: ['tabular-nums'] },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exThumb: { width: 56, height: 42, borderRadius: 6, backgroundColor: '#000' },
  noThumb: { backgroundColor: '#222' },
  exLabel: { fontWeight: '800', fontSize: 13 },
  allow: { color: '#43c47a' },
  deny: { color: '#ff6b5e' },
  del: { padding: 8 },
  delText: { color: '#7c8896', fontSize: 16 },
  dim: { color: '#7c8896', fontSize: 13 },
  footer: { color: '#5a6573', fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 24 },
});
