export type ProjectType = 'selfie' | 'side_profile' | 'plant_growth' | 'other';

export type Project = {
  id: string;
  name: string;
  type: ProjectType;
  createdAt: string;
  updatedAt: string;
  coverPhotoUri?: string;
};
