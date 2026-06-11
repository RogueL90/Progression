import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <PrimaryButton title={actionLabel} onPress={onAction} style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  title: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  message: {
    color: theme.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  button: {
    minWidth: 200,
  },
});
