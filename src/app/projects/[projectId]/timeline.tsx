import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PhotoThumbnail } from '@/components/PhotoThumbnail';
import { theme } from '@/constants/theme';
import { useProjectPhotos } from '@/hooks/useProjectPhotos';
import { daysBetween } from '@/utils/date';

export default function ProjectTimelineScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { photos, loading, refreshPhotos } = useProjectPhotos(projectId);

  useFocusEffect(
    useCallback(() => {
      refreshPhotos();
    }, [refreshPhotos])
  );

  const firstDate = photos.length > 0 ? photos[photos.length - 1].date : null;

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
        message="Take your first photo for this project."
        actionLabel="Take Photo"
        onAction={() => router.push(`/projects/${projectId}/capture`)}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={photos}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const dayNumber = firstDate ? daysBetween(firstDate, item.date) : undefined;
        return (
          <PhotoThumbnail
            photo={item}
            dayNumber={dayNumber}
            onPress={() => router.push(`/projects/${projectId}/photo/${item.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
