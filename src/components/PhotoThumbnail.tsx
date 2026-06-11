import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import type { ProgressPhoto } from '@/types/photo';
import { formatDisplayDate } from '@/utils/date';

type PhotoThumbnailProps = {
  photo: ProgressPhoto;
  dayNumber?: number;
  onPress: () => void;
};

export function PhotoThumbnail({ photo, dayNumber, onPress }: PhotoThumbnailProps) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
      <View style={styles.info}>
        <Text style={styles.date}>{formatDisplayDate(photo.date)}</Text>
        {dayNumber !== undefined && (
          <Text style={styles.dayLabel}>Day {dayNumber}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
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
  info: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  date: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  dayLabel: {
    color: theme.textMuted,
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
});
