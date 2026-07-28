import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { EmptyState } from '@/components/EmptyState';
import { PhotoWithFaceMesh } from '@/components/PhotoWithFaceMesh';
import { ViewerOverlayToggles } from '@/components/ViewerOverlayToggles';
import { isFaceProjectType } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import { createTimelapseExport } from '@/data/timelapseExport';
import { useProject } from '@/hooks/useProject';
import { useProjectPhotos } from '@/hooks/useProjectPhotos';
import { type PlaybackMode, useTimelapse } from '@/hooks/useTimelapse';
import { formatDisplayDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { shareTimelapseFile } from '@/utils/share';

const MODES: { id: PlaybackMode; label: string }[] = [
  { id: 'timelapse', label: 'Timelapse' },
  { id: 'custom', label: 'Custom' },
];

const SPRING = {
  damping: 22,
  stiffness: 220,
  mass: 0.9,
};

/** Extra sheet travel past fully expanded — shrinks the video while dragging up. */
const OVERSCROLL_MAX = 0.9;
const OVERSCROLL_PIXELS = 260;
/** Higher = stronger resistance as you pull further up. */
const OVERSCROLL_RESISTANCE = 2.4;

function applySheetDrag(
  startProgress: number,
  translationY: number,
  height: number
): number {
  'worklet';
  const linear = startProgress - translationY / Math.max(height, 1);
  if (linear <= 1) {
    return Math.max(0, linear);
  }

  const excess = linear - 1;
  const resisted = OVERSCROLL_MAX * (1 - Math.exp(-OVERSCROLL_RESISTANCE * excess));
  return 1 + resisted;
}

function formatSeconds(value: number): string {
  if (value < 10) {
    return `${value.toFixed(1)}s`;
  }
  return `${Math.round(value)}s`;
}

export default function ProjectProgressScreen() {
  const navigation = useNavigation();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { project } = useProject(projectId);
  const { photos, loading, refreshPhotos } = useProjectPhotos(projectId);
  const {
    frames,
    currentPhoto,
    currentIndex,
    isPlaying,
    isAtEnd,
    mode,
    totalDuration,
    secondsPerPhoto,
    intervalMs,
    maxTotalDuration,
    minTotalDuration,
    minSecondsPerPhoto,
    maxSecondsPerPhoto,
    play,
    pause,
    seek,
    setMode,
    setTotalDuration,
    setSecondsPerPhoto,
  } = useTimelapse(photos);
  const [showFace, setShowFace] = useState(true);
  const [showMesh, setShowMesh] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportLabel, setExportLabel] = useState('Exporting…');

  // 1 = settings expanded (default), 0 = settings collapsed, >1 = upward overscroll
  const expandProgress = useSharedValue(1);
  const dragStartProgress = useSharedValue(1);
  const settingsHeightShared = useSharedValue(0);
  const hasMeasuredSettings = useSharedValue(false);
  const sheetGestureActive = useSharedValue(false);

  const isFaceProject = project ? isFaceProjectType(project.type) : false;
  const meshAvailable = useMemo(
    () => photos.some((photo) => Boolean(photo.faceMeshUri)),
    [photos]
  );
  const currentHasMesh = Boolean(currentPhoto?.faceMeshUri);
  const maxScrubIndex = Math.max(frames.length - 1, 0);
  const canShare = frames.length > 0 && !exporting && !loading;

  const playbackAction = useMemo(() => {
    if (isAtEnd && !isPlaying) {
      return {
        icon: 'refresh' as const,
        label: 'Restart',
        onPress: play,
      };
    }
    if (isPlaying) {
      return {
        icon: 'pause' as const,
        label: 'Pause',
        onPress: pause,
      };
    }
    return {
      icon: 'play' as const,
      label: 'Play',
      onPress: play,
    };
  }, [isAtEnd, isPlaying, pause, play]);

  const handleSettingsLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight <= 0) return;
      if (nextHeight > settingsHeightShared.value) {
        settingsHeightShared.value = nextHeight;
        hasMeasuredSettings.value = true;
      }
    },
    [hasMeasuredSettings, settingsHeightShared]
  );

  const sheetGesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(2)
        .activeOffsetY([-8, 8])
        .failOffsetX([-24, 24])
        .onBegin(() => {
          dragStartProgress.value = expandProgress.value;
          sheetGestureActive.value = true;
        })
        .onUpdate((event) => {
          const height = Math.max(settingsHeightShared.value, 1);
          expandProgress.value = applySheetDrag(
            dragStartProgress.value,
            event.translationY,
            height
          );
        })
        .onEnd((event) => {
          const height = Math.max(settingsHeightShared.value, 1);
          const velocityProgress = -event.velocityY / height;
          const current = expandProgress.value;

          // Overscroll always eases back — never reuse upward flick velocity.
          if (current > 1) {
            expandProgress.value = withTiming(1, {
              duration: 480,
              easing: Easing.out(Easing.cubic),
            });
            return;
          }

          const projected = current + velocityProgress * 0.18;
          const shouldCollapse =
            event.velocityY > 650 ||
            (event.velocityY < -650 ? false : projected < 0.5);

          expandProgress.value = withSpring(shouldCollapse ? 0 : 1, {
            ...SPRING,
            velocity: velocityProgress,
            overshootClamping: true,
          });
        })
        .onFinalize(() => {
          sheetGestureActive.value = false;
        }),
    [
      dragStartProgress,
      expandProgress,
      settingsHeightShared,
      sheetGestureActive,
    ]
  );

  const settingsAnimatedStyle = useAnimatedStyle(() => {
    if (!hasMeasuredSettings.value) {
      return {
        opacity: 1,
      };
    }

    const height = settingsHeightShared.value;
    const sheetProgress = Math.min(expandProgress.value, 1);
    return {
      height: height * sheetProgress,
      opacity: 0.35 + sheetProgress * 0.65,
      overflow: 'hidden' as const,
    };
  });

  const overscrollSpacerStyle = useAnimatedStyle(() => {
    const overscroll = Math.max(0, expandProgress.value - 1);
    return {
      height: (overscroll / OVERSCROLL_MAX) * OVERSCROLL_PIXELS,
    };
  });

  const sheetHitAreaStyle = useAnimatedStyle(() => {
    const coverBottom =
      sheetGestureActive.value && expandProgress.value >= 0.98;
    if (coverBottom) {
      return {
        ...StyleSheet.absoluteFillObject,
        zIndex: 20,
      };
    }

    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 40,
      zIndex: 20,
    };
  });

  const settingsAnimatedProps = useAnimatedProps(() => ({
    pointerEvents:
      expandProgress.value < 0.08 ? ('none' as const) : ('auto' as const),
  }));

  useFocusEffect(
    useCallback(() => {
      refreshPhotos();
    }, [refreshPhotos])
  );

  const handleSeek = useCallback(
    (value: number) => {
      if (isPlaying) {
        pause();
      }
      seek(value);
    },
    [isPlaying, pause, seek]
  );

  const handleShare = useCallback(async () => {
    if (exporting || frames.length === 0) return;

    if (isPlaying) {
      pause();
    }

    setExporting(true);
    setExportLabel('Exporting…');

    try {
      const uri = await createTimelapseExport({
        frames,
        intervalMs,
        onProgress: ({ current, total }) => {
          setExportLabel(`Exporting ${current}/${total}…`);
        },
      });

      setExportLabel('Opening share sheet…');
      await shareTimelapseFile(uri);
    } catch (error) {
      Alert.alert(
        'Share failed',
        getErrorMessage(error, 'Could not share this timelapse.')
      );
    } finally {
      setExporting(false);
      setExportLabel('Exporting…');
    }
  }, [exporting, frames, intervalMs, isPlaying, pause]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            void handleShare();
          }}
          disabled={!canShare}
          hitSlop={10}
          style={styles.headerShareButton}
          accessibilityRole="button"
          accessibilityLabel="Share timelapse"
        >
          {exporting ? (
            <ActivityIndicator color={theme.text} size="small" />
          ) : (
            <Ionicons
              name="share-outline"
              size={22}
              color={canShare ? theme.text : theme.textMuted}
            />
          )}
        </Pressable>
      ),
    });
  }, [canShare, exporting, handleShare, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        title="No photos yet"
        message="Take photos over time to watch your progress."
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.player}>
        <View style={styles.viewer}>
          {currentPhoto ? (
            isFaceProject ? (
              <PhotoWithFaceMesh
                photo={currentPhoto}
                showFace={showFace}
                showMesh={showMesh && currentHasMesh}
              />
            ) : (
              <Image
                source={{ uri: currentPhoto.uri }}
                style={styles.frame}
                resizeMode="contain"
              />
            )
          ) : (
            <View style={styles.framePlaceholder} />
          )}
        </View>

        <View style={styles.scrubberRow}>
          <Slider
            style={styles.scrubber}
            minimumValue={0}
            maximumValue={maxScrubIndex}
            step={1}
            value={currentIndex}
            onValueChange={handleSeek}
            minimumTrackTintColor={theme.accent}
            maximumTrackTintColor={theme.cardBorder}
            thumbTintColor={theme.accent}
            disabled={frames.length <= 1 || exporting}
          />
        </View>
      </View>

      <View style={styles.controlsSheet}>
        <GestureDetector gesture={sheetGesture}>
          <Animated.View
            style={sheetHitAreaStyle}
            accessibilityRole="adjustable"
            accessibilityLabel="Drag down to hide settings, or up to peek a smaller video"
          >
            <View style={styles.grabberHitArea}>
              <View style={styles.grabber} />
            </View>
          </Animated.View>
        </GestureDetector>

        <View style={styles.playbackRow}>
          <Text style={styles.dateLabel} numberOfLines={1}>
            {currentPhoto ? formatDisplayDate(currentPhoto.date) : '—'}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.playbackButton,
              pressed && !exporting && styles.playbackButtonPressed,
              exporting && styles.playbackButtonDisabled,
            ]}
            onPress={playbackAction.onPress}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={playbackAction.label}
          >
            <Ionicons name={playbackAction.icon} size={18} color={theme.text} />
            <Text style={styles.playbackButtonText}>{playbackAction.label}</Text>
          </Pressable>

          <Text style={styles.frameCounter} numberOfLines={1}>
            {frames.length > 0
              ? `${currentIndex + 1} of ${frames.length}`
              : '0 of 0'}
          </Text>
        </View>

        <Animated.View
          style={settingsAnimatedStyle}
          animatedProps={settingsAnimatedProps}
        >
          <View style={styles.settingsContent} onLayout={handleSettingsLayout}>
            {isFaceProject && (
              <View style={styles.toggles}>
                <ViewerOverlayToggles
                  showFace={showFace}
                  showMesh={showMesh}
                  meshAvailable={meshAvailable}
                  onShowFaceChange={setShowFace}
                  onShowMeshChange={setShowMesh}
                />
              </View>
            )}

            <View style={styles.modeRow}>
              <Text style={styles.sectionLabel}>Mode</Text>
              <View style={styles.modeOptions}>
                {MODES.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.modeButton,
                      mode === item.id && styles.modeButtonActive,
                    ]}
                    onPress={() => setMode(item.id)}
                    disabled={exporting}
                  >
                    <Text
                      style={[
                        styles.modeText,
                        mode === item.id && styles.modeTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {mode === 'timelapse' ? (
              <View style={styles.durationRow}>
                <View style={styles.durationHeader}>
                  <Text style={styles.sectionLabel}>Total length</Text>
                  <Text style={styles.durationValue}>
                    {formatSeconds(totalDuration)}
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={minTotalDuration}
                  maximumValue={maxTotalDuration}
                  step={0.1}
                  value={totalDuration}
                  onValueChange={setTotalDuration}
                  minimumTrackTintColor={theme.accent}
                  maximumTrackTintColor={theme.cardBorder}
                  thumbTintColor={theme.accent}
                  disabled={exporting}
                />
              </View>
            ) : (
              <View style={styles.durationRow}>
                <View style={styles.durationHeader}>
                  <Text style={styles.sectionLabel}>Seconds per photo</Text>
                  <Text style={styles.durationValue}>
                    {formatSeconds(secondsPerPhoto)}
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={minSecondsPerPhoto}
                  maximumValue={maxSecondsPerPhoto}
                  step={0.1}
                  value={secondsPerPhoto}
                  onValueChange={setSecondsPerPhoto}
                  minimumTrackTintColor={theme.accent}
                  maximumTrackTintColor={theme.cardBorder}
                  thumbTintColor={theme.accent}
                  disabled={exporting}
                />
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View style={overscrollSpacerStyle} />
      </View>

      {exporting && (
        <View style={styles.exportOverlay} pointerEvents="auto">
          <View style={styles.exportCard}>
            <ActivityIndicator color={theme.accent} size="large" />
            <Text style={styles.exportText}>{exportLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: theme.spacing.md,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  viewer: {
    flex: 1,
    backgroundColor: theme.card,
  },
  frame: {
    flex: 1,
    width: '100%',
  },
  framePlaceholder: {
    flex: 1,
    backgroundColor: theme.cardBorder,
  },
  scrubberRow: {
    backgroundColor: theme.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.cardBorder,
    paddingHorizontal: theme.spacing.xs,
    justifyContent: 'center',
    height: 28,
  },
  scrubber: {
    width: '100%',
    height: 28,
  },
  controlsSheet: {
    marginTop: theme.spacing.sm,
    position: 'relative',
  },
  grabberHitArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    height: 40,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.cardBorder,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: 40,
    marginBottom: theme.spacing.md,
  },
  dateLabel: {
    flex: 1,
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  frameCounter: {
    flex: 1,
    color: theme.textMuted,
    fontSize: 13,
    textAlign: 'right',
  },
  settingsContent: {
    paddingBottom: theme.spacing.xs,
  },
  toggles: {
    marginBottom: theme.spacing.md,
  },
  modeRow: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  modeOptions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.accent,
  },
  modeText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modeTextActive: {
    color: theme.text,
  },
  durationRow: {
    marginBottom: theme.spacing.sm,
  },
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationValue: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  playbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
    flexShrink: 0,
  },
  playbackButtonPressed: {
    opacity: 0.85,
  },
  playbackButtonDisabled: {
    opacity: 0.5,
  },
  playbackButtonText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  headerShareButton: {
    paddingHorizontal: theme.spacing.xs,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  exportCard: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
    minWidth: 220,
  },
  exportText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});
