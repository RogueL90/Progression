import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/constants/theme';
import type { ProjectType } from '@/types/project';

export type ProjectTypeCardProps = {
  type: ProjectType;
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

export function ProjectTypeCard({
  label,
  description,
  selected,
  onPress,
}: ProjectTypeCardProps) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  cardSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.accentMuted,
  },
  label: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  labelSelected: {
    color: theme.text,
  },
  description: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
