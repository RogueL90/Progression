import { Image, StyleSheet, View } from 'react-native';

type CaptureGhostOverlayProps = {
  uri: string;
};

export function CaptureGhostOverlay({ uri }: CaptureGhostOverlayProps) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
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
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.35,
  },
});
