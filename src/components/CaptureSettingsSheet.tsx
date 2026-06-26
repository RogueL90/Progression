import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { theme } from '@/constants/theme';
import type { CaptureSettings, GridDensity } from '@/types/captureSettings';

type CaptureSettingsSheetProps = {
  visible: boolean;
  settings: CaptureSettings;
  hasGhostPhoto: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<CaptureSettings>) => void;
};

const DENSITY_OPTIONS: { value: GridDensity; label: string }[] = [
  { value: 'few', label: 'Few' },
  { value: 'many', label: 'Many' },
];

export function CaptureSettingsSheet({
  visible,
  settings,
  hasGhostPhoto,
  onClose,
  onUpdate,
}: CaptureSettingsSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Capture settings</Text>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Show grid</Text>
              <Text style={styles.rowHint}>Overlay alignment lines on the camera</Text>
            </View>
            <Switch
              value={settings.showGrid}
              onValueChange={(showGrid) => onUpdate({ showGrid })}
              trackColor={{ false: theme.cardBorder, true: theme.accentMuted }}
              thumbColor={settings.showGrid ? theme.accent : theme.textMuted}
            />
          </View>

          {settings.showGrid && (
            <View style={styles.densitySection}>
              <Text style={styles.fieldLabel}>Grid density</Text>
              <View style={styles.segmentRow}>
                {DENSITY_OPTIONS.map((option) => {
                  const selected = settings.gridDensity === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.segment, selected && styles.segmentActive]}
                      onPress={() => onUpdate({ gridDensity: option.value })}
                    >
                      <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.densityHint}>
                {settings.gridDensity === 'few'
                  ? '3×3 rule-of-thirds grid'
                  : '6×6 dense grid'}
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Show previous photo ghost</Text>
              <Text style={styles.rowHint}>
                {hasGhostPhoto
                  ? 'Semi-transparent overlay of your latest photo for alignment'
                  : 'No previous photo yet'}
              </Text>
            </View>
            <Switch
              value={settings.showGhost}
              onValueChange={(showGhost) => onUpdate({ showGhost })}
              disabled={!hasGhostPhoto}
              trackColor={{ false: theme.cardBorder, true: theme.accentMuted }}
              thumbColor={settings.showGhost ? theme.accent : theme.textMuted}
            />
          </View>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: theme.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.cardBorder,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  rowLabel: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
  },
  rowHint: {
    color: theme.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: theme.spacing.xs,
  },
  densitySection: {
    gap: theme.spacing.xs,
    paddingLeft: theme.spacing.xs,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.background,
    alignItems: 'center',
  },
  segmentActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accentMuted,
  },
  segmentText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: theme.text,
  },
  densityHint: {
    color: theme.textMuted,
    fontSize: 12,
  },
  doneButton: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  doneButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
