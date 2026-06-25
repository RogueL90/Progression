import { Directory, File, Paths } from 'expo-file-system';

import {
  INTERNAL_BACKUPS_DIR,
  PROGRESSION_ROOT_DIR,
} from '@/constants/storage';

export const PROJECTS_DIR = 'projects';
export const PHOTOS_DIR = 'photos';
export const EXPORTS_DIR = 'exports';

function getExportDirectory(): Directory {
  return new Directory(Paths.cache, PROGRESSION_ROOT_DIR, EXPORTS_DIR);
}

function getProjectDirectory(projectId: string): Directory {
  return new Directory(Paths.document, PROGRESSION_ROOT_DIR, PROJECTS_DIR, projectId);
}

function getProjectPhotosDirectory(projectId: string): Directory {
  return new Directory(getProjectDirectory(projectId), PHOTOS_DIR);
}

export async function ensureProjectPhotosDirectory(projectId: string): Promise<string> {
  const projectDir = getProjectDirectory(projectId);
  if (!projectDir.exists) {
    projectDir.create({ intermediates: true, idempotent: true });
  }

  const photosDir = getProjectPhotosDirectory(projectId);
  if (!photosDir.exists) {
    photosDir.create({ intermediates: true, idempotent: true });
  }

  return photosDir.uri;
}

export async function getProjectPhotoFilePath(
  projectId: string,
  date: string
): Promise<string> {
  await ensureProjectPhotosDirectory(projectId);
  return new File(getProjectPhotosDirectory(projectId), `${date}.jpg`).uri;
}

export async function copyPhotoToProjectStorage(
  tempUri: string,
  projectId: string,
  date: string
): Promise<string> {
  await ensureProjectPhotosDirectory(projectId);
  const destFile = new File(getProjectPhotosDirectory(projectId), `${date}.jpg`);
  const sourceFile = new File(tempUri);

  if (destFile.exists) {
    destFile.delete();
  }

  sourceFile.copy(destFile);
  return destFile.uri;
}

export async function deletePhotoFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // File may already be gone
  }
}

export async function deleteProjectDirectory(projectId: string): Promise<void> {
  try {
    const projectDir = getProjectDirectory(projectId);
    if (projectDir.exists) {
      projectDir.delete();
    }
  } catch {
    // Directory may already be gone
  }
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export async function ensureExportDirectory(): Promise<string> {
  const exportDir = getExportDirectory();
  if (!exportDir.exists) {
    exportDir.create({ intermediates: true, idempotent: true });
  }
  return exportDir.uri;
}

export async function ensureInternalBackupsFileDirectory(): Promise<string> {
  const directory = new Directory(Paths.document, INTERNAL_BACKUPS_DIR);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  return directory.uri;
}

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

export async function writeFileBytes(uri: string, bytes: Uint8Array): Promise<void> {
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);
}
