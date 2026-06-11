import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CaptureGuideOverlay } from '@/components/CaptureGuideOverlay';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { replacePhotoForDate } from '@/data/photoStorage';
import { useProject } from '@/hooks/useProject';
import { useTodayPhoto } from '@/hooks/useTodayPhoto';
import type { ProjectType } from '@/types/project';
import { formatDisplayDate, getTodayDateString } from '@/utils/date';

function getCameraFacing(type: ProjectType): 'front' | 'back' {
  return type === 'selfie' || type === 'side_profile' ? 'front' : 'back';
}

export default function ProjectCaptureScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { project, loading: projectLoading } = useProject(projectId);
  const [isFocused, setIsFocused] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const { hasPhotoToday } = useTodayPhoto(projectId);

  const today = getTodayDateString();

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || saving || !projectId) return;

    try {
      setSaving(true);
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });

      if (!result?.uri) {
        throw new Error('Capture failed');
      }

      await replacePhotoForDate(projectId, today, result.uri);
      router.back();
    } catch {
      setSaving(false);
    }
  }, [cameraReady, saving, projectId, today, router]);

  if (projectLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Project not found</Text>
        <PrimaryButton title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          Camera access is required to capture progress photos.
        </Text>
        <Text style={styles.submessage}>
          Your photos are stored only on this device and never uploaded.
        </Text>
        <PrimaryButton title="Grant Camera Access" onPress={requestPermission} />
        <PrimaryButton
          title="Go Back"
          variant="secondary"
          onPress={() => router.back()}
          style={styles.backButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={getCameraFacing(project.type)}
          onCameraReady={() => setCameraReady(true)}
        />
      )}

      <CaptureGuideOverlay projectType={project.type} />

      <View style={styles.topOverlay}>
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.dateLabel}>{formatDisplayDate(today)}</Text>
        {hasPhotoToday && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Photo already taken — retake will replace it
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomOverlay}>
        <PrimaryButton
          title={saving ? 'Saving...' : hasPhotoToday ? 'Retake Photo' : 'Take Photo'}
          onPress={handleCapture}
          loading={saving}
          disabled={!cameraReady}
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
  camera: {
    flex: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  message: {
    color: theme.text,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
  },
  submessage: {
    color: theme.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  backButton: {
    marginTop: theme.spacing.sm,
    alignSelf: 'stretch',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  projectName: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  dateLabel: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  warningBanner: {
    marginTop: theme.spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  warningText: {
    color: theme.background,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});
