import { StyleSheet, Switch, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type ViewerOverlayTogglesProps = {
  showFace: boolean;
  showMesh: boolean;
  meshAvailable: boolean;
  onShowFaceChange: (value: boolean) => void;
  onShowMeshChange: (value: boolean) => void;
};

export function ViewerOverlayToggles({
  showFace,
  showMesh,
  meshAvailable,
  onShowFaceChange,
  onShowMeshChange,
}: ViewerOverlayTogglesProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Face</Text>
          <Text style={styles.rowHint}>Show the photo under the mesh</Text>
        </View>
        <Switch
          value={showFace}
          onValueChange={onShowFaceChange}
          trackColor={{ false: theme.cardBorder, true: theme.accentMuted }}
          thumbColor={showFace ? theme.accent : theme.textMuted}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Mesh</Text>
          <Text style={styles.rowHint}>
            {meshAvailable
              ? 'Show the saved face mesh overlay'
              : 'No face mesh for this photo'}
          </Text>
        </View>
        <Switch
          value={showMesh}
          onValueChange={onShowMeshChange}
          disabled={!meshAvailable}
          trackColor={{ false: theme.cardBorder, true: theme.accentMuted }}
          thumbColor={showMesh ? theme.accent : theme.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
  },
  rowHint: {
    color: theme.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.cardBorder,
  },
});
