import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProjectCard } from '@/components/ProjectCard';
import { theme } from '@/constants/theme';
import { getAllProjects } from '@/data/projectStorage';
import { getStatsForProject } from '@/data/stats';
import type { Project } from '@/types/project';

type ProjectListItem = Project & {
  totalPhotos: number;
  latestPhotoUri?: string;
  latestPhotoDate?: string;
};

export default function ProjectListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const projects = await getAllProjects();
    const enriched = await Promise.all(
      projects.map(async (project) => {
        const stats = await getStatsForProject(project.id);
        return {
          ...project,
          totalPhotos: stats.totalPhotos,
          latestPhotoUri: project.coverPhotoUri,
          latestPhotoDate: stats.latestPhotoDate ?? undefined,
        };
      })
    );
    setItems(enriched);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Projects</Text>
        <Text style={styles.subtitle}>Track visual progress over time.</Text>
        <Text style={styles.privacy}>Your photos stay on this device.</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          title="No projects yet"
          message="Create your first progress project to start tracking change over time."
          actionLabel="New Project"
          onAction={() => router.push('/projects/new')}
        />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              totalPhotos={item.totalPhotos}
              latestPhotoUri={item.latestPhotoUri}
              latestPhotoDate={item.latestPhotoDate}
              onPress={() => router.push(`/projects/${item.id}`)}
            />
          )}
          ListFooterComponent={
            <PrimaryButton
              title="New Project"
              onPress={() => router.push('/projects/new')}
              style={styles.newButton}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  title: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButton: {
    marginTop: theme.spacing.sm,
  },
});
