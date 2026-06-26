import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppSettings } from '@/types/appSettings';

export const APP_SETTINGS_STORAGE_KEY = 'progression:app-settings';

const DEFAULT_APP_SETTINGS: AppSettings = {
  savePhotosToCameraRoll: false,
  savePhotosToDropbox: false,
};

function parseAppSettings(raw: string | null): AppSettings {
  if (!raw) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      savePhotosToCameraRoll: parsed.savePhotosToCameraRoll === true,
      savePhotosToDropbox: parsed.savePhotosToDropbox === true,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function getDefaultAppSettings(): AppSettings {
  return { ...DEFAULT_APP_SETTINGS };
}

export async function getAppSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(APP_SETTINGS_STORAGE_KEY);
  return parseAppSettings(raw);
}

export async function saveAppSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next: AppSettings = {
    ...current,
    ...updates,
  };

  await AsyncStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  return next;
}
