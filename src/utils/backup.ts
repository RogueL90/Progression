import { getAllProjects } from '@/data/projectStorage';
import type { ProjectType } from '@/types/project';
import { getTodayDateString } from '@/utils/date';

const PROJECT_TYPES: ProjectType[] = ['selfie', 'side_profile', 'plant_growth', 'other'];

export function safeFileName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project';
}

export function getBackupFileName(projectName: string, date?: string): string {
  const safeName = safeFileName(projectName);
  const exportDate = date ?? getTodayDateString();
  return `progression-${safeName}-${exportDate}.zip`;
}

export function isValidProjectType(type: string): type is ProjectType {
  return PROJECT_TYPES.includes(type as ProjectType);
}

export function isValidDateString(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export async function getUniqueImportedProjectName(baseName: string): Promise<string> {
  const trimmed = baseName.trim();
  const projects = await getAllProjects();
  const existingNames = new Set(projects.map((p) => p.name));

  if (!existingNames.has(trimmed)) {
    return trimmed;
  }

  const importedName = `${trimmed} (Imported)`;
  if (!existingNames.has(importedName)) {
    return importedName;
  }

  let counter = 2;
  while (existingNames.has(`${trimmed} (Imported ${counter})`)) {
    counter += 1;
  }

  return `${trimmed} (Imported ${counter})`;
}

export function resolvePhotoFileName(date: string, usedNames: Set<string>): string {
  let fileName = `${date}.jpg`;
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }

  let counter = 2;
  while (usedNames.has(`${date}-${counter}.jpg`)) {
    counter += 1;
  }
  fileName = `${date}-${counter}.jpg`;
  usedNames.add(fileName);
  return fileName;
}
