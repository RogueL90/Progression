import type { ProgressPhoto } from '@/types/photo';
import { createMetadataSnapshot } from '@/data/metadataSnapshotService';
import {
  readPhotosRaw,
  writePhotosRaw,
} from '@/data/rawMetadataStorage';
import { sortPhotosByDateDesc } from '@/utils/date';
import {
  copyPhotoToProjectStorage,
  deletePhotoFile,
  fileExists,
} from '@/utils/file';
import { getErrorMessage } from '@/utils/errors';

export const PHOTOS_STORAGE_KEY = 'progression:photos';
export const LEGACY_PHOTOS_STORAGE_KEY = 'face-progress:photos';

function generateId(date: string): string {
  return `${date}-${Date.now()}`;
}

async function pruneOrphans(photos: ProgressPhoto[]): Promise<ProgressPhoto[]> {
  const valid: ProgressPhoto[] = [];

  for (const photo of photos) {
    if (await fileExists(photo.uri)) {
      valid.push(photo);
    }
  }

  if (valid.length !== photos.length) {
    await writePhotosRaw(valid);
  }

  return valid;
}

async function savePhotoWithoutSnapshot(photo: ProgressPhoto): Promise<void> {
  const photos = await readPhotosRaw();
  const index = photos.findIndex(
    (item) => item.projectId === photo.projectId && item.date === photo.date
  );

  if (index >= 0) {
    const existing = photos[index];
    if (existing.uri !== photo.uri) {
      await deletePhotoFile(existing.uri);
    }
    photos[index] = photo;
  } else {
    photos.push(photo);
  }

  await writePhotosRaw(photos);
}

export async function getAllPhotos(): Promise<ProgressPhoto[]> {
  const photos = await pruneOrphans(await readPhotosRaw());
  return sortPhotosByDateDesc(photos);
}

export async function getPhotosForProject(projectId: string): Promise<ProgressPhoto[]> {
  const photos = await getAllPhotos();
  return photos.filter((photo) => photo.projectId === projectId);
}

export async function getLatestPhotoForProject(
  projectId: string
): Promise<ProgressPhoto | null> {
  const photos = await getPhotosForProject(projectId);
  if (photos.length === 0) {
    return null;
  }

  const sorted = sortPhotosByDateDesc(photos);
  const latest = sorted[0];

  if (!(await fileExists(latest.uri))) {
    await deletePhoto(latest.id, true);
    return getLatestPhotoForProject(projectId);
  }

  return latest;
}

export async function getPhotoById(photoId: string): Promise<ProgressPhoto | null> {
  const photos = await getAllPhotos();
  const photo = photos.find((item) => item.id === photoId) ?? null;
  if (!photo) {
    return null;
  }

  if (!(await fileExists(photo.uri))) {
    await deletePhoto(photo.id, true);
    return null;
  }

  return photo;
}

export async function getPhotoByDate(
  projectId: string,
  date: string
): Promise<ProgressPhoto | null> {
  const photos = await getPhotosForProject(projectId);
  const photo = photos.find((item) => item.date === date) ?? null;
  if (!photo) {
    return null;
  }

  if (!(await fileExists(photo.uri))) {
    await deletePhoto(photo.id, true);
    return null;
  }

  return photo;
}

export async function savePhoto(
  photo: ProgressPhoto,
  skipSnapshot = false
): Promise<void> {
  if (!skipSnapshot) {
    await createMetadataSnapshot();
  }

  await savePhotoWithoutSnapshot(photo);
}

export async function deletePhoto(
  photoId: string,
  skipSnapshot = false
): Promise<void> {
  if (!skipSnapshot) {
    await createMetadataSnapshot();
  }

  const photos = await readPhotosRaw();
  const photo = photos.find((item) => item.id === photoId);
  if (photo) {
    await deletePhotoFile(photo.uri);
  }

  await writePhotosRaw(photos.filter((item) => item.id !== photoId));
}

export async function deletePhotosForProject(
  projectId: string,
  skipSnapshot = false
): Promise<void> {
  if (!skipSnapshot) {
    await createMetadataSnapshot();
  }

  const photos = await readPhotosRaw();
  const projectPhotos = photos.filter((photo) => photo.projectId === projectId);

  for (const photo of projectPhotos) {
    await deletePhotoFile(photo.uri);
  }

  await writePhotosRaw(photos.filter((photo) => photo.projectId !== projectId));
}

export async function replacePhotoForDate(
  projectId: string,
  date: string,
  tempUri: string
): Promise<ProgressPhoto> {
  await createMetadataSnapshot();

  let permanentUri: string | null = null;
  let previousUri: string | null = null;

  try {
    const existing = (await readPhotosRaw()).find(
      (photo) => photo.projectId === projectId && photo.date === date
    );
    previousUri = existing?.uri ?? null;

    permanentUri = await copyPhotoToProjectStorage(tempUri, projectId, date);

    const now = new Date().toISOString();
    const photo: ProgressPhoto = {
      id: generateId(date),
      projectId,
      date,
      uri: permanentUri,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await savePhotoWithoutSnapshot(photo);

    try {
      await touchProjectAfterPhotoSave(projectId, permanentUri);
    } catch (error) {
      throw new Error(
        getErrorMessage(error, 'Photo saved, but project details could not be updated.')
      );
    }

    return photo;
  } catch (error) {
    if (permanentUri && permanentUri !== previousUri) {
      await deletePhotoFile(permanentUri);
    }

    throw new Error(getErrorMessage(error, 'Could not save this photo. Please try again.'));
  }
}

export async function touchProjectAfterPhotoSave(
  projectId: string,
  coverPhotoUri: string
): Promise<void> {
  const { updateProject } = await import('@/data/projectStorage');
  await updateProject(projectId, { coverPhotoUri });
}

export async function appendImportedPhotos(photos: ProgressPhoto[]): Promise<void> {
  if (photos.length === 0) {
    return;
  }

  const existing = await readPhotosRaw();
  await writePhotosRaw([...existing, ...photos]);
}

export async function persistPhotosDirect(photos: ProgressPhoto[]): Promise<void> {
  await writePhotosRaw(photos);
}
