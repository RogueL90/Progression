import type { ProjectType } from '@/types/project';

export type BackupPhotoManifestItem = {
  id: string;
  projectId: string;
  date: string;
  fileName: string;
  /** Optional face mesh sidecar filename under photos/ */
  meshFileName?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
};

export type BackupManifest = {
  app: 'Progression';
  /** v1: photos only; v2: optional face mesh sidecars */
  backupVersion: 1 | 2;
  exportedAt: string;
  project: {
    id: string;
    name: string;
    type: ProjectType;
    createdAt: string;
    updatedAt: string;
    coverPhotoFileName?: string;
  };
  photos: BackupPhotoManifestItem[];
};

export type BackupValidationResult = {
  valid: boolean;
  manifest?: BackupManifest;
  photoCount?: number;
  errors: string[];
};
