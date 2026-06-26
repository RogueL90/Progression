import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProgressPhoto } from '@/types/photo';
import type { Project } from '@/types/project';

const RAW_PROJECTS_STORAGE_KEY = 'progression:projects';
const RAW_PHOTOS_STORAGE_KEY = 'progression:photos';

export type RawMetadataReadResult<T> = {
  data: T;
  corrupted: boolean;
  missing: boolean;
};

function parseArray<T>(raw: string | null): RawMetadataReadResult<T[]> {
  if (!raw) {
    return { data: [], corrupted: false, missing: true };
  }

  try {
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed)) {
      return { data: [], corrupted: true, missing: false };
    }

    return { data: parsed, corrupted: false, missing: false };
  } catch {
    return { data: [], corrupted: true, missing: false };
  }
}

export async function readProjectsRawResult(): Promise<RawMetadataReadResult<Project[]>> {
  return parseArray<Project>(await AsyncStorage.getItem(RAW_PROJECTS_STORAGE_KEY));
}

export async function writeProjectsRaw(projects: Project[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RAW_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    throw new Error('Could not save project data. Please try again.');
  }
}

export async function readPhotosRawResult(): Promise<RawMetadataReadResult<ProgressPhoto[]>> {
  return parseArray<ProgressPhoto>(await AsyncStorage.getItem(RAW_PHOTOS_STORAGE_KEY));
}

export async function writePhotosRaw(photos: ProgressPhoto[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RAW_PHOTOS_STORAGE_KEY, JSON.stringify(photos));
  } catch {
    throw new Error('Could not save photo data. Please try again.');
  }
}

export async function readProjectsRaw(): Promise<Project[]> {
  return (await readProjectsRawResult()).data;
}

export async function readPhotosRaw(): Promise<ProgressPhoto[]> {
  return (await readPhotosRawResult()).data;
}
