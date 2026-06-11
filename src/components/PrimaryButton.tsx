import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/constants/theme';

type PrimaryButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  ...props
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={theme.text} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primary: {
    backgroundColor: theme.accent,
  },
  secondary: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  danger: {
    backgroundColor: theme.danger,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
});
