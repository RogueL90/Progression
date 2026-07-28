import type { FaceMeshContourName } from '@/types/faceMesh';

/**
 * Contour groups used to draw the face wireframe.
 * Points within each contour are connected in order; closed contours also connect last→first.
 */
export const FACE_MESH_CONTOUR_ORDER: FaceMeshContourName[] = [
  'FACE',
  'LEFT_EYEBROW_TOP',
  'LEFT_EYEBROW_BOTTOM',
  'RIGHT_EYEBROW_TOP',
  'RIGHT_EYEBROW_BOTTOM',
  'LEFT_EYE',
  'RIGHT_EYE',
  'UPPER_LIP_TOP',
  'UPPER_LIP_BOTTOM',
  'LOWER_LIP_TOP',
  'LOWER_LIP_BOTTOM',
  'NOSE_BRIDGE',
  'NOSE_BOTTOM',
  'LEFT_CHEEK',
  'RIGHT_CHEEK',
];

export const FACE_MESH_CLOSED_CONTOURS: ReadonlySet<FaceMeshContourName> = new Set([
  'FACE',
  'LEFT_EYE',
  'RIGHT_EYE',
  'UPPER_LIP_TOP',
  'UPPER_LIP_BOTTOM',
  'LOWER_LIP_TOP',
  'LOWER_LIP_BOTTOM',
]);
