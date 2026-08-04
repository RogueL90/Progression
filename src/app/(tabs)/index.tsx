import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Swipeable from 'react-native-gesture-handler/Swipeable';

import { EmptyState } from '@/components/EmptyState';
import { ImportPreviewCard } from '@/components/ImportPreviewCard';
import { MetadataRecoveryCard } from '@/components/MetadataRecoveryCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProjectCard } from '@/components/ProjectCard';
import { theme } from '@/constants/theme';
import { useProjectsTitleTransition } from '@/context/ProjectsTitleTransition';
import { rememberProjectName } from '@/data/projectNameCache';
import { importProjectBackup, validateBackupZip } from '@/data/backupService';
import { getMetadataHealth } from '@/data/metadataHealth';
import {
  getBestRecoverableSnapshot,
  getLatestSnapshotFileHealth,
  hasRecoverableMetadataSnapshot,
  restoreMetadataFromBestSnapshot,
} from '@/data/metadataSnapshotService';
import {
  deleteProject,
  getAllProjects,
  reorderProjects,
  updateProject,
} from '@/data/projectStorage';
import { getStatsForProject } from '@/data/stats';
import type { BackupManifest } from '@/types/backup';
import type { Project } from '@/types/project';
import { pickBackupZipFile } from '@/utils/documentPicker';
import { getErrorMessage } from '@/utils/errors';

type ProjectListItem = Project & {
  totalPhotos: number;
  latestPhotoUri?: string;
  latestPhotoDate?: string;
};

const ProjectListRow = memo(function ProjectListRow({
  item,
  onPress,
  onRename,
  onDelete,
  onSwipeableOpen,
  editing,
  dragging,
  slotShiftY,
  onDragStart,
  onDragMove,
  onDragEnd,
  onRowLayout,
}: {
  item: ProjectListItem;
  onPress: (item: ProjectListItem) => void;
  onRename: (item: ProjectListItem) => void;
  onDelete: (item: ProjectListItem, onCancel: () => void) => void;
  onSwipeableOpen: (ref: Swipeable) => void;
  editing: boolean;
  dragging?: boolean;
  slotShiftY?: number;
  onDragStart?: (projectId: string) => void;
  onDragMove?: (projectId: string, translationY: number, rowHeight: number) => void;
  onDragEnd?: (projectId: string, translationY: number, rowHeight: number) => void;
  onRowLayout?: (projectId: string, height: number) => void;
}) {
  return (
    <ProjectCard
      project={item}
      totalPhotos={item.totalPhotos}
      latestPhotoUri={item.latestPhotoUri}
      latestPhotoDate={item.latestPhotoDate}
      onPress={() => onPress(item)}
      onRename={() => onRename(item)}
      onDelete={(onCancel) => onDelete(item, onCancel)}
      onSwipeableOpen={onSwipeableOpen}
      editing={editing}
      dragging={dragging}
      slotShiftY={slotShiftY}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onRowLayout={onRowLayout}
    />
  );
});

function getSlotShiftY(
  index: number,
  dragStartIndex: number | null,
  hoverIndex: number | null,
  rowHeight: number
): number {
  if (dragStartIndex === null || hoverIndex === null || dragStartIndex === hoverIndex) {
    return 0;
  }

  if (dragStartIndex < hoverIndex) {
    // Dragging down: rows between start and hover move up to fill the gap.
    if (index > dragStartIndex && index <= hoverIndex) {
      return -rowHeight;
    }
  } else if (index >= hoverIndex && index < dragStartIndex) {
    // Dragging up: rows between hover and start move down.
    return rowHeight;
  }

  return 0;
}

type RecoveryInfo = {
  snapshotCreatedAt: string;
  projectCount: number;
  photoCount: number;
};

/** Search box collapses after list content below it has scrolled, then the large title collapses. */
const SEARCH_HEIGHT = 44;
const SEARCH_MARGIN = theme.spacing.md;
const SEARCH_BOX_COLLAPSE_DISTANCE = SEARCH_HEIGHT + SEARCH_MARGIN;
/** Text finishes fading before the box shrinks below this height. */
const SEARCH_TEXT_MIN_HEIGHT = 28;

