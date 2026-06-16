import { StyleSheet, Text, View } from 'react-native';

import { getProjectTypeLabel } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import type { BackupManifest } from '@/types/backup';
import { formatDisplayDate } from '@/utils/date';

export type ImportPreviewCardProps = {
  manifest: BackupManifest;
  photoCount: number;
};

export function ImportPreviewCard({ manifest, photoCount }: ImportPreviewCardProps) {
  const exportedDate = manifest.exportedAt.slice(0, 10);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Project</Text>
      <Text style={styles.value}>{manifest.project.name}</Text>

      <Text style={styles.label}>Type</Text>
      <Text style={styles.value}>{getProjectTypeLabel(manifest.project.type)}</Text>

      <Text style={styles.label}>Photos</Text>
      <Text style={styles.value}>{photoCount}</Text>

      <Text style={styles.label}>Exported</Text>
      <Text style={styles.value}>{formatDisplayDate(exportedDate)}</Text>

      <Text style={styles.warning}>This will be imported as a new project.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.textMuted,
    fontSize: 13,
    marginTop: theme.spacing.sm,
  },
  value: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  warning: {
    color: theme.warning,
    fontSize: 14,
    marginTop: theme.spacing.md,
    lineHeight: 20,
  },
});
