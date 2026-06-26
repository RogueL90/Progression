import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureGhostOverlay } from '@/components/CaptureGhostOverlay';
import { CaptureGridOverlay } from '@/components/CaptureGridOverlay';
import { CaptureSettingsSheet } from '@/components/CaptureSettingsSheet';
import { CaptureShutterButton } from '@/components/CaptureShutterButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { getLatestPhotoForProject, replacePhotoForDate } from '@/data/photoStorage';
import { useCaptureSettings } from '@/hooks/useCaptureSettings';
import { useProject } from '@/hooks/useProject';
import { useTodayPhoto } from '@/hooks/useTodayPhoto';
import type { ProgressPhoto } from '@/types/photo';
import type { ProjectType } from '@/types/project';
import { formatDisplayDate, getTodayDateString } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';

function getCameraFacing(type: ProjectType): 'front' | 'back' {
  return type === 'selfie' || type === 'side_profile' ? 'front' : 'back';
}

export default function ProjectCaptureScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { project, loading: projectLoading } = useProject(projectId);
  const { settings, updateSettings } = useCaptureSettings();
  const [isFocused, setIsFocused] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [latestPhoto, setLatestPhoto] = useState<ProgressPhoto | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const { hasPhotoToday } = useTodayPhoto(projectId);

  const today = getTodayDateString();

  const refreshLatestPhoto = useCallback(async () => {
    if (!projectId) {
      setLatestPhoto(null);
      return;
    }

    const photo = await getLatestPhotoForProject(projectId);
    setLatestPhoto(photo);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      void refreshLatestPhoto();
      return () => setIsFocused(false);
    }, [refreshLatestPhoto])
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || saving || !projectId) return;

    try {
      setSaving(true);
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });

      if (!result?.uri) {
        throw new Error('Could not capture photo. Please try again.');
      }

      await replacePhotoForDate(projectId, today, result.uri);
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert(
        'Could not save photo',
        getErrorMessage(error, 'Something went wrong while saving this photo.')
      );
    }
  }, [cameraReady, saving, projectId, today, router]);

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();
    if (!result?.granted && result?.canAskAgain === false) {
      Alert.alert(
        'Camera access denied',
        'Enable camera access in system settings to take progress photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]
      );
    }
  }, [requestPermission]);

  const hasGhostPhoto = latestPhoto !== null;
  const showGhost = settings.showGhost && hasGhostPhoto && latestPhoto?.uri;

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
    const permanentlyDenied = permission.canAskAgain === false;

    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          Camera access is required to capture progress photos.
        </Text>
        <Text style={styles.submessage}>
          {permanentlyDenied
            ? 'Camera access is turned off. Enable it in system settings to take photos.'
            : 'Your photos are stored only on this device and never uploaded.'}
        </Text>
        {permanentlyDenied ? (
          <PrimaryButton title="Open Settings" onPress={() => void Linking.openSettings()} />
        ) : (
          <PrimaryButton title="Grant Camera Access" onPress={handleRequestPermission} />
        )}
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

      {showGhost && <CaptureGhostOverlay uri={latestPhoto.uri} />}

      {settings.showGrid && <CaptureGridOverlay density={settings.gridDensity} />}

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

      <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.controlsRow}>
          <View style={styles.sideSlot} />
          <CaptureShutterButton
            onPress={handleCapture}
            loading={saving}
            disabled={!cameraReady}
          />
          <View style={styles.sideSlot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capture settings"
              onPress={() => setSettingsVisible(true)}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsPressed]}
            >
              <Ionicons name="settings-outline" size={26} color={theme.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <CaptureSettingsSheet
        visible={settingsVisible}
        settings={settings}
        hasGhostPhoto={hasGhostPhoto}
        onClose={() => setSettingsVisible(false)}
        onUpdate={(updates) => {
          void updateSettings(updates);
        }}
      />
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
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlot: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 72,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  settingsPressed: {
    opacity: 0.8,
  },
});
