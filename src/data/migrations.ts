import AsyncStorage from '@react-native-async-storage/async-storage';

import { createMetadataSnapshot } from '@/data/metadataSnapshotService';
import { readProjectsRaw, writePhotosRaw, writeProjectsRaw } from '@/data/rawMetadataStorage';
import { LEGACY_PHOTOS_STORAGE_KEY } from '@/data/photoStorage';
import type { ProgressPhoto } from '@/types/photo';
import type { Project } from '@/types/project';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function runMigrations(): Promise<void> {
  const existingProjects = await readProjectsRaw();
  if (existingProjects.length > 0) {
    return;
  }

  const legacyRaw = await AsyncStorage.getItem(LEGACY_PHOTOS_STORAGE_KEY);
  if (!legacyRaw) {
    return;
  }

  let legacyPhotos: ProgressPhoto[] = [];
  try {
    const parsed = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return;
    }
    legacyPhotos = parsed;
  } catch {
    return;
  }

  await createMetadataSnapshot();

  const sortedLegacy = [...legacyPhotos].sort((a, b) => b.date.localeCompare(a.date));
  const now = new Date().toISOString();
  const projectId = generateId();
  const project: Project = {
    id: projectId,
    name: 'Selfie Progress',
    type: 'selfie',
    createdAt: now,
    updatedAt: now,
    coverPhotoUri: sortedLegacy[0]?.uri,
  };

  const migratedPhotos: ProgressPhoto[] = legacyPhotos.map((photo) => ({
    ...photo,
    projectId,
  }));

  await writeProjectsRaw([project]);
  await writePhotosRaw(migratedPhotos);
}
