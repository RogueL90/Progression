import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type StatCardProps = {
  label: string;
  value: string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  value: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  label: {
    color: theme.textMuted,
    fontSize: 13,
  },
});
