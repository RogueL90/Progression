export type ProgressPhoto = {
  id: string;
  projectId: string;
  date: string;
  uri: string;
  /** Optional sidecar face mesh overlay JSON path */
  faceMeshUri?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
};

export type PhotoStats = {
  totalPhotos: number;
  firstPhotoDate: string | null;
  latestPhotoDate: string | null;
  currentStreak: number;
  longestStreak: number;
};
