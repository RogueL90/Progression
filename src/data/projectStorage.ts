import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Project, ProjectType } from '@/types/project';
import { deletePhotosForProject } from '@/data/photoStorage';
import { deleteProjectDirectory } from '@/utils/file';

export const PROJECTS_STORAGE_KEY = 'progression:projects';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function loadProjectsRaw(): Promise<Project[]> {
  const raw = await AsyncStorage.getItem(PROJECTS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistProjects(projects: Project[]): Promise<void> {
  await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getAllProjects(): Promise<Project[]> {
  return sortProjects(await loadProjectsRaw());
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const projects = await loadProjectsRaw();
  return projects.find((p) => p.id === projectId) ?? null;
}

export async function createProject(input: {
  name: string;
  type: ProjectType;
}): Promise<Project> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Project name cannot be empty');
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: generateId(),
    name: trimmedName,
    type: input.type,
    createdAt: now,
    updatedAt: now,
  };

  const projects = await loadProjectsRaw();
  projects.push(project);
  await persistProjects(projects);
  return project;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project> {
  const projects = await loadProjectsRaw();
  const index = projects.findIndex((p) => p.id === projectId);
  if (index < 0) {
    throw new Error('Project not found');
  }

  const updated: Project = {
    ...projects[index],
    ...updates,
    id: projects[index].id,
    createdAt: projects[index].createdAt,
    updatedAt: new Date().toISOString(),
  };

  projects[index] = updated;
  await persistProjects(projects);
  return updated;
}

export async function deleteProject(projectId: string): Promise<void> {
  await deletePhotosForProject(projectId);
  await deleteProjectDirectory(projectId);

  const projects = await loadProjectsRaw();
  await persistProjects(projects.filter((p) => p.id !== projectId));
}

export async function persistProjectsDirect(projects: Project[]): Promise<void> {
  await persistProjects(projects);
}
