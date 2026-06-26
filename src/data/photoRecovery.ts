import { Directory, File } from 'expo-file-system';

import { readPhotosRaw, readProjectsRaw, writePhotosRaw } from '@/data/rawMetadataStorage';
import type { ProgressPhoto } from '@/types/photo';
import {
  getProjectPhotosDirectoryForProject,
  getProjectsRootDirectory,
  isDatePhotoFileName,
} from '@/utils/file';

function generateRecoveredPhotoId(date: string): string {
  return `${date}-recovered-${Date.now()}`;
}

export async function recoverOrphanedProjectPhotos(): Promise<number> {
  const projects = await readProjectsRaw();
  const photos = await readPhotosRaw();
  const projectIds = new Set(projects.map((project) => project.id));
  const existingKeys = new Set(photos.map((photo) => `${photo.projectId}:${photo.date}`));
  const recovered: ProgressPhoto[] = [];

  const projectsRoot = getProjectsRootDirectory();
  if (!projectsRoot.exists) {
    return 0;
  }

  for (const entry of projectsRoot.list()) {
    if (!(entry instanceof Directory)) {
      continue;
    }

    const projectId = entry.name;
    if (!projectIds.has(projectId)) {
      continue;
    }

    const photosDir = getProjectPhotosDirectoryForProject(projectId);
    if (!photosDir.exists) {
      continue;
    }

    for (const photoEntry of photosDir.list()) {
      if (!(photoEntry instanceof File)) {
        continue;
      }

      const fileName = photoEntry.name;
      if (!isDatePhotoFileName(fileName)) {
        continue;
      }

      const date = fileName.replace('.jpg', '');
      const key = `${projectId}:${date}`;
      if (existingKeys.has(key)) {
        continue;
      }

      if (!photoEntry.exists) {
        continue;
      }

      const now = new Date().toISOString();
      recovered.push({
        id: generateRecoveredPhotoId(date),
        projectId,
        date,
        uri: photoEntry.uri,
        createdAt: now,
        updatedAt: now,
      });
      existingKeys.add(key);
    }
  }

  if (recovered.length === 0) {
    return 0;
  }

  await writePhotosRaw([...photos, ...recovered]);
  return recovered.length;
}
