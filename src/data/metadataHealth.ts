import { readPhotosRawResult, readProjectsRawResult } from '@/data/rawMetadataStorage';

export type MetadataHealth = {
  projectsCorrupted: boolean;
  photosCorrupted: boolean;
  hasAnyMetadata: boolean;
};

export async function getMetadataHealth(): Promise<MetadataHealth> {
  const [projectsResult, photosResult] = await Promise.all([
    readProjectsRawResult(),
    readPhotosRawResult(),
  ]);

  return {
    projectsCorrupted: projectsResult.corrupted,
    photosCorrupted: photosResult.corrupted,
    hasAnyMetadata: projectsResult.data.length > 0 || photosResult.data.length > 0,
  };
}
