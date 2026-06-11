import { Directory, File, Paths } from 'expo-file-system';

export const STORAGE_ROOT = 'progression';
export const PROJECTS_DIR = 'projects';
export const PHOTOS_DIR = 'photos';

function getProjectDirectory(projectId: string): Directory {
  return new Directory(Paths.document, STORAGE_ROOT, PROJECTS_DIR, projectId);
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
