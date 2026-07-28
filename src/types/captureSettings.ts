export type GridDensity = 'few' | 'many';

export type CaptureSettings = {
  showGrid: boolean;
  gridDensity: GridDensity;
  showGhost: boolean;
  /** Live face mesh preview during capture (does not affect whether mesh is saved) */
  showFaceMesh: boolean;
};
