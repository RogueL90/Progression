import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  Camera as FaceDetectorCamera,
  detectFaces,
  type Contours,
  type Face,
  type Landmarks,
} from 'react-native-vision-camera-face-detector';

import { FaceMeshWireframe } from '@/components/FaceMeshWireframe';
import { buildFaceMeshOverlayFromDetection } from '@/data/faceMeshStorage';
import type { FaceMeshContours, FaceMeshOverlay, FaceMeshPoint } from '@/types/faceMesh';

export type FaceMeshCaptureHandle = {
  takePicture: () => Promise<{ uri: string; faceMesh: FaceMeshOverlay | null }>;
};

type FaceMeshCaptureViewProps = {
  facing: 'front' | 'back';
  flash?: 'off' | 'on' | 'auto';
  isActive: boolean;
  showFaceMesh: boolean;
  onCameraReadyChange?: (ready: boolean) => void;
};

function toFaceMeshContours(contours: Contours | undefined): FaceMeshContours | undefined {
  if (!contours) return undefined;
  const result: FaceMeshContours = {};
  (Object.keys(contours) as (keyof Contours)[]).forEach((key) => {
    const points = contours[key];
    if (points && points.length > 0) {
      result[key] = points.map((point) => ({ x: point.x, y: point.y }));
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}

function toLandmarkPoints(landmarks: Landmarks | undefined): FaceMeshPoint[] {
  if (!landmarks) return [];
  return Object.values(landmarks).map((point) => ({ x: point.x, y: point.y }));
}

export const FaceMeshCaptureView = forwardRef<FaceMeshCaptureHandle, FaceMeshCaptureViewProps>(
  function FaceMeshCaptureView(
    { facing, flash = 'off', isActive, showFaceMesh, onCameraReadyChange },
    ref
  ) {
    const { width, height } = useWindowDimensions();
    const device = useCameraDevice(facing);
    const { hasPermission } = useCameraPermission();
    const cameraRef = useRef<VisionCamera>(null);
    const [previewContours, setPreviewContours] = useState<FaceMeshContours | null>(null);
    const [previewLandmarks, setPreviewLandmarks] = useState<FaceMeshPoint[] | null>(null);

    const handleFacesDetected = useCallback((faces: Face[]) => {
      const face = faces[0];
      if (!face) {
        setPreviewContours(null);
        setPreviewLandmarks(null);
        return;
      }
      setPreviewContours(toFaceMeshContours(face.contours) ?? null);
      setPreviewLandmarks(toLandmarkPoints(face.landmarks));
    }, []);

    useEffect(() => {
      if (!showFaceMesh) {
        setPreviewContours(null);
        setPreviewLandmarks(null);
      }
    }, [showFaceMesh]);

    useImperativeHandle(
      ref,
      () => ({
        takePicture: async () => {
          const camera = cameraRef.current;
          if (!camera) {
            throw new Error('Camera is not ready.');
          }

          const photo = await camera.takePhoto({
            flash,
            enableShutterSound: false,
          });

          const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
          let faceMesh: FaceMeshOverlay | null = null;

          try {
            const faces = await detectFaces({
              image: uri,
              options: {
                performanceMode: 'accurate',
                contourMode: 'all',
                landmarkMode: 'all',
              },
            });

            const face = faces[0];
            if (face) {
              faceMesh = buildFaceMeshOverlayFromDetection({
                imageWidth: photo.width,
                imageHeight: photo.height,
                contours: face.contours ?? null,
                landmarks: face.landmarks
                  ? Object.fromEntries(Object.entries(face.landmarks))
                  : null,
              });
            }
          } catch {
            faceMesh = null;
          }

          return { uri, faceMesh };
        },
      }),
      [flash]
    );

    const torchEnabled = flash === 'on' && facing === 'back' && device?.hasTorch;

    if (!hasPermission || !device) {
      return <View style={styles.camera} />;
    }

    const commonProps = {
      style: styles.camera,
      device,
      isActive,
      photo: true as const,
      torch: torchEnabled ? ('on' as const) : ('off' as const),
      onInitialized: () => onCameraReadyChange?.(true),
      onError: () => onCameraReadyChange?.(false),
    };

    return (
      <View style={styles.container}>
        {showFaceMesh ? (
          <FaceDetectorCamera
            ref={cameraRef}
            {...commonProps}
            faceDetectionOptions={{
              performanceMode: 'fast',
              contourMode: 'all',
              landmarkMode: 'all',
              cameraFacing: facing,
              autoMode: true,
              windowWidth: width,
              windowHeight: height,
            }}
            faceDetectionCallback={handleFacesDetected}
          />
        ) : (
          <VisionCamera
            ref={cameraRef}
            {...commonProps}
          />
        )}

        {showFaceMesh && (
          <FaceMeshWireframe
            width={width}
            height={height}
            contours={previewContours}
            landmarks={previewLandmarks}
          />
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  camera: {
    flex: 1,
  },
});
