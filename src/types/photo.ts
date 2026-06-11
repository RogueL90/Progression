export type ProgressPhoto = {
  id: string;
  projectId: string;
  date: string;
  uri: string;
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
