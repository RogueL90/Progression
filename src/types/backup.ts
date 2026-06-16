import type { ProjectType } from '@/types/project';

export type BackupPhotoManifestItem = {
  id: string;
  projectId: string;
  date: string;
  fileName: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
};

export type BackupManifest = {
  app: 'Progression';
  backupVersion: 1;
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
