import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { GridDensity } from '@/types/captureSettings';

type CaptureGridOverlayProps = {
  density: GridDensity;
};

export function CaptureGridOverlay({ density }: CaptureGridOverlayProps) {
  const { width, height } = useWindowDimensions();
  const divisions = density === 'few' ? 3 : 6;
  const verticalLines = Array.from({ length: divisions - 1 }, (_, index) => (index + 1) / divisions);
  const horizontalLines = verticalLines;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {verticalLines.map((fraction) => (
        <View
          key={`v-${fraction}`}
          style={[
            styles.line,
            {
              left: width * fraction - 0.5,
              top: 0,
              height,
              width: 1,
            },
          ]}
        />
      ))}
      {horizontalLines.map((fraction) => (
        <View
          key={`h-${fraction}`}
          style={[
            styles.line,
            {
              top: height * fraction - 0.5,
              left: 0,
              width,
              height: 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  line: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
