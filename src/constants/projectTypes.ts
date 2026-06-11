import type { ProjectType } from '@/types/project';

export type ProjectTypeInfo = {
  type: ProjectType;
  label: string;
  description: string;
};

export const PROJECT_TYPES: ProjectTypeInfo[] = [
  {
    type: 'selfie',
    label: 'Selfie',
    description: 'Track front-facing face progress over time.',
  },
  {
    type: 'side_profile',
    label: 'Side Profile',
    description: 'Track side-profile changes over time.',
  },
  {
    type: 'plant_growth',
    label: 'Plant Growth',
    description: 'Track a plant as it grows or changes.',
  },
  {
    type: 'other',
    label: 'Other',
    description: 'Track any visual progress project.',
  },
];

export function getProjectTypeLabel(type: ProjectType): string {
  return PROJECT_TYPES.find((t) => t.type === type)?.label ?? type;
}

export function getProjectTypeDescription(type: ProjectType): string {
  return PROJECT_TYPES.find((t) => t.type === type)?.description ?? '';
}
