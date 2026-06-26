import { useCallback, useEffect, useState } from 'react';

import {
  getCaptureSettings,
  getDefaultCaptureSettings,
  saveCaptureSettings,
} from '@/data/captureSettingsStorage';
import type { CaptureSettings } from '@/types/captureSettings';

export function useCaptureSettings() {
  const [settings, setSettings] = useState<CaptureSettings>(getDefaultCaptureSettings());
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCaptureSettings();
      setSettings(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<CaptureSettings>) => {
    const next = await saveCaptureSettings(updates);
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
