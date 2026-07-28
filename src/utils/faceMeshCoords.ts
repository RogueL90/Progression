import type { FaceMeshPoint } from '@/types/faceMesh';

export type ContainLayout = {
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
};

/**
 * Compute the drawn image rect when using resizeMode="contain".
 */
export function getContainLayout(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): ContainLayout {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return {
      offsetX: 0,
      offsetY: 0,
      drawWidth: containerWidth,
      drawHeight: containerHeight,
    };
  }

  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imageWidth / imageHeight;

  if (imageAspect > containerAspect) {
    const drawWidth = containerWidth;
    const drawHeight = containerWidth / imageAspect;
    return {
      offsetX: 0,
      offsetY: (containerHeight - drawHeight) / 2,
      drawWidth,
      drawHeight,
    };
  }

  const drawHeight = containerHeight;
  const drawWidth = containerHeight * imageAspect;
  return {
    offsetX: (containerWidth - drawWidth) / 2,
    offsetY: 0,
    drawWidth,
    drawHeight,
  };
}

/**
 * Map a normalized [0,1] image-space point into container coordinates for contain layout.
 */
export function mapNormalizedPointToContainLayout(
  point: FaceMeshPoint,
  layout: ContainLayout
): FaceMeshPoint {
  return {
    x: layout.offsetX + point.x * layout.drawWidth,
    y: layout.offsetY + point.y * layout.drawHeight,
    z: point.z,
  };
}

export function normalizePoint(
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
  z?: number
): FaceMeshPoint {
  return {
    x: imageWidth > 0 ? x / imageWidth : 0,
    y: imageHeight > 0 ? y / imageHeight : 0,
    ...(z !== undefined ? { z } : {}),
  };
}
