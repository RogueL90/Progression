import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type SettingsLinkRowProps = {
  label: string;
};

export function SettingsLinkRow({ label }: SettingsLinkRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={styles.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 52,
    opacity: 0.55,
  },
  label: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
  },
  icon: {
    opacity: 0.6,
  },
});