/** After search is gone, large title scrolls away into the toolbar. */
const TITLE_HEIGHT = 44;
const TITLE_MARGIN = theme.spacing.md;
const TITLE_COLLAPSE_DISTANCE = TITLE_HEIGHT + TITLE_MARGIN;

const EXPANDED_HEADER_HEIGHT = SEARCH_BOX_COLLAPSE_DISTANCE + TITLE_COLLAPSE_DISTANCE;

/** Pull-down overscroll: title scales up to this, over this many points of pull. */
const TITLE_MAX_SCALE = 1.1;
const OVERSCROLL_SCALE_DISTANCE = 140;

export default function ProjectListScreen() {
  const router = useRouter();
  const {
    titlesHidden,
    openProject,
    registerLargeLayout,
    registerSmallLayout,
    setTitleMode,
    resetToIdle,
  } = useProjectsTitleTransition();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [pendingZipUri, setPendingZipUri] = useState<string | null>(null);
  const [pendingManifest, setPendingManifest] = useState<BackupManifest | null>(null);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);
  const [showRecoveryCard, setShowRecoveryCard] = useState(true);
  const [restoringSnapshot, setRestoringSnapshot] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollIndicatorTop, setScrollIndicatorTop] = useState(EXPANDED_HEADER_HEIGHT);
  const [renameTarget, setRenameTarget] = useState<ProjectListItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);
  const contentPassHeightRef = useRef(0);
  const openSwipeableRef = useRef<Swipeable | null>(null);
  const rowHeightsRef = useRef<Record<string, number>>({});
  const dragStartIndexRef = useRef(-1);
  const hoverIndexRef = useRef(-1);
  const itemsRef = useRef<ProjectListItem[]>([]);
  const largeTitleMeasureRef = useRef<View>(null);
  const smallTitleMeasureRef = useRef<View>(null);
  const titleModeRef = useRef<'large' | 'small'>('large');
  const scrollY = useSharedValue(0);
  /** List content below the search can scroll this far before search starts collapsing. */
  const contentScrollBeforeSearch = useSharedValue(0);

  itemsRef.current = items;

  const updateScrollIndicatorInset = useCallback((offsetY: number, contentPass: number) => {
    if (offsetY < 0) {
      // Keep the indicator below the pulled-down header; the track shrinks as you overscroll.
      const next = EXPANDED_HEADER_HEIGHT + Math.round(-offsetY);
      setScrollIndicatorTop((prev) => (prev === next ? prev : next));
      return;
    }

    const searchStart = contentPass;
    const searchEnd = contentPass + SEARCH_BOX_COLLAPSE_DISTANCE;
    const titleEnd = searchEnd + TITLE_COLLAPSE_DISTANCE;

    let searchHeight = SEARCH_BOX_COLLAPSE_DISTANCE;
    if (offsetY >= searchEnd) {
      searchHeight = 0;
    } else if (offsetY > searchStart) {
      searchHeight =
        SEARCH_BOX_COLLAPSE_DISTANCE *
        (1 - (offsetY - searchStart) / SEARCH_BOX_COLLAPSE_DISTANCE);
    }

    let titleHeight = TITLE_COLLAPSE_DISTANCE;
    if (offsetY >= titleEnd) {
      titleHeight = 0;
    } else if (offsetY > searchEnd) {
      titleHeight =
        TITLE_COLLAPSE_DISTANCE * (1 - (offsetY - searchEnd) / TITLE_COLLAPSE_DISTANCE);
    }

    const next = Math.max(0, Math.round(searchHeight + titleHeight));
    setScrollIndicatorTop((prev) => (prev === next ? prev : next));
  }, []);

  const loadItems = useCallback(async () => {
    const showLoading = !hasLoadedRef.current;
    if (showLoading) {
      setLoading(true);
    }

    try {
      let projects = await getAllProjects();

      // If the list was wiped, recover from the best local snapshot automatically.
      if (projects.length === 0) {
        const snapshot = await getBestRecoverableSnapshot();
        if (snapshot && snapshot.projects.length > 0) {
          try {
            await restoreMetadataFromBestSnapshot();
            projects = await getAllProjects();
          } catch {
            // Fall through to empty list + recovery card.
          }
        }
      }

      const enriched = await Promise.all(
        projects.map(async (project) => {
          try {
            const stats = await getStatsForProject(project.id);
            return {
              ...project,
              totalPhotos: stats.totalPhotos,
              latestPhotoUri: project.coverPhotoUri,
              latestPhotoDate: stats.latestPhotoDate ?? undefined,
            };
          } catch {
            return {
              ...project,
              totalPhotos: 0,
              latestPhotoUri: project.coverPhotoUri,
              latestPhotoDate: undefined,
            };
          }
        })
      );
      setItems(enriched);

      const [metadataHealth, recoverable] = await Promise.all([
        getMetadataHealth(),
        hasRecoverableMetadataSnapshot(),
      ]);

      if (
        recoverable &&
        (enriched.length === 0 ||
          metadataHealth.projectsCorrupted ||
          metadataHealth.photosCorrupted)
      ) {
        const snapshotInfo = await getLatestSnapshotFileHealth();
        if (snapshotInfo.createdAt && snapshotInfo.projectCount > 0) {
          setRecoveryInfo({
            snapshotCreatedAt: snapshotInfo.createdAt,
            projectCount: snapshotInfo.projectCount,
            photoCount: snapshotInfo.photoCount,
          });
        } else {
          setRecoveryInfo(null);
        }
      } else {
        setRecoveryInfo(null);
      }

      hasLoadedRef.current = true;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetToIdle();
      void loadItems();
      return () => {
        setEditing(false);
      };
    }, [loadItems, resetToIdle])
  );

  useEffect(() => {
    if (editing && items.length === 0) {
      setEditing(false);
    }
  }, [editing, items.length]);

  const resetImportPreview = () => {
    setPreviewVisible(false);
    setPendingZipUri(null);
    setPendingManifest(null);
    setPendingPhotoCount(0);
  };

  const handleImportBackup = async () => {
    try {
      const zipUri = await pickBackupZipFile();
      if (!zipUri) {
        return;
      }

      setValidating(true);
      const validation = await validateBackupZip(zipUri);
      setValidating(false);

      if (!validation.valid || !validation.manifest) {
        Alert.alert(
          'Invalid backup',
          validation.errors[0] ?? 'This does not look like a valid Progression backup.'
        );
        return;
      }

      setPendingZipUri(zipUri);
      setPendingManifest(validation.manifest);
      setPendingPhotoCount(validation.photoCount ?? validation.manifest.photos.length);
      setPreviewVisible(true);
    } catch (error) {
      setValidating(false);
      Alert.alert(
        'Import failed',
        getErrorMessage(error, 'Could not import this backup.')
      );
    }
  };

  const confirmImport = async () => {
    if (!pendingZipUri) {
      return;
    }

    try {
      setImporting(true);
      const importedProject = await importProjectBackup(pendingZipUri);
      resetImportPreview();
      await loadItems();
      Alert.alert('Import complete', 'Project imported successfully.');
      router.push(`/projects/${importedProject.id}`);
    } catch (error) {
      Alert.alert(
        'Import failed',
        getErrorMessage(error, 'Could not import this backup.')
      );
    } finally {
      setImporting(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    try {
      setRestoringSnapshot(true);
      await restoreMetadataFromBestSnapshot();
      setShowRecoveryCard(false);
      await loadItems();
      Alert.alert('Restore complete', 'Metadata restored from local snapshot.');
    } catch (error) {
      Alert.alert(
        'Restore failed',
        error instanceof Error ? error.message : 'Could not restore this snapshot.'
      );
    } finally {
      setRestoringSnapshot(false);
    }
  };

  const handleRenameProject = useCallback((item: ProjectListItem) => {
    setRenameTarget(item);
    setRenameValue(item.name);
  }, []);

  const confirmRenameProject = async () => {
    if (!renameTarget) {
      return;
    }

    const nextName = renameValue.trim();
    if (!nextName) {
      Alert.alert('Name required', 'Project name cannot be empty.');
      return;
    }

    try {
      setRenaming(true);
      await updateProject(renameTarget.id, { name: nextName });
      setRenameTarget(null);
      setRenameValue('');
      await loadItems();
    } catch (error) {
      Alert.alert(
        'Rename failed',
        getErrorMessage(error, 'Could not rename this project.')
      );
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteProject = useCallback(
    (item: ProjectListItem, onCancel: () => void) => {
      Alert.alert(
        'Delete this project?',
        'This will delete the project and all of its photos from this device.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: onCancel,
          },
          {
            text: 'Delete Project',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await deleteProject(item.id);
                  await loadItems();
                } catch (error) {
                  onCancel();
                  Alert.alert(
                    'Delete failed',
                    getErrorMessage(error, 'Could not delete this project.')
                  );
                }
              })();
            },
          },
        ],
        { cancelable: true, onDismiss: onCancel }
      );
    },
    [loadItems]
  );

  const handleSwipeableOpen = useCallback((ref: Swipeable) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  }, []);

  const handleRowLayout = useCallback((projectId: string, height: number) => {
    rowHeightsRef.current[projectId] = height;
  }, []);

  const clearDragState = useCallback(() => {
    setDraggingId(null);
    setDragStartIndex(null);
    setHoverIndex(null);
    dragStartIndexRef.current = -1;
    hoverIndexRef.current = -1;
    setListScrollEnabled(true);
  }, []);

  const toggleEditing = useCallback(() => {
    setEditing((prev) => {
      const next = !prev;
      if (next) {
        openSwipeableRef.current?.close();
        openSwipeableRef.current = null;
        setSearchQuery('');
      } else {
        clearDragState();
      }
      return next;
    });
  }, [clearDragState]);

  const handleDragStart = useCallback((projectId: string) => {
    const index = itemsRef.current.findIndex((item) => item.id === projectId);
    if (index < 0) {
      return;
    }
    dragStartIndexRef.current = index;
    hoverIndexRef.current = index;
    setDraggingId(projectId);
    setDragStartIndex(index);
    setHoverIndex(index);
    setListScrollEnabled(false);
  }, []);

  const handleDragMove = useCallback(
    (projectId: string, translationY: number, rowHeight: number) => {
      const startIndex = dragStartIndexRef.current;
      if (startIndex < 0) {
        return;
      }

      const measuredHeight = rowHeightsRef.current[projectId] || rowHeight || 96;
      const targetIndex = Math.max(
        0,
        Math.min(
          itemsRef.current.length - 1,
          startIndex + Math.round(translationY / measuredHeight)
        )
      );

      if (targetIndex !== hoverIndexRef.current) {
        hoverIndexRef.current = targetIndex;
        setHoverIndex(targetIndex);
      }
    },
    []
  );

  const handleItemDragEnd = useCallback(
    async (projectId: string, _translationY: number, _rowHeight: number) => {
      const fromIndex = dragStartIndexRef.current;
      const toIndex = hoverIndexRef.current;
      clearDragState();

      if (!editing || fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return;
      }

      const previous = itemsRef.current;
      if (
        fromIndex >= previous.length ||
        previous[fromIndex]?.id !== projectId
      ) {
        return;
      }

      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setItems(next);

      try {
        await reorderProjects(next.map((item) => item.id));
      } catch (error) {
        setItems(previous);
        Alert.alert(
          'Reorder failed',
          getErrorMessage(error, 'Could not save the new project order.')
        );
      }
    },
    [clearDragState, editing]
  );

  const handleOpenProject = useCallback(
    (item: ProjectListItem) => {
      if (editing) {
        return;
      }

      const mode = titleModeRef.current;
      setTitleMode(mode);
      rememberProjectName(item.id, item.name);
      const measureRef =
        mode === 'small' ? smallTitleMeasureRef : largeTitleMeasureRef;

      const push = () => openProject(item.id);

      if (!measureRef.current) {
        push();
        return;
      }

      measureRef.current.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          const layout = { x, y, width, height };
          if (mode === 'small') {
            registerSmallLayout(layout);
          } else {
            registerLargeLayout(layout);
          }
        }
        push();
      });
    },
    [
      editing,
      openProject,
      registerLargeLayout,
      registerSmallLayout,
      setTitleMode,
    ]
  );

  const dragRowHeight =
    (draggingId ? rowHeightsRef.current[draggingId] : undefined) ?? 96;

  const renderProjectItem = useCallback<ListRenderItem<ProjectListItem>>(
    ({ item, index }) => (
      <ProjectListRow
        item={item}
        onPress={handleOpenProject}
        onRename={handleRenameProject}
        onDelete={handleDeleteProject}
        onSwipeableOpen={handleSwipeableOpen}
        editing={editing}
        dragging={item.id === draggingId}
        slotShiftY={
          item.id === draggingId
            ? 0
            : getSlotShiftY(index, dragStartIndex, hoverIndex, dragRowHeight)
        }
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleItemDragEnd}
        onRowLayout={handleRowLayout}
      />
    ),
    [
      dragRowHeight,
      dragStartIndex,
      draggingId,
      editing,
      handleDeleteProject,
      handleDragMove,
      handleDragStart,
      handleItemDragEnd,
      handleOpenProject,
      handleRenameProject,
      handleRowLayout,
      handleSwipeableOpen,
      hoverIndex,
    ]
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollY.value = offsetY;
    updateScrollIndicatorInset(offsetY, contentPassHeightRef.current);

    // Don't update mode while the overlay owns the title — avoids mid-transition churn.
    if (titlesHidden) {
      return;
    }

    const searchEnd =
      contentPassHeightRef.current + SEARCH_BOX_COLLAPSE_DISTANCE;
    // Match when the small toolbar title is mostly visible.
    const nextMode =
      offsetY >= searchEnd + TITLE_COLLAPSE_DISTANCE * 0.65 ? 'small' : 'large';
    if (titleModeRef.current !== nextMode) {
      titleModeRef.current = nextMode;
      setTitleMode(nextMode);
    }
  };

  const collapsingHeaderStyle = useAnimatedStyle(() => {
    // Pull the header down with top overscroll; native bounce returns it on release.
    const pull = Math.max(-scrollY.value, 0);
    return {
      transform: [{ translateY: pull }],
    };
  });

  const largeTitleClipStyle = useAnimatedStyle(() => {
    const searchEnd =
      contentScrollBeforeSearch.value + SEARCH_BOX_COLLAPSE_DISTANCE;
    const pull = Math.max(-scrollY.value, 0);

    // Shrink layout space 1:1 with scroll. Keep height fixed while overscrolling
    // so scaling Projects doesn't change the gap above the search bar.
    const collapsedHeight = interpolate(
      scrollY.value,
      [searchEnd, searchEnd + TITLE_COLLAPSE_DISTANCE],
      [TITLE_COLLAPSE_DISTANCE, 0],
      Extrapolation.CLAMP
    );

    return {
      height: pull > 0 ? TITLE_COLLAPSE_DISTANCE : collapsedHeight,
      overflow: pull > 0 ? ('visible' as const) : ('hidden' as const),
    };
  });

  const largeTitleStyle = useAnimatedStyle(() => {
    const searchEnd =
      contentScrollBeforeSearch.value + SEARCH_BOX_COLLAPSE_DISTANCE;
    // Move the title up 1:1 with scroll so it stays in sync with list content.
    const scrolled = interpolate(
      scrollY.value,
      [searchEnd, searchEnd + TITLE_COLLAPSE_DISTANCE],
      [0, TITLE_COLLAPSE_DISTANCE],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY: -scrolled }],
    };
  });

  const largeTitleScaleStyle = useAnimatedStyle(() => {
    const pull = Math.max(-scrollY.value, 0);
    const scale = interpolate(
      pull,
      [0, OVERSCROLL_SCALE_DISTANCE],
      [1, TITLE_MAX_SCALE],
      Extrapolation.CLAMP
    );

    // Scale upward from the bottom edge so spacing above the search bar stays fixed.
    return {
      transform: [{ scale }],
      transformOrigin: 'left bottom',
    };
  });

  const searchBarStyle = useAnimatedStyle(() => {
    const contentEnd = contentScrollBeforeSearch.value;
    const boxEnd = contentEnd + SEARCH_BOX_COLLAPSE_DISTANCE;

    const collapse = interpolate(
      scrollY.value,
      [contentEnd, boxEnd],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      height: interpolate(collapse, [0, 1], [SEARCH_HEIGHT, 0], Extrapolation.CLAMP),
      marginBottom: interpolate(collapse, [0, 1], [SEARCH_MARGIN, 0], Extrapolation.CLAMP),
      overflow: 'hidden' as const,
    };
  });

  const searchContentStyle = useAnimatedStyle(() => {
    const contentEnd = contentScrollBeforeSearch.value;
    const boxEnd = contentEnd + SEARCH_BOX_COLLAPSE_DISTANCE;
    const collapse = interpolate(
      scrollY.value,
      [contentEnd, boxEnd],
      [0, 1],
      Extrapolation.CLAMP
    );
    const boxHeight = interpolate(
      collapse,
      [0, 1],
      [SEARCH_HEIGHT, 0],
      Extrapolation.CLAMP
    );

    // Fade text out while the box is still tall enough to hold it.
    return {
      opacity: interpolate(
        boxHeight,
        [SEARCH_HEIGHT, SEARCH_TEXT_MIN_HEIGHT],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  });

  const smallTitleStyle = useAnimatedStyle(() => {
    const searchEnd = contentScrollBeforeSearch.value + SEARCH_BOX_COLLAPSE_DISTANCE;
    return {
      opacity: interpolate(
        scrollY.value,
        [searchEnd + TITLE_COLLAPSE_DISTANCE * 0.35, searchEnd + TITLE_COLLAPSE_DISTANCE],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  const importDisabled = validating || importing || editing;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems =
    editing || !normalizedQuery
      ? items
      : items.filter((item) => item.name.toLowerCase().includes(normalizedQuery));

  const listHeader = (
    <View
      style={styles.listHeader}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        contentPassHeightRef.current = height;
        contentScrollBeforeSearch.value = height;
      }}
    >
      <Text style={styles.subtitle}>Track visual progress over time.</Text>
      <Text style={styles.privacy}>Your photos stay on this device.</Text>
      {showRecoveryCard && recoveryInfo ? (
        <MetadataRecoveryCard
          snapshotCreatedAt={recoveryInfo.snapshotCreatedAt}
          projectCount={recoveryInfo.projectCount}
          photoCount={recoveryInfo.photoCount}
          onRestoreLatest={() => {
            void handleRestoreSnapshot();
          }}
          onDismiss={() => setShowRecoveryCard(false)}
        />
      ) : null}
      {restoringSnapshot ? (
        <ActivityIndicator color={theme.accent} style={styles.restoreSpinner} />
      ) : null}
    </View>
  );

  const listEmpty = loading ? (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.accent} size="large" />
    </View>
  ) : items.length === 0 ? (
    <EmptyState
      title="No projects yet"
      message="Create your first progress project to start tracking change over time."
    />
  ) : (
    <EmptyState
      title="No matching projects"
      message="Try a different search term."
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.toolbar}>
        <View
          ref={smallTitleMeasureRef}
          style={[styles.smallTitleMeasure, titlesHidden && styles.titleHidden]}
          pointerEvents="none"
          collapsable={false}
        >
          <Animated.Text
            style={[styles.smallTitle, smallTitleStyle]}
            numberOfLines={1}
          >
            Projects
          </Animated.Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              void handleImportBackup();
            }}
            disabled={importDisabled}
            hitSlop={10}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel="Import backup"
          >
            {validating ? (
              <ActivityIndicator color={theme.text} size="small" />
            ) : (
              <Ionicons
                name="cloud-upload-outline"
                size={24}
                color={importDisabled ? theme.textMuted : theme.text}
              />
            )}
          </Pressable>
          <Pressable
            onPress={toggleEditing}
            hitSlop={10}
            style={styles.editButton}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Done editing' : 'Edit'}
            disabled={loading || items.length === 0}
          >
            <Text
              style={[
                styles.editButtonText,
                (loading || items.length === 0) && styles.editButtonTextDisabled,
              ]}
            >
              {editing ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.listContainer}>
        <FlatList
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: EXPANDED_HEADER_HEIGHT },
            filteredItems.length === 0 ? styles.listContentEmpty : null,
          ]}
          data={loading ? [] : filteredItems}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical
          bounces
          bouncesZoom={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          contentInsetAdjustmentBehavior="never"
          scrollIndicatorInsets={{ top: scrollIndicatorTop, bottom: 0 }}
          indicatorStyle="white"
          showsVerticalScrollIndicator
          scrollEnabled={listScrollEnabled}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          renderItem={renderProjectItem}
          extraData={`${editing}:${draggingId}:${dragStartIndex}:${hoverIndex}`}
        />

        <Animated.View
          style={[styles.collapsingHeader, collapsingHeaderStyle]}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.largeTitleClip, largeTitleClipStyle]}>
            <Animated.View style={largeTitleStyle}>
              <View
                ref={largeTitleMeasureRef}
                style={titlesHidden && styles.titleHidden}
                collapsable={false}
              >
                <Animated.Text
                  style={[styles.largeTitle, largeTitleScaleStyle]}
                  numberOfLines={1}
                >
                  Projects
                </Animated.Text>
              </View>
              <View style={styles.largeTitleSpacer} />
            </Animated.View>
          </Animated.View>
          <Animated.View style={[styles.searchBar, searchBarStyle]}>
            <Animated.View style={[styles.searchContent, searchContentStyle]}>
              <Ionicons name="search" size={18} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search Project"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
                editable={!editing}
                accessibilityLabel="Search projects"
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/projects/new')}
        accessibilityRole="button"
        accessibilityLabel="New project"
      >
        <Ionicons name="add" size={32} color={theme.text} />
      </Pressable>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={resetImportPreview}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Import Backup</Text>
            <Text style={styles.modalDescription}>
              Restore a Progression backup as a new project.
            </Text>
            {pendingManifest ? (
              <ImportPreviewCard
                manifest={pendingManifest}
                photoCount={pendingPhotoCount}
              />
            ) : null}
            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                onPress={resetImportPreview}
                style={styles.modalButton}
              />
              <PrimaryButton
                title={importing ? 'Importing...' : 'Import as New Project'}
                onPress={() => {
                  void confirmImport();
                }}
                loading={importing}
                disabled={importing}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!renaming) {
            setRenameTarget(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Project</Text>
            <TextInput
              style={styles.renameInput}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Project name"
              placeholderTextColor={theme.textMuted}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              editable={!renaming}
              onSubmitEditing={() => {
                void confirmRenameProject();
              }}
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                title="Cancel"
                variant="secondary"
                disabled={renaming}
                onPress={() => setRenameTarget(null)}
                style={styles.modalButton}
              />
              <PrimaryButton
                title={renaming ? 'Saving...' : 'Save'}
                loading={renaming}
                disabled={renaming}
                onPress={() => {
                  void confirmRenameProject();
                }}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.background,
    zIndex: 2,
    minHeight: 44,
  },
  smallTitleMeasure: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: 120,
    justifyContent: 'center',
    minHeight: 44,
  },
  smallTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
  titleHidden: {
    opacity: 0,
  },
  listContainer: {
    flex: 1,
  },
  collapsingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.background,
    zIndex: 1,
  },
  largeTitleClip: {
    overflow: 'hidden',
  },
  largeTitle: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '700',
    height: TITLE_HEIGHT,
    lineHeight: TITLE_HEIGHT,
    includeFontPadding: false,
  },
  largeTitleSpacer: {
    height: TITLE_MARGIN,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerIconButton: {
    padding: theme.spacing.xs,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  editButtonTextDisabled: {
    color: theme.textMuted,
  },
  searchBar: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  searchContent: {
    height: SEARCH_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    color: theme.text,
    fontSize: 16,
    paddingVertical: 0,
    margin: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 3,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  listHeader: {
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: 15,
    marginBottom: theme.spacing.xs,
  },
  privacy: {
    color: theme.textMuted,
    fontSize: 14,
  },
  restoreSpinner: {
    marginTop: theme.spacing.sm,
  },
  centered: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.background,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
  },
  modalDescription: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
  renameInput: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.text,
    fontSize: 16,
  },
});
