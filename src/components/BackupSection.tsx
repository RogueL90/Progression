import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import type { Project } from '@/types/project';
import { formatDisplayDate } from '@/utils/date';

type BackupSectionProps = {
  project: Project;
  backingUp: boolean;
  onBackup: () => void;
};

export function BackupSection({ project, backingUp, onBackup }: BackupSectionProps) {
  const lastBackedUpLabel = project.lastBackedUpAt
    ? formatDisplayDate(project.lastBackedUpAt.slice(0, 10))
    : 'Never';

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Backup & Restore</Text>
      <Text style={styles.description}>
        Create a portable backup of this project, including its photos and timeline data.
      </Text>
      <Text style={styles.lastBackedUp}>Last backed up: {lastBackedUpLabel}</Text>
      <PrimaryButton
        title={backingUp ? 'Creating backup...' : 'Backup Project'}
        onPress={onBackup}
        loading={backingUp}
        disabled={backingUp}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  lastBackedUp: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: theme.spacing.xs,
  },
});
