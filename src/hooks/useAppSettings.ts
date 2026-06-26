import { useCallback, useEffect, useState } from 'react';

import {
  getAppSettings,
  getDefaultAppSettings,
  saveAppSettings,
} from '@/data/appSettingsStorage';
import type { AppSettings } from '@/types/appSettings';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(getDefaultAppSettings());
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAppSettings();
      setSettings(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const next = await saveAppSettings(updates);
    setSettings(next);
    return next;
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  return {
    settings,
    loading,
    refreshSettings,
    updateSettings,
  };
}
