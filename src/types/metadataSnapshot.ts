import type { ProgressPhoto } from '@/types/photo';
import type { Project } from '@/types/project';

export type MetadataSnapshot = {
  app: 'Progression';
  snapshotVersion: 1;
  schemaVersion: number;
  createdAt: string;
  projects: Project[];
  photos: ProgressPhoto[];
};

export type MetadataSnapshotValidationResult = {
  valid: boolean;
  snapshot?: MetadataSnapshot;
  errors: string[];
};
