import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureGhostOverlay } from '@/components/CaptureGhostOverlay';
import { CaptureGridOverlay } from '@/components/CaptureGridOverlay';
import { CaptureSettingsSheet } from '@/components/CaptureSettingsSheet';
import { CaptureShutterButton } from '@/components/CaptureShutterButton';
import type { FaceMeshCaptureHandle } from '@/components/FaceMeshCaptureView';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FACE_MESH_ENABLED } from '@/constants/featureFlags';
import { isFaceProjectType } from '@/constants/projectTypes';
import { theme } from '@/constants/theme';
import { getLatestPhotoForProject, replacePhotoForDate } from '@/data/photoStorage';
import { useCaptureSettings } from '@/hooks/useCaptureSettings';
import { useProject } from '@/hooks/useProject';
import { useTodayPhoto } from '@/hooks/useTodayPhoto';
import type { ProgressPhoto } from '@/types/photo';
import type { ProjectType } from '@/types/project';
import type { FaceMeshOverlay } from '@/types/faceMesh';
import { formatDisplayDate, getTodayDateString } from '@/utils/date';
import { getErrorMessage } from '@/utils/errors';

type FlashMode = 'off' | 'on' | 'auto';

/**
 * Lazily load Vision Camera face capture only when face mesh is enabled.
 * A static import would crash Expo Go (native module missing).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FaceMeshCaptureView = FACE_MESH_ENABLED
  ? (require('@/components/FaceMeshCaptureView').FaceMeshCaptureView as typeof import('@/components/FaceMeshCaptureView').FaceMeshCaptureView)
  : null;

function getCameraFacing(type: ProjectType): 'front' | 'back' {
  return type === 'selfie' || type === 'side_profile' ? 'front' : 'back';
}

function getFlashIcon(mode: FlashMode): keyof typeof Ionicons.glyphMap {
  if (mode === 'on') return 'flash';
  if (mode === 'auto') return 'flash-outline';
  return 'flash-off-outline';
}

function getFlashLabel(mode: FlashMode): string {
  if (mode === 'on') return 'Flash on';
  if (mode === 'auto') return 'Flash auto';
  return 'Flash off';
}

async function detectFaceMeshFromImage(
  uri: string,
  imageWidth: number,
  imageHeight: number
): Promise<FaceMeshOverlay | null> {
  if (!FACE_MESH_ENABLED) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { detectFaces } = require('react-native-vision-camera-face-detector');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildFaceMeshOverlayFromDetection } = require('@/data/faceMeshStorage');

    const faces = await detectFaces({
      image: uri,
      options: {
        performanceMode: 'accurate',
        contourMode: 'all',
        landmarkMode: 'all',
      },
    });

    const face = faces[0];
    if (!face) return null;

    return buildFaceMeshOverlayFromDetection({
      imageWidth,
      imageHeight,
      contours: face.contours ?? null,
      landmarks: face.landmarks ? Object.fromEntries(Object.entries(face.landmarks)) : null,
    });
  } catch {
    return null;
  }
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
  const faceCaptureRef = useRef<FaceMeshCaptureHandle>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [saving, setSaving] = useState(false);
  const { hasPhotoToday } = useTodayPhoto(projectId);

  const today = getTodayDateString();
  const isFaceProject = project ? isFaceProjectType(project.type) : false;
  const useFaceMeshCapture = FACE_MESH_ENABLED && isFaceProject && FaceMeshCaptureView !== null;
  const canUseCamera = permission?.granted ?? false;
  const showFlashControl = canUseCamera;

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
      setCameraReady(false);
      void refreshLatestPhoto();
      return () => setIsFocused(false);
    }, [refreshLatestPhoto])
  );

  useEffect(() => {
    if (project) {
      setFacing(getCameraFacing(project.type));
    }
  }, [project?.id, project?.type]);

  useEffect(() => {
    setCameraReady(false);
  }, [settings.showFaceMesh, useFaceMeshCapture, facing]);

  const flipCamera = useCallback(() => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }, []);

  const cycleFlash = useCallback(() => {
    setFlashMode((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  }, []);

  const saveProgressPhoto = useCallback(
    async (uri: string, faceMesh: FaceMeshOverlay | null = null) => {
      if (!projectId || !project) return;

      try {
        setSaving(true);
        await replacePhotoForDate(projectId, today, uri, faceMesh);
        router.back();
      } catch (error) {
        setSaving(false);
        Alert.alert(
          'Could not save photo',
          getErrorMessage(error, 'Something went wrong while saving this photo.')
        );
      }
    },
    [projectId, project, today, router]
  );

  const handleCapture = useCallback(async () => {
    if (!canUseCamera || !cameraReady || saving || !projectId || !project) return;

    try {
      setSaving(true);

      if (useFaceMeshCapture) {
        const result = await faceCaptureRef.current?.takePicture();
        if (!result?.uri) {
          throw new Error('Could not capture photo. Please try again.');
        }
        await replacePhotoForDate(projectId, today, result.uri, result.faceMesh);
      } else {
        if (!cameraRef.current) return;
        const result = await cameraRef.current.takePictureAsync({
          quality: 0.85,
        });

        if (!result?.uri) {
          throw new Error('Could not capture photo. Please try again.');
        }

        await replacePhotoForDate(projectId, today, result.uri);
      }

      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert(
        'Could not save photo',
        getErrorMessage(error, 'Something went wrong while saving this photo.')
      );
    }
  }, [
    canUseCamera,
    cameraReady,
    saving,
    projectId,
    project,
    today,
    router,
    useFaceMeshCapture,
  ]);

  const handlePickPhoto = useCallback(async () => {
    if (saving || !projectId || !project) return;

    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!libraryPermission.granted) {
      if (libraryPermission.canAskAgain === false) {
        Alert.alert(
          'Photo library access denied',
          'Enable photo library access in system settings to upload progress photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert(
          'Photo library access required',
          'Allow access to your photo library to upload a progress photo.'
        );
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const asset = result.assets[0];
    let faceMesh: FaceMeshOverlay | null = null;

    if (useFaceMeshCapture && asset.width && asset.height) {
      faceMesh = await detectFaceMeshFromImage(asset.uri, asset.width, asset.height);
    }

    await saveProgressPhoto(asset.uri, faceMesh);
  }, [saving, projectId, project, useFaceMeshCapture, saveProgressPhoto]);

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

  return (
    <View style={styles.container}>
      {canUseCamera && isFocused && useFaceMeshCapture && FaceMeshCaptureView ? (
        <FaceMeshCaptureView
          ref={faceCaptureRef}
          facing={facing}
          flash={flashMode}
          isActive={isFocused}
          showFaceMesh={settings.showFaceMesh}
          onCameraReadyChange={setCameraReady}
        />
      ) : null}

      {canUseCamera && isFocused && !useFaceMeshCapture ? (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flashMode}
          onCameraReady={() => setCameraReady(true)}
        />
      ) : null}

      {!canUseCamera && (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.placeholderTitle}>Camera access needed</Text>
          <Text style={styles.placeholderMessage}>
            Grant camera access to take photos, or upload one from your library below.
          </Text>
          <PrimaryButton title="Grant Camera Access" onPress={handleRequestPermission} />
        </View>
      )}

      {showGhost && <CaptureGhostOverlay uri={latestPhoto.uri} />}

      {settings.showGrid && canUseCamera && <CaptureGridOverlay density={settings.gridDensity} />}

      <View style={[styles.topOverlay, { paddingTop: insets.top + 4, paddingHorizontal: theme.spacing.md }]}>
        {showFlashControl && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getFlashLabel(flashMode)}
            onPress={cycleFlash}
            disabled={saving}
            style={({ pressed }) => [
              styles.topControlButton,
              styles.flashButton,
              styles.flashButtonPosition,
              { top: insets.top + 4 },
              pressed && styles.settingsPressed,
            ]}
          >
            <Ionicons name={getFlashIcon(flashMode)} size={24} color={theme.text} />
            {flashMode === 'auto' && <Text style={styles.flashAutoLabel}>A</Text>}
          </Pressable>
        )}
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
          <View style={[styles.sideSlot, styles.sideSlotLeft]}>
            <View style={styles.sideActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload photo"
                onPress={handlePickPhoto}
                disabled={saving}
                style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsPressed]}
              >
                <Ionicons name="images-outline" size={24} color={theme.text} />
              </Pressable>
              {canUseCamera && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                  onPress={flipCamera}
                  disabled={saving}
                  style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsPressed]}
                >
                  <Ionicons name="camera-reverse-outline" size={24} color={theme.text} />
                </Pressable>
              )}
            </View>
          </View>
          <CaptureShutterButton
            onPress={handleCapture}
            loading={saving}
            disabled={!canUseCamera || !cameraReady}
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
        showFaceMeshOption={useFaceMeshCapture}
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
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  placeholderTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholderMessage: {
    color: theme.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
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
    alignItems: 'center',
  },
  flashButtonPosition: {
    position: 'absolute',
    right: theme.spacing.md,
    zIndex: 1,
  },
  topControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  flashButton: {
    flexDirection: 'row',
    gap: 2,
  },
  flashAutoLabel: {
    color: theme.text,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
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
  sideSlotLeft: {
    alignItems: 'flex-start',
  },
  sideActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
