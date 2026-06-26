import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CaptureSettings, GridDensity } from '@/types/captureSettings';

export const CAPTURE_SETTINGS_STORAGE_KEY = 'progression:capture-settings';

const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  showGrid: false,
  gridDensity: 'few',
  showGhost: false,
};

function isGridDensity(value: unknown): value is GridDensity {
  return value === 'few' || value === 'many';
}

function parseCaptureSettings(raw: string | null): CaptureSettings {
  if (!raw) {
    return { ...DEFAULT_CAPTURE_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CaptureSettings>;
    return {
      showGrid: parsed.showGrid === true,
      gridDensity: isGridDensity(parsed.gridDensity) ? parsed.gridDensity : 'few',
      showGhost: parsed.showGhost === true,
    };
  } catch {
    return { ...DEFAULT_CAPTURE_SETTINGS };
  }
}

export function getDefaultCaptureSettings(): CaptureSettings {
  return { ...DEFAULT_CAPTURE_SETTINGS };
}

export async function getCaptureSettings(): Promise<CaptureSettings> {
  const raw = await AsyncStorage.getItem(CAPTURE_SETTINGS_STORAGE_KEY);
  return parseCaptureSettings(raw);
}

export async function saveCaptureSettings(
  updates: Partial<CaptureSettings>
): Promise<CaptureSettings> {
  const current = await getCaptureSettings();
  const next: CaptureSettings = {
    ...current,
    ...updates,
  };

  await AsyncStorage.setItem(CAPTURE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  return next;
}
