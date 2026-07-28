import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';

import { FaceMeshWireframe } from '@/components/FaceMeshWireframe';
import { readFaceMeshOverlay } from '@/data/faceMeshStorage';
import type { FaceMeshContours, FaceMeshOverlay, FaceMeshPoint } from '@/types/faceMesh';
import type { ProgressPhoto } from '@/types/photo';
import {
  getContainLayout,
  mapNormalizedPointToContainLayout,
} from '@/utils/faceMeshCoords';
import { theme } from '@/constants/theme';

type PhotoWithFaceMeshProps = {
  photo: ProgressPhoto;
  showFace: boolean;
  showMesh: boolean;
  style?: object;
};

function mapContoursToLayout(
  contours: FaceMeshContours | undefined,
  layout: ReturnType<typeof getContainLayout>
): FaceMeshContours | undefined {
  if (!contours) return undefined;
  const mapped: FaceMeshContours = {};
  for (const [name, points] of Object.entries(contours) as [
    keyof FaceMeshContours,
    FaceMeshPoint[],
  ][]) {
    if (!points) continue;
    mapped[name] = points.map((point) => mapNormalizedPointToContainLayout(point, layout));
  }
  return mapped;
}

export function PhotoWithFaceMesh({
  photo,
  showFace,
  showMesh,
  style,
}: PhotoWithFaceMeshProps) {
  const [overlay, setOverlay] = useState<FaceMeshOverlay | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!photo.faceMeshUri || !showMesh) {
        if (!cancelled) setOverlay(null);
        return;
      }

      const result = await readFaceMeshOverlay(photo.faceMeshUri);
      if (!cancelled) {
        setOverlay(result);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [photo.faceMeshUri, photo.id, showMesh]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const mapped = useMemo(() => {
    if (!overlay || !showMesh || containerSize.width <= 0 || containerSize.height <= 0) {
      return null;
    }

    const layout = getContainLayout(
      containerSize.width,
      containerSize.height,
      overlay.imageWidth,
      overlay.imageHeight
    );

    return {
      contours: mapContoursToLayout(overlay.contours, layout),
      landmarks: overlay.landmarks.map((point) =>
        mapNormalizedPointToContainLayout(point, layout)
      ),
    };
  }, [overlay, showMesh, containerSize.width, containerSize.height]);

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {showFace ? (
        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.blank} />
      )}

      {showMesh && mapped && (
        <FaceMeshWireframe
          width={containerSize.width}
          height={containerSize.height}
          contours={mapped.contours}
          landmarks={mapped.landmarks}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.background,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  blank: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
  },
});
