import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { PrimaryButton } from '@/components/PrimaryButton';
import { BackupSection } from '@/components/BackupSection';
import { ProjectReminderSection } from '@/components/ProjectReminderSection';
import { StatCard } from '@/components/StatCard';
import { NOTIFICATIONS_ENABLED } from '@/constants/featureFlags';
import { getProjectTypeLabel } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import { exportProjectBackup } from '@/data/backupService';
import {
  projectDashboardTitleOpacity,
  resetProjectDashboardTitleOpacity,
} from '@/data/projectDashboardHeader';
import { rememberProjectName } from '@/data/projectNameCache';
import { deleteProject } from '@/data/projectStorage';
import { getStatsForProject } from '@/data/stats';
import { useProject } from '@/hooks/useProject';
import { useTodayPhoto } from '@/hooks/useTodayPhoto';
import type { PhotoStats } from '@/types/photo';
import { formatDisplayDate } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';
import { shareBackupFile } from '@/utils/share';

const TITLE_MAX_SCALE = 1.1;
const OVERSCROLL_SCALE_DISTANCE = 140;

export default function ProjectDashboardScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { project, loading: projectLoading, refreshProject } = useProject(projectId);
  const { hasPhotoToday, loading: todayLoading, refreshTodayPhoto } =
    useTodayPhoto(projectId);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [reminderPickerActive, setReminderPickerActive] = useState(false);
  const heroNameHeight = useSharedValue(36);
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;
      const fadeEnd = Math.max(heroNameHeight.value, 24);
      const fadeStart = fadeEnd * 0.35;
      projectDashboardTitleOpacity.value = interpolate(
        y,
        [fadeStart, fadeEnd],
        [0, 1],
        Extrapolation.CLAMP
      );
    },
  });

  const heroNameStyle = useAnimatedStyle(() => {
    const pull = Math.max(-scrollY.value, 0);
    const scale = interpolate(
      pull,
      [0, OVERSCROLL_SCALE_DISTANCE],
      [1, TITLE_MAX_SCALE],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
      transformOrigin: 'left bottom',
    };
  });

  const runBackup = useCallback(async () => {
    if (!projectId) return;

    try {
      setBackingUp(true);
      const zipUri = await exportProjectBackup(projectId);
      try {
        await shareBackupFile(zipUri);
      } catch (shareError) {
        await refreshProject();
        Alert.alert(
          'Backup created',
          getErrorMessage(
            shareError,
            'Backup was created, but the share sheet could not be opened. Try again.'
          )
        );
        return;
      }

      await refreshProject();
      Alert.alert('Backup created', 'Backup created. Save it somewhere safe.');
    } catch (error) {
      Alert.alert(
        'Backup failed',
        getErrorMessage(error, 'Could not create backup. Please try again.')
      );
    } finally {
      setBackingUp(false);
    }
  }, [projectId, refreshProject]);

  const refreshStats = useCallback(async () => {
    if (!projectId) return;
    setStatsLoading(true);
    const result = await getStatsForProject(projectId);
    setStats(result);
    setStatsLoading(false);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      resetProjectDashboardTitleOpacity();
      refreshProject();
      refreshTodayPhoto();
      refreshStats();
      return () => {
        resetProjectDashboardTitleOpacity();
      };
    }, [refreshProject, refreshTodayPhoto, refreshStats])
  );

  const handleDelete = () => {
    if (!project) return;

    Alert.alert(
      'Delete this project?',
      'This will delete the project and all of its photos from this device.\n\nConsider creating a backup first if you want to keep a copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Backup First',
          onPress: () => {
            void runBackup();
          },
        },
        {
          text: 'Delete Project',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await deleteProject(project.id);
            router.replace('/');
          },
        },
      ]
    );
  };

  const loading = projectLoading || todayLoading || statsLoading;

  useEffect(() => {
    if (project) {
      rememberProjectName(project.id, project.name);
    }
  }, [project]);

  if (projectLoading && !project) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Project not found</Text>
        <PrimaryButton title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: project.name,
          headerBackVisible: false,
        }}
      />
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        scrollEnabled={!reminderPickerActive}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Animated.Text
          style={[styles.name, heroNameStyle]}
          onLayout={(event) => {
            heroNameHeight.value = event.nativeEvent.layout.height;
          }}
        >
          {project.name}
        </Animated.Text>
        {project.type !== 'other' ? (
          <Text style={styles.type}>{getProjectTypeLabel(project.type)}</Text>
        ) : null}
        <Text style={styles.privacy}>This project is stored locally on this device.</Text>

      <View style={styles.statusCard}>
        {loading ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <>
            <Text style={styles.statusLabel}>Today</Text>
            <Text
              style={[
                styles.statusValue,
                hasPhotoToday ? styles.statusSuccess : styles.statusWarning,
              ]}
            >
              {hasPhotoToday ? 'Photo taken today' : 'No photo yet today'}
            </Text>
          </>
        )}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          title="Take Photo"
          onPress={() => router.push(`/projects/${projectId}/capture`)}
        />
        <PrimaryButton
          title="View Timeline"
          variant="secondary"
          onPress={() => router.push(`/projects/${projectId}/timeline`)}
        />
        <PrimaryButton
          title="Watch Progress"
          variant="secondary"
          onPress={() => router.push(`/projects/${projectId}/progress`)}
        />
      </View>

      {stats && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Total photos" value={String(stats.totalPhotos)} />
            <StatCard
              label="Current streak"
              value={`${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Longest streak"
              value={`${stats.longestStreak} day${stats.longestStreak === 1 ? '' : 's'}`}
            />
            <StatCard
              label="First photo"
              value={stats.firstPhotoDate ? formatDisplayDate(stats.firstPhotoDate) : '—'}
            />
            <StatCard
              label="Latest photo"
              value={stats.latestPhotoDate ? formatDisplayDate(stats.latestPhotoDate) : '—'}
            />
          </View>
        </View>
      )}

      {NOTIFICATIONS_ENABLED && (
        <ProjectReminderSection
          project={project}
          onProjectUpdated={() => {
            void refreshProject();
          }}
          onPickerActiveChange={setReminderPickerActive}
        />
      )}

      <BackupSection project={project} backingUp={backingUp} onBackup={runBackup} />

      <PrimaryButton
        title="Delete Project"
        variant="danger"
        onPress={handleDelete}
        loading={deleting}
        style={styles.deleteButton}
      />
    </Animated.ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  name: {
    color: theme.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  type: {
    color: theme.accent,
    fontSize: 15,
    marginBottom: theme.spacing.sm,
  },
  privacy: {
    color: theme.textMuted,
    fontSize: 14,
    marginBottom: theme.spacing.lg,
  },
  statusCard: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: theme.spacing.lg,
    minHeight: 80,
    justifyContent: 'center',
  },
  statusLabel: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: theme.spacing.xs,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusSuccess: {
    color: theme.success,
  },
  statusWarning: {
    color: theme.warning,
  },
  actions: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  statsSection: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  deleteButton: {
    marginTop: theme.spacing.sm,
  },
  errorText: {
    color: theme.textMuted,
    fontSize: 16,
    marginBottom: theme.spacing.md,
  },
});
