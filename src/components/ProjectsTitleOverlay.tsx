import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import {
  isProjectDashboardPath,
  useProjectsTitleTransition,
  type ProjectsTitleMode,
  type ProjectsTitlePhase,
  type TitleLayout,
} from '@/context/ProjectsTitleTransition';
import { usePathname } from 'expo-router';

const TOOLBAR_HEIGHT = 44;
const CHEVRON_SIZE = 22;
const CHEVRON_GAP = 2;
const CHEVRON_SLOT = CHEVRON_SIZE + CHEVRON_GAP;
const LARGE_FONT = 32;
const SMALL_FONT = 17;
const TITLE_LINE = 44;
const ANIM_MS = 320;
const ANIM_EASING = Easing.out(Easing.cubic);

function fallbackSource(
  mode: ProjectsTitleMode,
  topInset: number
): TitleLayout {
  if (mode === 'small') {
    return {
      x: theme.spacing.lg,
      y: topInset + (TOOLBAR_HEIGHT - TITLE_LINE) / 2,
      width: 120,
      height: TITLE_LINE,
    };
  }
  return {
    x: theme.spacing.lg,
    y: topInset + TOOLBAR_HEIGHT,
    width: 180,
    height: TITLE_LINE,
  };
}

/**
 * Single progress axis: 0 = list source title, 1 = detail back-control slot.
 * Source layout is snapshotted once on push and reused on pop so list remeasures
 * can't teleport the glyph mid-animation.
 */
export function ProjectsTitleOverlay() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const {
    phase,
    mode,
    sourceLayout,
    goBackToProjects,
    notifyPushComplete,
    notifyPopComplete,
  } = useProjectsTitleTransition();

  const progress = useSharedValue(0);
  const visible = useSharedValue(0);

  const sourceX = useSharedValue<number>(theme.spacing.lg);
  const sourceY = useSharedValue(0);
  const sourceFont = useSharedValue(LARGE_FONT);
  const backX = useSharedValue<number>(theme.spacing.lg);
  const backY = useSharedValue(0);

  const prevPhaseRef = useRef<ProjectsTitlePhase>('idle');
  const frozenSourceRef = useRef<TitleLayout | null>(null);
  const frozenModeRef = useRef<ProjectsTitleMode>('large');
  /** Keep overlay mounted after pop until list titles have painted underneath. */
  const [handingOff, setHandingOff] = useState(false);
  const handingOffRef = useRef(false);

  const onDashboard = isProjectDashboardPath(pathname);

  const finishHandoff = useCallback(() => {
    visible.value = 0;
    progress.value = 0;
    frozenSourceRef.current = null;
    handingOffRef.current = false;
    setHandingOff(false);
  }, [progress, visible]);

  const beginHandoff = useCallback(() => {
    // Reveal list titles first while overlay still covers the same pixels.
    handingOffRef.current = true;
    setHandingOff(true);
    notifyPopComplete();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        finishHandoff();
      });
    });
  }, [finishHandoff, notifyPopComplete]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === phase) {
      return;
    }
    prevPhaseRef.current = phase;

    const nextBackY = insets.top + (TOOLBAR_HEIGHT - TITLE_LINE) / 2;
    const nextBackX = theme.spacing.lg;
    backX.value = nextBackX;
    backY.value = nextBackY;

    cancelAnimation(progress);

    if (phase === 'pushing') {
      handingOffRef.current = false;
      setHandingOff(false);
      const source = sourceLayout ?? fallbackSource(mode, insets.top);
      frozenSourceRef.current = source;
      frozenModeRef.current = mode;

      sourceX.value = source.x;
      sourceY.value = source.y;
      sourceFont.value = mode === 'large' ? LARGE_FONT : SMALL_FONT;

      visible.value = 1;
      progress.value = 0;
      progress.value = withTiming(
        1,
        { duration: ANIM_MS, easing: ANIM_EASING },
        (finished) => {
          if (finished) {
            runOnJS(notifyPushComplete)();
          }
        }
      );
      return;
    }

    if (phase === 'popping') {
      const source =
        frozenSourceRef.current ??
        sourceLayout ??
        fallbackSource(frozenModeRef.current, insets.top);
      const frozenMode = frozenModeRef.current;

      sourceX.value = source.x;
      sourceY.value = source.y;
      sourceFont.value = frozenMode === 'large' ? LARGE_FONT : SMALL_FONT;

      visible.value = 1;
      progress.value = withTiming(
        0,
        { duration: ANIM_MS, easing: ANIM_EASING },
        (finished) => {
          if (finished) {
            runOnJS(beginHandoff)();
          }
        }
      );
      return;
    }

    if (phase === 'onDetail') {
      if (prev !== 'pushing') {
        visible.value = 1;
        progress.value = 1;
      }
      return;
    }

    // idle
    if (prev === 'popping' || handingOffRef.current) {
      return;
    }
    visible.value = 0;
    progress.value = 0;
    frozenSourceRef.current = null;
    handingOffRef.current = false;
    setHandingOff(false);
  }, [
    phase,
    mode,
    sourceLayout,
    insets.top,
    backX,
    backY,
    beginHandoff,
    notifyPushComplete,
    progress,
    sourceFont,
    sourceX,
    sourceY,
    visible,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [sourceX.value, backX.value],
          Extrapolation.CLAMP
        ),
      },
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [sourceY.value, backY.value],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      progress.value,
      [0, 1],
      [sourceFont.value, SMALL_FONT],
      Extrapolation.CLAMP
    ),
    lineHeight: TITLE_LINE,
  }));

  const chevronSlotStyle = useAnimatedStyle(() => ({
    width: interpolate(
      progress.value,
      [0.15, 0.75],
      [0, CHEVRON_SLOT],
      Extrapolation.CLAMP
    ),
  }));

  const chevronOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.4, 0.9],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  // Never cover nested screens (timeline/capture/…). Popping may already be on tabs.
  const showOverlay =
    handingOff ||
    phase === 'popping' ||
    ((phase === 'pushing' || phase === 'onDetail') && onDashboard);

  if (!showOverlay) {
    return null;
  }

  const interactive = phase === 'onDetail' && onDashboard;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View
        style={[styles.row, containerStyle]}
        pointerEvents={interactive ? 'auto' : 'none'}
      >
        <Pressable
          disabled={!interactive}
          onPress={goBackToProjects}
          accessibilityRole="button"
          accessibilityLabel="Back to Projects"
          hitSlop={10}
          style={styles.pressable}
        >
          <Animated.View style={[styles.chevronSlot, chevronSlotStyle]}>
            <Animated.View style={chevronOpacityStyle}>
              <Ionicons
                name="chevron-back"
                size={CHEVRON_SIZE}
                color={theme.text}
              />
            </Animated.View>
          </Animated.View>
          <Animated.Text style={[styles.title, titleStyle]} numberOfLines={1}>
            Projects
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  row: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TITLE_LINE,
  },
  chevronSlot: {
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: TITLE_LINE,
  },
  title: {
    color: theme.text,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
