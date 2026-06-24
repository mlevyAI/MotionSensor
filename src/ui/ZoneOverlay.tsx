// Grid overlay drawn on top of the camera preview. Each cell is tinted by its
// live motion score; watched zones get a highlighted border. Optionally the
// cells are tappable (used in the labeling modal to pick watched zones).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GridConfig } from '../detection/types';
import { zoneLabel } from '../detection/motion';
import { ZoneConfig } from '../labeling/types';

type Props = {
  grid: GridConfig;
  scores: number[];
  zoneConfig?: ZoneConfig | null;
  selectable?: boolean;
  selectedZones?: number[];
  triggeredZones?: number[];
  onToggleZone?: (zone: number) => void;
  showLabels?: boolean;
};

export function ZoneOverlay({
  grid,
  scores,
  zoneConfig,
  selectable,
  selectedZones,
  triggeredZones,
  onToggleZone,
  showLabels,
}: Props) {
  const rows = [];
  for (let r = 0; r < grid.rows; r++) {
    const cells = [];
    for (let c = 0; c < grid.cols; c++) {
      const z = r * grid.cols + c;
      const score = scores[z] ?? 0;
      const watched = zoneConfig?.watched[z] ?? false;
      const selected = selectedZones?.includes(z) ?? false;
      const triggered = triggeredZones?.includes(z) ?? false;

      const tint = `rgba(255, 60, 60, ${Math.min(0.7, score)})`;
      const borderColor = triggered
        ? '#ff2d2d'
        : selected
        ? '#3da5ff'
        : watched
        ? '#ffd23d'
        : 'rgba(255,255,255,0.18)';
      const borderWidth = triggered || selected || watched ? 2 : StyleSheet.hairlineWidth;

      cells.push(
        <Pressable
          key={z}
          disabled={!selectable}
          onPress={() => onToggleZone?.(z)}
          style={[styles.cell, { backgroundColor: tint, borderColor, borderWidth }]}
        >
          {showLabels ? (
            <Text style={styles.cellLabel}>
              {zoneLabel(z, grid)}
              {'\n'}
              {Math.round(score * 100)}
            </Text>
          ) : null}
        </Pressable>,
      );
    }
    rows.push(
      <View key={r} style={styles.row}>
        {cells}
      </View>,
    );
  }

  return <View style={styles.grid} pointerEvents={selectable ? 'auto' : 'none'}>{rows}</View>;
}

const styles = StyleSheet.create({
  grid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cellLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
