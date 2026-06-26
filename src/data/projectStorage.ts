import type {
  Project,
  ProjectReminderSettings,
  ProjectType,
} from '@/types/project';
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
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
  return sortProjects(await readProjectsRaw());
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const projects = await readProjectsRaw();
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
  const project: Project = {
    id: generateId(),
    name: trimmedName,
    type: input.type,
    createdAt: now,
    updatedAt: now,
    reminderSettings: getDefaultReminderSettings(),
  };

  const projects = await readProjectsRaw();
  projects.push(project);
  await writeProjectsRaw(projects);
  return project;
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
