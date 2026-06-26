import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/constants/theme';

type CaptureShutterButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function CaptureShutterButton({
  onPress,
  disabled = false,
  loading = false,
}: CaptureShutterButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? 'Saving photo' : 'Take photo'}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.outerRing,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.background} size="small" />
      ) : (
        <View style={[styles.innerCircle, isDisabled && styles.innerDisabled]} />
      )}
    </Pressable>
  );
}

const OUTER_SIZE = 72;
const INNER_SIZE = 60;

const styles = StyleSheet.create({
  outerRing: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    borderRadius: OUTER_SIZE / 2,
    borderWidth: 4,
    borderColor: theme.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  innerCircle: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    backgroundColor: theme.text,
  },
  innerDisabled: {
    backgroundColor: theme.textMuted,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
