const projectNames = new Map<string, string>();
const listeners = new Set<() => void>();

export function rememberProjectName(projectId: string, name: string) {
  const trimmed = name.trim();
  if (!projectId || !trimmed) {
    return;
  }
  if (projectNames.get(projectId) === trimmed) {
    return;
  }
  projectNames.set(projectId, trimmed);
  listeners.forEach((listener) => listener());
}

export function getRememberedProjectName(projectId: string): string | undefined {
  return projectNames.get(projectId);
}

export function subscribeProjectNames(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
