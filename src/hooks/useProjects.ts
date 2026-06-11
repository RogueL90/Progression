import { useCallback, useEffect, useState } from 'react';

import {
  createProject as createProjectInStorage,
  deleteProject as deleteProjectInStorage,
  getAllProjects,
} from '@/data/projectStorage';
import type { Project, ProjectType } from '@/types/project';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllProjects();
      setProjects(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (input: { name: string; type: ProjectType }) => {
      const project = await createProjectInStorage(input);
      await refreshProjects();
      return project;
    },
    [refreshProjects]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await deleteProjectInStorage(projectId);
      await refreshProjects();
    },
    [refreshProjects]
  );

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return {
    projects,
    loading,
    refreshProjects,
    createProject,
    deleteProject,
  };
}
