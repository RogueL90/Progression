import { useCallback, useEffect, useState } from 'react';

import { rememberProjectName } from '@/data/projectNameCache';
import { getProjectById } from '@/data/projectStorage';
import type { Project } from '@/types/project';

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await getProjectById(projectId);
      if (result) {
        rememberProjectName(result.id, result.name);
      }
      setProject(result);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refreshProject();
  }, [refreshProject]);

  return {
    project,
    loading,
    refreshProject,
  };
}
