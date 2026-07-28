export type FaceMeshPoint = {
  x: number;
  y: number;
  z?: number;
};

export type FaceMeshContourName =
  | 'FACE'
  | 'LEFT_EYEBROW_TOP'
  | 'LEFT_EYEBROW_BOTTOM'
  | 'RIGHT_EYEBROW_TOP'
  | 'RIGHT_EYEBROW_BOTTOM'
  | 'LEFT_EYE'
  | 'RIGHT_EYE'
  | 'UPPER_LIP_TOP'
  | 'UPPER_LIP_BOTTOM'
  | 'LOWER_LIP_TOP'
  | 'LOWER_LIP_BOTTOM'
  | 'NOSE_BRIDGE'
  | 'NOSE_BOTTOM'
  | 'LEFT_CHEEK'
  | 'RIGHT_CHEEK';

export type FaceMeshContours = Partial<Record<FaceMeshContourName, FaceMeshPoint[]>>;

export type FaceMeshOverlay = {
  version: 1;
  imageWidth: number;
  imageHeight: number;
  /** Normalized landmarks in [0, 1] image space */
  landmarks: FaceMeshPoint[];
  /** Named contour polylines in normalized [0, 1] image space */
  contours?: FaceMeshContours;
  capturedAt: string;
};
