import { useCallback, useEffect, useState } from 'react';

import { getPhotoByDate } from '@/data/photoStorage';
import type { ProgressPhoto } from '@/types/photo';
import { getTodayDateString } from '@/utils/date';

export function useTodayPhoto(projectId: string | undefined) {
  const [todayPhoto, setTodayPhoto] = useState<ProgressPhoto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTodayPhoto = useCallback(async () => {
    if (!projectId) {
      setTodayPhoto(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const today = getTodayDateString();
      const photo = await getPhotoByDate(projectId, today);
      setTodayPhoto(photo);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refreshTodayPhoto();
  }, [refreshTodayPhoto]);

  return {
    todayPhoto,
    hasPhotoToday: todayPhoto !== null,
    loading,
    refreshTodayPhoto,
  };
}
