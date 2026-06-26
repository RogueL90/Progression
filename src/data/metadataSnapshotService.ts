import { Directory, File, Paths } from 'expo-file-system';

import { APP_SCHEMA_VERSION } from '@/constants/schema';
import {
  INTERNAL_BACKUPS_DIR,
  METADATA_BACKUP_LATEST_FILE,
  METADATA_BACKUP_LATEST_TEMP_FILE,
  METADATA_BACKUP_PREVIOUS_FILE,
} from '@/constants/storage';
import {
  readPhotosRaw,
  readProjectsRaw,
  writePhotosRaw,
  writeProjectsRaw,
} from '@/data/rawMetadataStorage';
import { cancelAllProgressionNotifications } from '@/data/notificationService';
import type {
  MetadataSnapshot,
  MetadataSnapshotValidationResult,
} from '@/types/metadataSnapshot';
import { isValidDateString, isValidProjectType } from '@/utils/backup';
import { fileExists } from '@/utils/file';

let isRestoringMetadata = false;

function getInternalBackupsDirectory(): Directory {
  return new Directory(Paths.document, INTERNAL_BACKUPS_DIR);
}

export async function ensureInternalBackupsDirectory(): Promise<string> {
  const directory = getInternalBackupsDirectory();
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  return directory.uri;
}

export function getMetadataBackupLatestUri(): string {
  return new File(getInternalBackupsDirectory(), METADATA_BACKUP_LATEST_FILE).uri;
}

export function getMetadataBackupPreviousUri(): string {
  return new File(getInternalBackupsDirectory(), METADATA_BACKUP_PREVIOUS_FILE).uri;
}

function getMetadataBackupTempUri(): string {
  return new File(getInternalBackupsDirectory(), METADATA_BACKUP_LATEST_TEMP_FILE).uri;
}

