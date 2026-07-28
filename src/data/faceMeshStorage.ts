import type { FaceMeshContourName, FaceMeshContours, FaceMeshOverlay, FaceMeshPoint } from '@/types/faceMesh';
import { FACE_MESH_CONTOUR_ORDER } from '@/constants/faceMeshConnections';
import { normalizePoint } from '@/utils/faceMeshCoords';
import {
  deleteFaceMeshFile,
  fileExists,
  getProjectFaceMeshFilePath,
  writeFaceMeshToProjectStorage,
} from '@/utils/file';
import { getErrorMessage } from '@/utils/errors';
import { File } from 'expo-file-system';

type RawPoint = { x: number; y: number; z?: number };

type RawContours = Partial<Record<FaceMeshContourName, RawPoint[]>>;

type RawLandmarks = Partial<Record<string, RawPoint>>;

const CONTOUR_NAME_SET = new Set<string>(FACE_MESH_CONTOUR_ORDER);

function isFaceMeshOverlay(value: unknown): value is FaceMeshOverlay {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FaceMeshOverlay>;
  return (
    candidate.version === 1 &&
    typeof candidate.imageWidth === 'number' &&
    typeof candidate.imageHeight === 'number' &&
    Array.isArray(candidate.landmarks) &&
    typeof candidate.capturedAt === 'string'
  );
}

function normalizeContourPoints(
  points: RawPoint[] | undefined,
  imageWidth: number,
  imageHeight: number
): FaceMeshPoint[] | undefined {
  if (!points || points.length === 0) return undefined;
  return points.map((point) => normalizePoint(point.x, point.y, imageWidth, imageHeight, point.z));
}

/**
 * Build a FaceMeshOverlay from ML Kit detection results in pixel coordinates.
 */
export function buildFaceMeshOverlayFromDetection(input: {
  imageWidth: number;
  imageHeight: number;
  contours?: RawContours | null;
  landmarks?: RawLandmarks | Record<string, RawPoint> | null;
}): FaceMeshOverlay | null {
  const { imageWidth, imageHeight, contours, landmarks } = input;
  if (imageWidth <= 0 || imageHeight <= 0) {
    return null;
  }

  const normalizedContours: FaceMeshContours = {};
  let contourPointCount = 0;

  if (contours) {
    for (const name of FACE_MESH_CONTOUR_ORDER) {
      const points = normalizeContourPoints(contours[name], imageWidth, imageHeight);
      if (points && points.length > 0) {
        normalizedContours[name] = points;
        contourPointCount += points.length;
      }
    }
  }

  const landmarkPoints: FaceMeshPoint[] = [];
  if (landmarks) {
    for (const point of Object.values(landmarks)) {
      if (point && typeof point.x === 'number' && typeof point.y === 'number') {
        landmarkPoints.push(normalizePoint(point.x, point.y, imageWidth, imageHeight, point.z));
      }
    }
  }

  if (contourPointCount === 0 && landmarkPoints.length === 0) {
    return null;
  }

  return {
    version: 1,
    imageWidth,
    imageHeight,
    landmarks: landmarkPoints,
    ...(Object.keys(normalizedContours).length > 0 ? { contours: normalizedContours } : {}),
    capturedAt: new Date().toISOString(),
  };
}

export async function saveFaceMeshOverlay(
  projectId: string,
  date: string,
  overlay: FaceMeshOverlay
): Promise<string> {
  try {
    const json = JSON.stringify(overlay);
    return await writeFaceMeshToProjectStorage(projectId, date, json);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Could not save the face mesh overlay.'));
  }
}

export async function readFaceMeshOverlay(uri: string): Promise<FaceMeshOverlay | null> {
  try {
    if (!(await fileExists(uri))) {
      return null;
    }

    const text = await new File(uri).text();
    const parsed: unknown = JSON.parse(text);
    if (!isFaceMeshOverlay(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function deleteFaceMeshForPhoto(uri: string | undefined): Promise<void> {
  if (!uri) return;
  await deleteFaceMeshFile(uri);
}

export async function resolveFaceMeshUriIfExists(
  projectId: string,
  date: string
): Promise<string | undefined> {
  const uri = await getProjectFaceMeshFilePath(projectId, date);
  if (await fileExists(uri)) {
    return uri;
  }
  return undefined;
}

export function hasContourData(overlay: FaceMeshOverlay | null | undefined): boolean {
  if (!overlay?.contours) return false;
  return Object.keys(overlay.contours).some((key) => CONTOUR_NAME_SET.has(key));
}
