import type {
  Project,
  ProjectReminderSettings,
  ProjectType,
} from '@/types/project';
import { NOTIFICATIONS_ENABLED } from '@/constants/featureFlags';
import { createMetadataSnapshot } from '@/data/metadataSnapshotService';
import {
  cancelProjectReminders,
  requestNotificationPermissions,
  rescheduleProjectReminder,
  resolveReminderSettings,
} from '@/data/notificationService';
import { deletePhotosForProject } from '@/data/photoStorage';
import {
  readProjectsRaw,
  writeProjectsRaw,
} from '@/data/rawMetadataStorage';
import { deleteProjectDirectory } from '@/utils/file';

export const PROJECTS_STORAGE_KEY = 'progression:projects';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Assign sortOrder from legacy updatedAt order when missing, and persist if needed. */
async function readProjectsWithSortOrder(): Promise<Project[]> {
  const projects = await readProjectsRaw();
  if (projects.length === 0) {
    return [];
  }

  const needsMigration = projects.some(
    (project) => typeof project.sortOrder !== 'number'
  );

  if (!needsMigration) {
    return sortProjects(projects);
  }

  const migrated = [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((project, index) => ({
      ...project,
      sortOrder: index,
    }));

  await writeProjectsRaw(migrated);
  return migrated;
}

export function getDefaultReminderSettings(): ProjectReminderSettings {
  return {
    enabled: false,
    frequency: 'daily',
    intervalValue: 1,
    intervalUnit: 'days',
    timeHour: 20,
    timeMinute: 0,
    notificationIds: [],
  };
}

export async function getAllProjects(): Promise<Project[]> {
  return readProjectsWithSortOrder();
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const projects = await readProjectsWithSortOrder();
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function createProject(input: {
  name: string;
  type: ProjectType;
}): Promise<Project> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Project name cannot be empty');
  }

  await createMetadataSnapshot();

  const now = new Date().toISOString();
  const projects = await readProjectsWithSortOrder();
  const project: Project = {
    id: generateId(),
    name: trimmedName,
    type: input.type,
    createdAt: now,
    updatedAt: now,
    sortOrder: 0,
    reminderSettings: getDefaultReminderSettings(),
  };

  const shifted = projects.map((existing) => ({
    ...existing,
    sortOrder: existing.sortOrder + 1,
  }));
  await writeProjectsRaw([project, ...shifted]);
  return project;
}

export async function reorderProjects(orderedIds: string[]): Promise<void> {
  const projects = await readProjectsWithSortOrder();
  if (projects.length === 0) {
    return;
  }

  // Never persist an empty order over existing projects.
  if (orderedIds.length === 0) {
    throw new Error('Cannot reorder with an empty project list.');
  }

  const byId = new Map(projects.map((project) => [project.id, project]));
  const reordered: Project[] = [];

  for (const id of orderedIds) {
    const project = byId.get(id);
    if (!project) {
      continue;
    }
    reordered.push({
      ...project,
      sortOrder: reordered.length,
    });
    byId.delete(id);
  }

  if (reordered.length === 0) {
    throw new Error('Cannot reorder: none of the given project ids were found.');
  }

  for (const project of byId.values()) {
    reordered.push({
      ...project,
      sortOrder: reordered.length,
    });
  }

  await createMetadataSnapshot();
  await writeProjectsRaw(reordered);
}

export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project> {
  await createMetadataSnapshot();

  const projects = await readProjectsRaw();
  const index = projects.findIndex((project) => project.id === projectId);
  if (index < 0) {
    throw new Error('Project not found');
  }

  const updatedProject: Project = {
    ...projects[index],
    ...updates,
    id: projects[index].id,
    createdAt: projects[index].createdAt,
    updatedAt: new Date().toISOString(),
  };

  projects[index] = updatedProject;
  await writeProjectsRaw(projects);
  return updatedProject;
}

export async function updateProjectReminderSettings(
  projectId: string,
  settings: ProjectReminderSettings
): Promise<Project> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  await createMetadataSnapshot();
  await cancelProjectReminders(project);

  let nextSettings: ProjectReminderSettings = {
    ...resolveReminderSettings(settings),
    notificationIds: [],
  };

  // Notifications temporarily disabled — see docs/NOTIFICATIONS.md
  if (!NOTIFICATIONS_ENABLED) {
    nextSettings = {
      ...nextSettings,
      enabled: false,
      notificationIds: [],
    };
    return updateProject(projectId, { reminderSettings: nextSettings });
  }

  if (nextSettings.enabled) {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      nextSettings = {
        ...nextSettings,
        enabled: false,
        notificationIds: [],
      };
    } else {
      try {
        nextSettings = await rescheduleProjectReminder(project, nextSettings);
      } catch {
        nextSettings = {
          ...nextSettings,
          enabled: false,
          notificationIds: [],
        };
      }
    }
  }

  return updateProject(projectId, { reminderSettings: nextSettings });
}

export async function deleteProject(projectId: string): Promise<void> {
  const project = await getProjectById(projectId);

  if (project) {
    try {
      await cancelProjectReminders(project);
    } catch {
      // Never block project deletion.
    }
  }

  await createMetadataSnapshot();
  await deletePhotosForProject(projectId, true);
  await deleteProjectDirectory(projectId);

  const projects = await readProjectsRaw();
  await writeProjectsRaw(projects.filter((p) => p.id !== projectId));
}

export async function persistProjectsDirect(projects: Project[]): Promise<void> {
  await writeProjectsRaw(projects);
}