export function validateMetadataSnapshot(
  snapshot: unknown
): MetadataSnapshotValidationResult {
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['This recovery snapshot is not valid.'] };
  }

  const value = snapshot as MetadataSnapshot;
  const errors: string[] = [];

  if (value.app !== 'Progression') {
    errors.push('This recovery snapshot is not valid.');
  }

  if (value.snapshotVersion !== 1) {
    errors.push('This recovery snapshot is not valid.');
  }

  if (typeof value.schemaVersion !== 'number') {
    errors.push('This recovery snapshot is not valid.');
  }

  if (
    typeof value.createdAt !== 'string' ||
    Number.isNaN(new Date(value.createdAt).getTime())
  ) {
    errors.push('This recovery snapshot is not valid.');
  }

  if (!Array.isArray(value.projects) || !Array.isArray(value.photos)) {
    errors.push('This recovery snapshot is not valid.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const projectIds = new Set<string>();

  for (const project of value.projects) {
    if (
      !project ||
      typeof project.id !== 'string' ||
      typeof project.name !== 'string' ||
      !project.name.trim() ||
      typeof project.createdAt !== 'string' ||
      typeof project.updatedAt !== 'string' ||
      !isValidProjectType(project.type)
    ) {
      errors.push('This recovery snapshot is not valid.');
      break;
    }

    projectIds.add(project.id);
  }

  for (const photo of value.photos) {
    if (
      !photo ||
      typeof photo.id !== 'string' ||
      typeof photo.projectId !== 'string' ||
      typeof photo.uri !== 'string' ||
      typeof photo.createdAt !== 'string' ||
      !isValidDateString(photo.date)
    ) {
      errors.push('This recovery snapshot is not valid.');
      break;
    }

    if (!projectIds.has(photo.projectId)) {
      errors.push('This recovery snapshot is not valid.');
      break;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    snapshot: value,
    errors: [],
  };
}

export async function writeMetadataSnapshotFile(
  uri: string,
  snapshot: MetadataSnapshot
): Promise<void> {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(JSON.stringify(snapshot, null, 2));
}

export async function readMetadataSnapshotFile(
  uri: string
): Promise<MetadataSnapshot | null> {
  try {
    const file = new File(uri);
    if (!file.exists) {
      return null;
    }

    const content = await file.text();
    const parsed = JSON.parse(content);
    const validation = validateMetadataSnapshot(parsed);
    return validation.valid ? validation.snapshot ?? null : null;
  } catch {
    return null;
  }
}

export async function rotateMetadataSnapshots(): Promise<void> {
  const latestUri = getMetadataBackupLatestUri();
  const previousUri = getMetadataBackupPreviousUri();

  const latestFile = new File(latestUri);
  const previousFile = new File(previousUri);

  if (!latestFile.exists) {
    return;
  }

  if (previousFile.exists) {
    previousFile.delete();
  }

  latestFile.copy(previousFile);
}

async function createMetadataSnapshotInternal(): Promise<void> {
  if (isRestoringMetadata) {
    return;
  }

  await ensureInternalBackupsDirectory();

  const [projects, photos] = await Promise.all([readProjectsRaw(), readPhotosRaw()]);

  const snapshot: MetadataSnapshot = {
    app: 'Progression',
    snapshotVersion: 1,
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    projects,
    photos,
  };

  const tempUri = getMetadataBackupTempUri();
  await writeMetadataSnapshotFile(tempUri, snapshot);

  const tempFile = new File(tempUri);
  if (!tempFile.exists) {
    throw new Error('Snapshot temp file was not created.');
  }

  await rotateMetadataSnapshots();

  const latestUri = getMetadataBackupLatestUri();
  const latestFile = new File(latestUri);
  if (latestFile.exists) {
    latestFile.delete();
  }

  tempFile.move(new File(latestUri));
}

export async function createMetadataSnapshot(): Promise<void> {
  try {
    await createMetadataSnapshotInternal();
  } catch {
    // Snapshot creation should never block normal app flow.
  }
}

export async function getLatestMetadataSnapshot(): Promise<MetadataSnapshot | null> {
  return readMetadataSnapshotFile(getMetadataBackupLatestUri());
}

export async function getPreviousMetadataSnapshot(): Promise<MetadataSnapshot | null> {
  return readMetadataSnapshotFile(getMetadataBackupPreviousUri());
}

async function restoreMetadataFromSnapshot(
  snapshot: MetadataSnapshot | null
): Promise<void> {
  if (!snapshot) {
    throw new Error('No local recovery snapshot found.');
  }

  const validation = validateMetadataSnapshot(snapshot);
  if (!validation.valid || !validation.snapshot) {
    throw new Error(validation.errors[0] ?? 'This recovery snapshot is not valid.');
  }

  try {
    isRestoringMetadata = true;
    await createMetadataSnapshotInternal();
  } catch {
    // Best effort only.
  } finally {
    isRestoringMetadata = false;
  }

  isRestoringMetadata = true;
  try {
    const sanitizedProjects = validation.snapshot.projects.map((project) => ({
      ...project,
      reminderSettings: {
        enabled: false,
        frequency: 'daily' as const,
        intervalValue: 1,
        intervalUnit: 'days' as const,
        timeHour: 20,
        timeMinute: 0,
        notificationIds: [] as string[],
      },
    }));

    await writeProjectsRaw(sanitizedProjects);
    await writePhotosRaw(validation.snapshot.photos);

    try {
      await cancelAllProgressionNotifications();
    } catch {
      // Best effort only.
    }
  } finally {
    isRestoringMetadata = false;
  }
}

export async function restoreMetadataFromLatestSnapshot(): Promise<void> {
  await restoreMetadataFromSnapshot(await getLatestMetadataSnapshot());
}

export async function restoreMetadataFromPreviousSnapshot(): Promise<void> {
  await restoreMetadataFromSnapshot(await getPreviousMetadataSnapshot());
}

export async function hasRecoverableMetadataSnapshot(): Promise<boolean> {
  const latest = await getLatestMetadataSnapshot();
  return Boolean(latest && (latest.projects.length > 0 || latest.photos.length > 0));
}

export async function getSnapshotStatus(): Promise<{
  latestCreatedAt: string | null;
  previousCreatedAt: string | null;
}> {
  const [latest, previous] = await Promise.all([
    getLatestMetadataSnapshot(),
    getPreviousMetadataSnapshot(),
  ]);

  return {
    latestCreatedAt: latest?.createdAt ?? null,
    previousCreatedAt: previous?.createdAt ?? null,
  };
}

export async function getLatestSnapshotFileHealth(): Promise<{
  projectCount: number;
  photoCount: number;
  missingFileCount: number;
  createdAt: string | null;
}> {
  const snapshot = await getLatestMetadataSnapshot();
  if (!snapshot) {
    return {
      projectCount: 0,
      photoCount: 0,
      missingFileCount: 0,
      createdAt: null,
    };
  }

  let missingFileCount = 0;
  for (const photo of snapshot.photos) {
    if (!(await fileExists(photo.uri))) {
      missingFileCount += 1;
    }
  }

  return {
    projectCount: snapshot.projects.length,
    photoCount: snapshot.photos.length,
    missingFileCount,
    createdAt: snapshot.createdAt,
  };
}
