import JSZip from 'jszip';

import {
  appendImportedPhotos,
  getPhotosForProject,
} from '@/data/photoStorage';
import {
  createProject,
  deleteProject,
  getProjectById,
  updateProject,
} from '@/data/projectStorage';
import type {
  BackupManifest,
  BackupPhotoManifestItem,
  BackupValidationResult,
} from '@/types/backup';
import type { ProgressPhoto } from '@/types/photo';
import type { Project } from '@/types/project';
import {
  getBackupFileName,
  getUniqueImportedProjectName,
  isValidDateString,
  isValidProjectType,
  resolvePhotoFileName,
} from '@/utils/backup';
import {
  ensureExportDirectory,
  ensureProjectPhotosDirectory,
  fileExists,
  getProjectPhotoFilePath,
  readFileBytes,
  writeFileBytes,
} from '@/utils/file';
import { File, Paths } from 'expo-file-system';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readZipBytes(zipUri: string): Promise<Uint8Array> {
  return readFileBytes(zipUri);
}

async function writeZipBytes(fileName: string, bytes: Uint8Array): Promise<string> {
  await ensureExportDirectory();
  const zipFile = new File(Paths.cache, 'progression', 'exports', fileName);
  await writeFileBytes(zipFile.uri, bytes);
  return zipFile.uri;
}

function parseManifest(data: unknown): BackupManifest | null {
  if (!data || typeof data !== 'object') return null;
  return data as BackupManifest;
}

export async function exportProjectBackup(projectId: string): Promise<string> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }

  const photos = await getPhotosForProject(projectId);
  const usedNames = new Set<string>();
  const manifestPhotos: BackupPhotoManifestItem[] = [];
  const zip = new JSZip();
  let coverPhotoFileName: string | undefined;

  for (const photo of photos) {
    if (!(await fileExists(photo.uri))) {
      continue;
    }

    const fileName = resolvePhotoFileName(photo.date, usedNames);
    const bytes = await readFileBytes(photo.uri);
    zip.file(`photos/${fileName}`, bytes);

    manifestPhotos.push({
      id: photo.id,
      projectId: photo.projectId,
      date: photo.date,
      fileName,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
      notes: photo.notes,
    });

    if (project.coverPhotoUri && photo.uri === project.coverPhotoUri) {
      coverPhotoFileName = fileName;
    }
  }

  if (!coverPhotoFileName && manifestPhotos.length > 0) {
    coverPhotoFileName = manifestPhotos[0].fileName;
  }

  const manifest: BackupManifest = {
    app: 'Progression',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      coverPhotoFileName,
    },
    photos: manifestPhotos,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipUri = await writeZipBytes(getBackupFileName(project.name), zipBytes);

  await updateProject(projectId, {
    lastBackedUpAt: new Date().toISOString(),
  });

  return zipUri;
}

export async function validateBackupZip(zipUri: string): Promise<BackupValidationResult> {
  const errors: string[] = [];

  try {
    const zipBytes = await readZipBytes(zipUri);
    const zip = await JSZip.loadAsync(zipBytes);

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return {
        valid: false,
        errors: ['This backup is missing manifest.json.'],
      };
    }

    let manifest: BackupManifest | null = null;
    try {
      const manifestText = await manifestFile.async('string');
      manifest = parseManifest(JSON.parse(manifestText));
    } catch {
      return {
        valid: false,
        errors: ['This backup has an invalid manifest.json file.'],
      };
    }

    if (!manifest) {
      return {
        valid: false,
        errors: ['This does not look like a valid Progression backup.'],
      };
    }

    if (manifest.app !== 'Progression') {
      errors.push('This does not look like a valid Progression backup.');
    }

    if (manifest.backupVersion !== 1) {
      errors.push('This backup uses an unsupported backup version.');
    }

    if (!manifest.project?.name?.trim()) {
      errors.push('This backup is missing a project name.');
    }

    if (!manifest.project?.type || !isValidProjectType(manifest.project.type)) {
      errors.push('This backup has an invalid project type.');
    }

    if (!Array.isArray(manifest.photos)) {
      errors.push('This backup has invalid photo metadata.');
    } else {
      for (const photo of manifest.photos) {
        if (!photo.id || !photo.projectId || !photo.date || !photo.fileName || !photo.createdAt) {
          errors.push('This backup has incomplete photo metadata.');
          break;
        }
        if (!isValidDateString(photo.date)) {
          errors.push(`This backup has an invalid photo date: ${photo.date}.`);
          break;
        }
        const photoFile = zip.file(`photos/${photo.fileName}`);
        if (!photoFile) {
          errors.push(`Some photo files are missing from the backup (${photo.fileName}).`);
          break;
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      manifest,
      photoCount: manifest.photos.length,
      errors: [],
    };
  } catch {
    return {
      valid: false,
      errors: ['This does not look like a valid Progression backup.'],
    };
  }
}

export async function importProjectBackup(zipUri: string): Promise<Project> {
  const validation = await validateBackupZip(zipUri);
  if (!validation.valid || !validation.manifest) {
    throw new Error(validation.errors[0] ?? 'Could not import this backup.');
  }

  const manifest = validation.manifest;
  let newProject: Project | null = null;

  try {
    const uniqueName = await getUniqueImportedProjectName(manifest.project.name);
    newProject = await createProject({
      name: uniqueName,
      type: manifest.project.type,
    });

    const zipBytes = await readZipBytes(zipUri);
    const zip = await JSZip.loadAsync(zipBytes);
    const importedPhotos: ProgressPhoto[] = [];
    const fileNameToUri = new Map<string, string>();

    for (const item of manifest.photos) {
      const photoFile = zip.file(`photos/${item.fileName}`);
      if (!photoFile) {
        throw new Error('Some photo files are missing from the backup.');
      }

      const bytes = await photoFile.async('uint8array');
      await ensureProjectPhotosDirectory(newProject.id);
      const destinationUri = await getProjectPhotoFilePath(newProject.id, item.date);
      await writeFileBytes(destinationUri, bytes);

      const photo: ProgressPhoto = {
        id: generateId(item.date),
        projectId: newProject.id,
        date: item.date,
        uri: destinationUri,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        notes: item.notes,
      };

      importedPhotos.push(photo);
      fileNameToUri.set(item.fileName, destinationUri);
    }

    await appendImportedPhotos(importedPhotos);

    let coverPhotoUri: string | undefined;
    if (manifest.project.coverPhotoFileName) {
      coverPhotoUri = fileNameToUri.get(manifest.project.coverPhotoFileName);
    }
    if (!coverPhotoUri && importedPhotos.length > 0) {
      coverPhotoUri = importedPhotos[0].uri;
    }

    if (coverPhotoUri) {
      newProject = await updateProject(newProject.id, { coverPhotoUri });
    }

    return newProject;
  } catch (error) {
    if (newProject) {
      await deleteProject(newProject.id);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Could not import this backup.');
  }
}
