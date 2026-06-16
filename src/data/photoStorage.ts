import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ProgressPhoto } from '@/types/photo';
import { sortPhotosByDateDesc } from '@/utils/date';
import {
  copyPhotoToProjectStorage,
  deletePhotoFile,
  fileExists,
} from '@/utils/file';

export const PHOTOS_STORAGE_KEY = 'progression:photos';
export const LEGACY_PHOTOS_STORAGE_KEY = 'face-progress:photos';

async function loadPhotosRaw(): Promise<ProgressPhoto[]> {
  const raw = await AsyncStorage.getItem(PHOTOS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ProgressPhoto[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function persistPhotosDirect(photos: ProgressPhoto[]): Promise<void> {
  await AsyncStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));
}

async function persistPhotos(photos: ProgressPhoto[]): Promise<void> {
  await persistPhotosDirect(photos);
}

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
    await persistPhotos(valid);
  }

  return valid;
}

export async function getAllPhotos(): Promise<ProgressPhoto[]> {
  const photos = await pruneOrphans(await loadPhotosRaw());
  return sortPhotosByDateDesc(photos);
}

export async function getPhotosForProject(projectId: string): Promise<ProgressPhoto[]> {
  const photos = await getAllPhotos();
  return photos.filter((p) => p.projectId === projectId);
}

export async function getPhotoById(photoId: string): Promise<ProgressPhoto | null> {
  const photos = await getAllPhotos();
  const photo = photos.find((p) => p.id === photoId) ?? null;
  if (!photo) return null;
  if (!(await fileExists(photo.uri))) {
    await deletePhoto(photo.id);
    return null;
  }
  return photo;
}

export async function getPhotoByDate(
  projectId: string,
  date: string
): Promise<ProgressPhoto | null> {
  const photos = await getPhotosForProject(projectId);
  const photo = photos.find((p) => p.date === date) ?? null;
  if (!photo) return null;
  if (!(await fileExists(photo.uri))) {
    await deletePhoto(photo.id);
    return null;
  }
  return photo;
}

export async function savePhoto(photo: ProgressPhoto): Promise<void> {
  const photos = await loadPhotosRaw();
  const index = photos.findIndex(
    (p) => p.projectId === photo.projectId && p.date === photo.date
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

  await persistPhotos(photos);
}

export async function deletePhoto(photoId: string): Promise<void> {
  const photos = await loadPhotosRaw();
  const photo = photos.find((p) => p.id === photoId);
  if (photo) {
    await deletePhotoFile(photo.uri);
  }
  await persistPhotos(photos.filter((p) => p.id !== photoId));
}

export async function deletePhotosForProject(projectId: string): Promise<void> {
  const photos = await loadPhotosRaw();
  const projectPhotos = photos.filter((p) => p.projectId === projectId);

  for (const photo of projectPhotos) {
    await deletePhotoFile(photo.uri);
  }

  await persistPhotos(photos.filter((p) => p.projectId !== projectId));
}

export async function replacePhotoForDate(
  projectId: string,
  date: string,
  tempUri: string
): Promise<ProgressPhoto> {
  const permanentUri = await copyPhotoToProjectStorage(tempUri, projectId, date);
  const now = new Date().toISOString();
  const existing = (await loadPhotosRaw()).find(
    (p) => p.projectId === projectId && p.date === date
  );

  const photo: ProgressPhoto = {
    id: generateId(date),
    projectId,
    date,
    uri: permanentUri,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await savePhoto(photo);
  await touchProjectAfterPhotoSave(projectId, permanentUri);
  return photo;
}

export async function touchProjectAfterPhotoSave(
  projectId: string,
  coverPhotoUri: string
): Promise<void> {
  const { updateProject } = await import('@/data/projectStorage');
  await updateProject(projectId, { coverPhotoUri });
}

export async function appendImportedPhotos(photos: ProgressPhoto[]): Promise<void> {
  if (photos.length === 0) return;
  const existing = await loadPhotosRaw();
  await persistPhotosDirect([...existing, ...photos]);
}
