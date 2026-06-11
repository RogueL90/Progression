import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { ProjectType } from '@/types/project';

type CaptureGuideOverlayProps = {
  projectType: ProjectType;
};

export function CaptureGuideOverlay({ projectType }: CaptureGuideOverlayProps) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.overlay} pointerEvents="none">
      {projectType === 'selfie' && (
        <>
          <View
            style={[
              styles.line,
              { left: width / 2 - 0.5, height: height * 0.7, top: height * 0.12, width: 1 },
            ]}
          />
          <View
            style={[
              styles.line,
              { top: height * 0.32, width: width * 0.7, left: width * 0.15, height: 1 },
            ]}
          />
          <View
            style={[
              styles.oval,
              {
                width: width * 0.65,
                height: height * 0.45,
                borderRadius: width * 0.325,
                top: height * 0.18,
                left: (width - width * 0.65) / 2,
              },
            ]}
          />
        </>
      )}

      {projectType === 'side_profile' && (
        <>
          <View
            style={[
              styles.line,
              { left: width / 2 - 0.5, height: height * 0.75, top: height * 0.1, width: 1 },
            ]}
          />
          <View
            style={[
              styles.oval,
              {
                width: width * 0.45,
                height: height * 0.5,
                borderRadius: width * 0.225,
                top: height * 0.16,
                left: (width - width * 0.45) / 2,
              },
            ]}
          />
        </>
      )}

      {projectType === 'plant_growth' && (
        <>
          <View
            style={[
              styles.box,
              {
                width: width * 0.7,
                height: height * 0.55,
                top: height * 0.15,
                left: (width - width * 0.7) / 2,
              },
            ]}
          />
          <View
            style={[
              styles.line,
              {
                top: height * 0.78,
                width: width * 0.8,
                left: width * 0.1,
                height: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
              },
            ]}
          />
        </>
      )}

      {projectType === 'other' && (
        <>
          {[1 / 3, 2 / 3].map((fraction) => (
            <View
              key={`v-${fraction}`}
              style={[
                styles.line,
                {
                  left: width * fraction - 0.5,
                  top: height * 0.1,
                  height: height * 0.8,
                  width: 1,
                },
              ]}
            />
          ))}
          {[1 / 3, 2 / 3].map((fraction) => (
            <View
              key={`h-${fraction}`}
              style={[
                styles.line,
                {
                  top: height * fraction,
                  left: width * 0.1,
                  width: width * 0.8,
                  height: 1,
                },
              ]}
            />
          ))}
        </>
      )}
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  oval: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'transparent',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'transparent',
  },
});
