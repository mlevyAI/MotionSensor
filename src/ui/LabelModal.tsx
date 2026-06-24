// Labeling UI: review a captured motion event and tag it allowed / not-allowed.
// For not-allowed, the user confirms which zones should be watched.
import React, { useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PendingCapture } from '../engine/useMotionEngine';
import { ZoneOverlay } from './ZoneOverlay';
import { Label } from '../labeling/types';

type Props = {
  pending: PendingCapture | null;
  onSave: (label: Label, watchedZones: number[]) => void;
  onDiscard: () => void;
};

const ACTIVE_ZONE_SCORE = 0.05;

export function LabelModal({ pending, onSave, onDiscard }: Props) {
  const visible = !!pending;
  const defaultSelected = useMemo(() => {
    if (!pending) return [];
    return pending.scores
      .map((s, z) => (s >= ACTIVE_ZONE_SCORE ? z : -1))
      .filter((z) => z >= 0);
  }, [pending]);

  const [selected, setSelected] = useState<number[]>(defaultSelected);
  const [keyId, setKeyId] = useState<number>(-1);

  // Reset selection when a new capture arrives.
  if (pending && pending.createdAt !== keyId) {
    setKeyId(pending.createdAt);
    setSelected(defaultSelected);
  }

  if (!pending) return null;

  const toggle = (z: number) =>
    setSelected((cur) => (cur.includes(z) ? cur.filter((x) => x !== z) : [...cur, z]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDiscard}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Label this movement</Text>

          <View style={styles.preview}>
            {pending.thumbnail ? (
              <Image source={{ uri: pending.thumbnail }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.noThumb]}>
                <Text style={styles.dim}>No thumbnail</Text>
              </View>
            )}
            <ZoneOverlay
              grid={pending.grid}
              scores={pending.scores}
              selectable
              selectedZones={selected}
              onToggleZone={toggle}
              showLabels
            />
          </View>

          <Text style={styles.hint}>
            Tap zones that should be watched (highlighted blue), then choose a label.
          </Text>

          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.allow]}
              onPress={() => onSave('allowed', [])}
            >
              <Text style={styles.btnText}>Allowed</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.deny]}
              onPress={() => onSave('not_allowed', selected)}
            >
              <Text style={styles.btnText}>Not allowed</Text>
            </Pressable>
          </View>

          <Pressable style={styles.discard} onPress={onDiscard}>
            <Text style={styles.dim}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#11161d',
    padding: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 12,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  preview: {
    aspectRatio: 4 / 3,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumb: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#9aa5b1', fontSize: 13 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  allow: { backgroundColor: '#1f8f4e' },
  deny: { backgroundColor: '#c0392b' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  discard: { alignSelf: 'center', paddingVertical: 8 },
  dim: { color: '#9aa5b1' },
});
