import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getProjectTypeLabel } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import type { Project } from '@/types/project';
import { formatDisplayDate } from '@/utils/date';

export type ProjectCardProps = {
  project: Project;
  totalPhotos: number;
  latestPhotoUri?: string;
  latestPhotoDate?: string;
  onPress: () => void;
};

export function ProjectCard({
  project,
  totalPhotos,
  latestPhotoUri,
  latestPhotoDate,
  onPress,
}: ProjectCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {latestPhotoUri ? (
        <Image source={{ uri: latestPhotoUri }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Text style={styles.placeholderText}>No photos</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{project.name}</Text>
        <Text style={styles.type}>{getProjectTypeLabel(project.type)}</Text>
        <Text style={styles.meta}>
          {totalPhotos} photo{totalPhotos === 1 ? '' : 's'}
          {latestPhotoDate ? ` · ${formatDisplayDate(latestPhotoDate)}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.cardBorder,
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
});
