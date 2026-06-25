import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { formatDisplayDate } from '@/utils/date';

type MetadataRecoveryCardProps = {
  snapshotCreatedAt: string;
  projectCount: number;
  photoCount: number;
  onRestoreLatest: () => void;
  onDismiss?: () => void;
};

export function MetadataRecoveryCard({
  snapshotCreatedAt,
  projectCount,
  photoCount,
  onRestoreLatest,
  onDismiss,
}: MetadataRecoveryCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Recovery snapshot found</Text>
      <Text style={styles.body}>
        Progression found a recent local metadata snapshot. It may help restore
        project and timeline organization if app metadata was damaged.
      </Text>
      <Text style={styles.date}>
        Snapshot: {formatDisplayDate(snapshotCreatedAt.slice(0, 10))}
      </Text>
      <Text style={styles.counts}>Projects: {projectCount}</Text>
      <Text style={styles.counts}>Photos: {photoCount}</Text>
      <Text style={styles.warning}>
        This restores project/photo organization only. It does not restore
        deleted image files.
      </Text>
      <PrimaryButton title="Restore Snapshot" onPress={onRestoreLatest} />
      {onDismiss ? (
        <PrimaryButton title="Not Now" variant="secondary" onPress={onDismiss} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  date: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  counts: {
    color: theme.textMuted,
    fontSize: 13,
  },
  warning: {
    color: theme.warning,
    fontSize: 13,
    lineHeight: 19,
  },
});
