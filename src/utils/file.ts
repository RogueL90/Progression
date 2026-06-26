import { Directory, File, Paths } from 'expo-file-system';

import {
  INTERNAL_BACKUPS_DIR,
  PROGRESSION_ROOT_DIR,
} from '@/constants/storage';
import { getErrorMessage } from '@/utils/errors';

export const PROJECTS_DIR = 'projects';
export const PHOTOS_DIR = 'photos';
export const EXPORTS_DIR = 'exports';

const DATE_PHOTO_FILE_REGEX = /^\d{4}-\d{2}-\d{2}\.jpg$/;

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
  try {
    const projectDir = getProjectDirectory(projectId);
    if (!projectDir.exists) {
      projectDir.create({ intermediates: true, idempotent: true });
    }

    const photosDir = getProjectPhotosDirectory(projectId);
    if (!photosDir.exists) {
      photosDir.create({ intermediates: true, idempotent: true });
    }

    return photosDir.uri;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, 'Could not prepare photo storage for this project.')
    );
  }
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
  if (!(await fileExists(tempUri))) {
    throw new Error('The captured photo could not be found.');
  }

  try {
    await ensureProjectPhotosDirectory(projectId);
    const destFile = new File(getProjectPhotosDirectory(projectId), `${date}.jpg`);
    const sourceFile = new File(tempUri);

    if (destFile.exists) {
      destFile.delete();
    }

    sourceFile.copy(destFile);

    if (!(await fileExists(destFile.uri))) {
      throw new Error('Could not save the photo to storage.');
    }

    return destFile.uri;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Could not')) {
      throw error;
    }

    throw new Error(getErrorMessage(error, 'Could not save the photo to storage.'));
  }
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
  try {
    const exportDir = getExportDirectory();
    if (!exportDir.exists) {
      exportDir.create({ intermediates: true, idempotent: true });
    }
    return exportDir.uri;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Could not prepare export storage.'));
  }
}

export async function ensureInternalBackupsFileDirectory(): Promise<string> {
  const directory = new Directory(Paths.document, INTERNAL_BACKUPS_DIR);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  return directory.uri;
}

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  try {
    if (!(await fileExists(uri))) {
      throw new Error('A required file could not be found.');
    }

    return await new File(uri).bytes();
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Could not read a required file.'));
  }
}

export async function writeFileBytes(uri: string, bytes: Uint8Array): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }

    file.create();
    file.write(bytes);

    if (!(await fileExists(uri))) {
      throw new Error('Could not write file to storage.');
    }
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Could not write file to storage.'));
  }
}

export function isDatePhotoFileName(fileName: string): boolean {
  return DATE_PHOTO_FILE_REGEX.test(fileName);
}

export function getProjectsRootDirectory(): Directory {
  return new Directory(Paths.document, PROGRESSION_ROOT_DIR, PROJECTS_DIR);
}

export function getProjectPhotosDirectoryForProject(projectId: string): Directory {
  return getProjectPhotosDirectory(projectId);
}
