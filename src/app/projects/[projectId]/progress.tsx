import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { useProjectPhotos } from '@/hooks/useProjectPhotos';
import { type TimelapseSpeed, useTimelapse } from '@/hooks/useTimelapse';
import { formatDisplayDate } from '@/utils/date';

const SPEEDS: TimelapseSpeed[] = [1, 2, 5, 10];

export default function ProjectProgressScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { photos, loading, refreshPhotos } = useProjectPhotos(projectId);
  const {
    frames,
    currentPhoto,
    currentIndex,
    isPlaying,
    speed,
    play,
    pause,
    restart,
    setSpeed,
  } = useTimelapse(photos);

  useFocusEffect(
    useCallback(() => {
      refreshPhotos();
    }, [refreshPhotos])
  );

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
        message="Take photos over time to watch your progress."
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.viewer}>
        {currentPhoto ? (
          <Image
            source={{ uri: currentPhoto.uri }}
            style={styles.frame}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.framePlaceholder} />
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.dateLabel}>
          {currentPhoto ? formatDisplayDate(currentPhoto.date) : '—'}
        </Text>
        <Text style={styles.frameCounter}>
          {frames.length > 0 ? `${currentIndex + 1} of ${frames.length}` : '0 of 0'}
        </Text>
      </View>

      <View style={styles.speedRow}>
        <Text style={styles.speedLabel}>Speed</Text>
        <View style={styles.speedOptions}>
          {SPEEDS.map((s) => (
            <Pressable
              key={s}
              style={[styles.speedButton, speed === s && styles.speedButtonActive]}
              onPress={() => setSpeed(s)}
            >
              <Text style={[styles.speedText, speed === s && styles.speedTextActive]}>
                {s}/s
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.controls}>
        <PrimaryButton
          title={isPlaying ? 'Pause' : 'Play'}
          onPress={isPlaying ? pause : play}
          style={styles.controlButton}
        />
        <PrimaryButton
          title="Restart"
          variant="secondary"
          onPress={restart}
          style={styles.controlButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: theme.spacing.md,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  frame: {
    flex: 1,
    width: '100%',
  },
  framePlaceholder: {
    flex: 1,
    backgroundColor: theme.cardBorder,
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  dateLabel: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  frameCounter: {
    color: theme.textMuted,
    fontSize: 14,
  },
  speedRow: {
    marginBottom: theme.spacing.md,
  },
  speedLabel: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: theme.spacing.sm,
  },
  speedOptions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  speedButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  speedButtonActive: {
    backgroundColor: theme.accentMuted,
    borderColor: theme.accent,
  },
  speedText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  speedTextActive: {
    color: theme.text,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  controlButton: {
    flex: 1,
  },
});
