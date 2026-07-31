import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { getProjectTypeLabel } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import type { Project } from '@/types/project';
import { formatDisplayDate } from '@/utils/date';

const ACTION_WIDTH = 80;
const ACTIONS_WIDTH = ACTION_WIDTH * 2;
/** Extra left travel past the open actions before delete consumes rename and commits. */
const OVERTAKE_DISTANCE = 28;
const FULL_SWIPE_THRESHOLD = ACTIONS_WIDTH + OVERTAKE_DISTANCE;

export type ProjectCardProps = {
  project: Project;
  totalPhotos: number;
  latestPhotoUri?: string;
  latestPhotoDate?: string;
  onPress: () => void;
  onRename: () => void;
  /** Called to confirm delete. Invoke `onCancel` if the user dismisses the confirm dialog. */
  onDelete: (onCancel: () => void) => void;
  onSwipeableOpen?: (ref: Swipeable) => void;
  /** When true, swipe actions are disabled and a drag handle is shown. */
  editing?: boolean;
  onDragStart?: (projectId: string) => void;
  onDragEnd?: (projectId: string, translationY: number, rowHeight: number) => void;
  onRowLayout?: (projectId: string, height: number) => void;
};

type RightActionsProps = {
  dragX: Animated.AnimatedInterpolation<number>;
  onRename: () => void;
  onDelete: () => void;
  onTranslationChange: (translationX: number) => void;
  onFullSwipeArmedChange: (armed: boolean) => void;
};

