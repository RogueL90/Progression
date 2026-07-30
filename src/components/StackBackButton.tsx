import { Ionicons } from '@expo/vector-icons';
import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
} from 'expo-router';
import { useMemo, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/constants/theme';
import {
  getRememberedProjectName,
  subscribeProjectNames,
} from '@/data/projectNameCache';
import { useProject } from '@/hooks/useProject';

/** Plain app-styled back control — avoids iOS liquid-glass header buttons. */
export function StackBackButton({ label = 'Back' }: { label?: string }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        }
      }}
      hitSlop={10}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`Go back to ${label}`}
    >
      <Ionicons name="chevron-back" size={22} color={theme.text} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function projectIdFromPathname(pathname: string): string | undefined {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === 'new') {
    return undefined;
  }
  return id;
}

/** Back control labeled with the current project's name. */
export function ProjectStackBackButton({ label: labelProp }: { label?: string }) {
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams<{ projectId?: string | string[] }>();
  const projectId = useMemo(() => {
    const fromParams = globalParams.projectId;
    if (typeof fromParams === 'string' && fromParams.length > 0) {
      return fromParams;
    }
    if (Array.isArray(fromParams) && fromParams[0]) {
      return fromParams[0];
    }
    return projectIdFromPathname(pathname);
  }, [globalParams.projectId, pathname]);

  const cachedName = useSyncExternalStore(
    subscribeProjectNames,
    () => (projectId ? getRememberedProjectName(projectId) : undefined),
    () => undefined
  );

  const { project } = useProject(projectId);
  const label =
    labelProp?.trim() ||
    project?.name?.trim() ||
    cachedName?.trim() ||
    'Back';

  return <StackBackButton label={label} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: 160,
    marginLeft: -6,
  },
  label: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
});
