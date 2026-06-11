import { useCallback, useEffect, useState } from 'react';

import {
  deletePhoto as deletePhotoFromStorage,
  getPhotosForProject,
} from '@/data/photoStorage';
import type { ProgressPhoto } from '@/types/photo';

export function useProjectPhotos(projectId: string | undefined) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPhotos = useCallback(async () => {
    if (!projectId) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await getPhotosForProject(projectId);
      setPhotos(result);
    } catch {
      setError('Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const deletePhoto = useCallback(
    async (photoId: string) => {
      await deletePhotoFromStorage(photoId);
      await refreshPhotos();
    },
    [refreshPhotos]
  );

  useEffect(() => {
    refreshPhotos();
  }, [refreshPhotos]);

  return {
    photos,
    loading,
    error,
    refreshPhotos,
    deletePhoto,
  };
}
