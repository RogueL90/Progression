import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { StatCard } from '@/components/StatCard';
import { getProjectTypeLabel } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import { deleteProject } from '@/data/projectStorage';
import { getStatsForProject } from '@/data/stats';
import { useProject } from '@/hooks/useProject';
import { useTodayPhoto } from '@/hooks/useTodayPhoto';
import type { PhotoStats } from '@/types/photo';
import { formatDisplayDate } from '@/utils/date';

export default function ProjectDashboardScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { project, loading: projectLoading, refreshProject } = useProject(projectId);
  const { hasPhotoToday, loading: todayLoading, refreshTodayPhoto } =
    useTodayPhoto(projectId);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const refreshStats = useCallback(async () => {
    if (!projectId) return;
    setStatsLoading(true);
    const result = await getStatsForProject(projectId);
    setStats(result);
    setStatsLoading(false);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      refreshProject();
      refreshTodayPhoto();
      refreshStats();
    }, [refreshProject, refreshTodayPhoto, refreshStats])
  );

  const handleDelete = () => {
    if (!project) return;

    Alert.alert(
      'Delete this project?',
      'This will delete the project and all of its photos from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{project.name}</Text>
      <Text style={styles.type}>{getProjectTypeLabel(project.type)}</Text>
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

      <PrimaryButton
        title="Delete Project"
        variant="danger"
        onPress={handleDelete}
        loading={deleting}
        style={styles.deleteButton}
      />
    </ScrollView>
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