function RightActions({
  dragX,
  onRename,
  onDelete,
  onTranslationChange,
  onFullSwipeArmedChange,
}: RightActionsProps) {
  useEffect(() => {
    const id = dragX.addListener(({ value }) => {
      onTranslationChange(value);
      onFullSwipeArmedChange(Math.abs(value) >= FULL_SWIPE_THRESHOLD);
    });
    return () => {
      dragX.removeListener(id);
    };
  }, [dragX, onFullSwipeArmedChange, onTranslationChange]);

  // A short push past the open position grows delete across the whole action bar.
  const deleteWidth = dragX.interpolate({
    inputRange: [-(ACTIONS_WIDTH + OVERTAKE_DISTANCE), -ACTIONS_WIDTH, 0],
    outputRange: [ACTIONS_WIDTH + OVERTAKE_DISTANCE, ACTION_WIDTH, ACTION_WIDTH],
    extrapolate: 'clamp',
  });

  const renameOpacity = dragX.interpolate({
    inputRange: [
      -(ACTIONS_WIDTH + OVERTAKE_DISTANCE),
      -(ACTIONS_WIDTH + OVERTAKE_DISTANCE * 0.35),
      -ACTIONS_WIDTH,
      0,
    ],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.actionsRow}>
      <Animated.View style={[styles.renameAction, { opacity: renameOpacity }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rename project"
          onPress={onRename}
          style={styles.actionPressable}
        >
          <Ionicons name="pencil" size={22} color={theme.text} />
          <Text style={styles.renameLabel}>Rename</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.deleteAction, { width: deleteWidth }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete project"
          onPress={onDelete}
          style={styles.actionPressable}
        >
          <Ionicons name="trash" size={22} color={theme.text} />
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ProjectCardComponent({
  project,
  totalPhotos,
  latestPhotoUri,
  latestPhotoDate,
  onPress,
  onRename,
  onDelete,
  onSwipeableOpen,
  editing = false,
  onDragStart,
  onDragEnd,
  onRowLayout,
}: ProjectCardProps) {
  const swipeableRef = useRef<Swipeable | null>(null);
  const fullSwipeArmedRef = useRef(false);
  const deleteTriggeredRef = useRef(false);
  const awaitingDeleteConfirmRef = useRef(false);
  const lastTranslationRef = useRef(0);
  const rowHeightRef = useRef(96);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(0);

  useEffect(() => {
    if (editing) {
      swipeableRef.current?.close();
    }
  }, [editing]);

  const close = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  /** Animate closed from the current drag position (avoids a snap when mid-swipe). */
  const glideClosed = useCallback(() => {
    const row = swipeableRef.current;
    if (!row) {
      return;
    }
    const animateRow = (
      row as unknown as {
        animateRow: (fromValue: number, toValue: number, velocityX?: number) => void;
      }
    ).animateRow;
    if (typeof animateRow === 'function') {
      animateRow.call(row, lastTranslationRef.current, 0);
      return;
    }
    row.close();
  }, []);

  const finishDeletePrompt = useCallback(() => {
    awaitingDeleteConfirmRef.current = false;
    deleteTriggeredRef.current = false;
    fullSwipeArmedRef.current = false;
    setSwipeEnabled(true);
    close();
  }, [close]);

  const triggerDelete = useCallback(() => {
    if (deleteTriggeredRef.current || awaitingDeleteConfirmRef.current) {
      return;
    }
    deleteTriggeredRef.current = true;
    awaitingDeleteConfirmRef.current = true;
    fullSwipeArmedRef.current = false;
    // Stop the pan so the close spring isn't fighting the active gesture.
    setSwipeEnabled(false);
    requestAnimationFrame(() => {
      glideClosed();
    });
    onDelete(() => {
      finishDeletePrompt();
    });
  }, [finishDeletePrompt, glideClosed, onDelete]);

  const handleRename = useCallback(() => {
    close();
    onRename();
  }, [close, onRename]);

  const handleDelete = useCallback(() => {
    triggerDelete();
  }, [triggerDelete]);

  const onTranslationChange = useCallback((translationX: number) => {
    lastTranslationRef.current = translationX;
  }, []);

  const onFullSwipeArmedChange = useCallback(
    (armed: boolean) => {
      fullSwipeArmedRef.current = armed;
      if (armed) {
        triggerDelete();
      }
    },
    [triggerDelete]
  );

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => (
      <RightActions
        dragX={dragX}
        onRename={handleRename}
        onDelete={handleDelete}
        onTranslationChange={onTranslationChange}
        onFullSwipeArmedChange={onFullSwipeArmedChange}
      />
    ),
    [handleDelete, handleRename, onFullSwipeArmedChange, onTranslationChange]
  );

  const notifyDragStart = useCallback(() => {
    onDragStart?.(project.id);
  }, [onDragStart, project.id]);

  const notifyDragEnd = useCallback(
    (translationYValue: number) => {
      onDragEnd?.(project.id, translationYValue, rowHeightRef.current);
    },
    [onDragEnd, project.id]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(editing)
        .activeOffsetY([-4, 4])
        .onStart(() => {
          dragging.value = 1;
          runOnJS(notifyDragStart)();
        })
        .onUpdate((event) => {
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          runOnJS(notifyDragEnd)(event.translationY);
          translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
          dragging.value = 0;
        })
        .onFinalize(() => {
          translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
          dragging.value = 0;
        }),
    [dragging, editing, notifyDragEnd, notifyDragStart, translateY]
  );

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: dragging.value ? 20 : 0,
    elevation: dragging.value ? 8 : 0,
  }));

  const handleRowLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      rowHeightRef.current = height;
      onRowLayout?.(project.id, height);
    },
    [onRowLayout, project.id]
  );

  const cardBody = (
    <View style={styles.card}>
      <Pressable style={styles.cardMain} onPress={onPress} disabled={editing}>
        {latestPhotoUri ? (
          <Image source={{ uri: latestPhotoUri }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.placeholderText}>No photos</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{project.name}</Text>
          {project.type !== 'other' ? (
            <Text style={styles.type}>{getProjectTypeLabel(project.type)}</Text>
          ) : null}
          <Text style={styles.meta}>
            {totalPhotos} photo{totalPhotos === 1 ? '' : 's'}
            {latestPhotoDate ? ` · ${formatDisplayDate(latestPhotoDate)}` : ''}
          </Text>
        </View>
      </Pressable>
      {editing ? (
        <GestureDetector gesture={panGesture}>
          <Reanimated.View
            accessibilityRole="button"
            accessibilityLabel="Reorder project"
            style={styles.dragHandle}
          >
            <Ionicons name="reorder-three" size={28} color={theme.textMuted} />
          </Reanimated.View>
        </GestureDetector>
      ) : null}
    </View>
  );

  return (
    <Reanimated.View
      style={[styles.row, cardAnimatedStyle]}
      onLayout={handleRowLayout}
    >
      <Swipeable
        ref={swipeableRef}
        friction={1}
        rightThreshold={40}
        overshootRight
        overshootFriction={1}
        enabled={swipeEnabled && !editing}
        // JS-driven so drag listeners can arm full-swipe delete; avoids ReanimatedSwipeable scroll jank.
        useNativeAnimations={false}
        containerStyle={styles.swipeRoot}
        onSwipeableOpen={(direction, swipeable) => {
          if (awaitingDeleteConfirmRef.current) {
            // Gesture release can fight the close animation — keep gliding shut.
            glideClosed();
            return;
          }
          // Legacy Swipeable reports which side opened: right actions => 'right'.
          if (direction === 'right' || direction === 'left') {
            onSwipeableOpen?.(swipeable);
          }
          if (fullSwipeArmedRef.current) {
            triggerDelete();
          }
        }}
        onSwipeableClose={() => {
          fullSwipeArmedRef.current = false;
          if (!awaitingDeleteConfirmRef.current) {
            deleteTriggeredRef.current = false;
          }
        }}
        renderRightActions={editing ? undefined : renderRightActions}
      >
        {cardBody}
      </Swipeable>
    </Reanimated.View>
  );
}

export const ProjectCard = memo(ProjectCardComponent);

const styles = StyleSheet.create({
  row: {
    position: 'relative',
  },
  swipeRoot: {
    marginBottom: theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.cardBorder,
  },
  thumbnailPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: theme.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  info: {
    flex: 1,
    marginLeft: theme.spacing.md,
    marginRight: theme.spacing.sm,
  },
  dragHandle: {
    paddingLeft: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  type: {
    color: theme.accent,
    fontSize: 13,
    marginBottom: theme.spacing.xs,
  },
  meta: {
    color: theme.textMuted,
    fontSize: 13,
  },
  actionsRow: {
    width: ACTIONS_WIDTH,
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '100%',
  },
  renameAction: {
    width: ACTION_WIDTH,
    backgroundColor: '#6B7280',
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.danger,
    overflow: 'hidden',
  },
  actionPressable: {
    flex: 1,
    minWidth: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
  },
  renameLabel: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteLabel: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
