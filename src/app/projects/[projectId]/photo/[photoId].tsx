import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { getPhotoById } from '@/data/photoStorage';
import { useProject } from '@/hooks/useProject';
import { useProjectPhotos } from '@/hooks/useProjectPhotos';
import type { ProgressPhoto } from '@/types/photo';
import { formatDisplayDate } from '@/utils/date';

export default function ProjectPhotoDetailScreen() {
  const { projectId, photoId } = useLocalSearchParams<{
    projectId: string;
    photoId: string;
  }>();
  const router = useRouter();
  const { project } = useProject(projectId);
  const { deletePhoto } = useProjectPhotos(projectId);
  const [photo, setPhoto] = useState<ProgressPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadPhoto = useCallback(async () => {
    if (!photoId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getPhotoById(photoId);
    if (!result || result.projectId !== projectId) {
      setPhoto(null);
      setNotFound(true);
    } else {
      setPhoto(result);
      setNotFound(false);
    }
    setLoading(false);
  }, [photoId, projectId]);

  useFocusEffect(
    useCallback(() => {
      loadPhoto();
    }, [loadPhoto])
  );

  const handleDelete = () => {
    if (!photo) return;

    Alert.alert(
      'Delete this photo?',
      'This will remove it from this project and delete the image from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await deletePhoto(photo.id);
            router.back();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (notFound || !photo) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Photo not found</Text>
        <PrimaryButton title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
      <View style={styles.footer}>
        {project && <Text style={styles.projectName}>{project.name}</Text>}
        <Text style={styles.date}>{formatDisplayDate(photo.date)}</Text>
        <Text style={styles.notesPlaceholder}>Notes coming soon</Text>
        <PrimaryButton
          title="Delete Photo"
          variant="danger"
          onPress={handleDelete}
          loading={deleting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  footer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  projectName: {
    color: theme.textMuted,
    fontSize: 14,
  },
  date: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600',
  },
  notesPlaceholder: {
    color: theme.textMuted,
    fontSize: 14,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    color: theme.textMuted,
    fontSize: 16,
    marginBottom: theme.spacing.md,
  },
});
