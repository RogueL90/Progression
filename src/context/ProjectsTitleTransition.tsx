import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LayoutRectangle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

export type ProjectsTitleMode = 'large' | 'small';

export type ProjectsTitlePhase = 'idle' | 'pushing' | 'onDetail' | 'popping';

export type TitleLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ProjectsTitleTransitionContextValue = {
  phase: ProjectsTitlePhase;
  mode: ProjectsTitleMode;
  sourceLayout: TitleLayout | null;
  /** True while overlay owns the glyph (list titles should hide). */
  titlesHidden: boolean;
  /** True when the custom Projects back control should be visible/interactive. */
  overlayActive: boolean;
  /** Project dashboard route (not timeline/capture/etc.). */
  onProjectDashboard: boolean;
  registerLargeLayout: (layout: TitleLayout) => void;
  registerSmallLayout: (layout: TitleLayout) => void;
  setTitleMode: (mode: ProjectsTitleMode) => void;
  openProject: (projectId: string) => void;
  goBackToProjects: () => void;
  /** Clear overlay if the list regained focus without our pop animation (e.g. gesture back). */
  resetToIdle: () => void;
  /** Called by overlay when push morph finishes. */
  notifyPushComplete: () => void;
  /** Called by overlay when pop morph finishes. */
  notifyPopComplete: () => void;
};

const ProjectsTitleTransitionContext =
  createContext<ProjectsTitleTransitionContextValue | null>(null);

function layoutFromRect(rect: LayoutRectangle): TitleLayout {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/** `/projects/:id` only — excludes capture, timeline, progress, photo, new. */
export function isProjectDashboardPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length === 2 && parts[0] === 'projects';
}

export function ProjectsTitleTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<ProjectsTitlePhase>('idle');
  const [mode, setMode] = useState<ProjectsTitleMode>('large');
  const [sourceLayout, setSourceLayout] = useState<TitleLayout | null>(null);

  const largeLayoutRef = useRef<TitleLayout | null>(null);
  const smallLayoutRef = useRef<TitleLayout | null>(null);
  const modeRef = useRef<ProjectsTitleMode>('large');
  const pendingProjectIdRef = useRef<string | null>(null);
  const phaseRef = useRef<ProjectsTitlePhase>('idle');

  const onProjectDashboard = isProjectDashboardPath(pathname);

  const setTitleMode = useCallback((next: ProjectsTitleMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const registerLargeLayout = useCallback((layout: TitleLayout) => {
    largeLayoutRef.current = layout;
  }, []);

  const registerSmallLayout = useCallback((layout: TitleLayout) => {
    smallLayoutRef.current = layout;
  }, []);

  const openProject = useCallback(
    (projectId: string) => {
      if (phaseRef.current !== 'idle') {
        return;
      }

      const currentMode = modeRef.current;
      const layout =
        currentMode === 'small'
          ? smallLayoutRef.current ?? largeLayoutRef.current
          : largeLayoutRef.current ?? smallLayoutRef.current;

      pendingProjectIdRef.current = projectId;
      phaseRef.current = 'pushing';
      setMode(currentMode);
      setSourceLayout(layout);
      setPhase('pushing');
      router.push(`/projects/${projectId}`);
    },
    [router]
  );

  const goBackToProjects = useCallback(() => {
    if (phaseRef.current === 'idle') {
      if (router.canGoBack()) {
        router.back();
      }
      return;
    }

    if (phaseRef.current === 'popping') {
      return;
    }

    // Nested screens (timeline, capture, …): normal stack back only.
    // The morphing Projects control is dashboard-only.
    if (!isProjectDashboardPath(pathname)) {
      if (router.canGoBack()) {
        router.back();
      }
      return;
    }

    // Start stack pop immediately so the title glides with the screen transition
    // instead of flying across the detail page first.
    phaseRef.current = 'popping';
    setPhase('popping');
    if (router.canGoBack()) {
      router.back();
    }
  }, [pathname, router]);

  const notifyPushComplete = useCallback(() => {
    if (phaseRef.current !== 'pushing') {
      return;
    }
    phaseRef.current = 'onDetail';
    setPhase('onDetail');
  }, []);

  const notifyPopComplete = useCallback(() => {
    if (phaseRef.current !== 'popping') {
      return;
    }
    // Keep frozen layout until after idle so a late overlay frame can't remount with bad source.
    phaseRef.current = 'idle';
    pendingProjectIdRef.current = null;
    setPhase('idle');
    // Clear source on next tick so this commit can reveal list titles cleanly.
    requestAnimationFrame(() => {
      setSourceLayout(null);
    });
  }, []);

  const resetToIdle = useCallback(() => {
    // Gesture/system back while on detail — drop overlay without a second pop.
    if (phaseRef.current === 'onDetail') {
      phaseRef.current = 'idle';
      pendingProjectIdRef.current = null;
      setSourceLayout(null);
      setPhase('idle');
      return;
    }
    // List focused after our coordinated pop finished (or mid-pop already handled).
  }, []);

  const titlesHidden = phase !== 'idle';
  const overlayActive =
    phase === 'pushing' ||
    phase === 'popping' ||
    (phase === 'onDetail' && onProjectDashboard);

  const value = useMemo(
    () => ({
      phase,
      mode,
      sourceLayout,
      titlesHidden,
      overlayActive,
      onProjectDashboard,
      registerLargeLayout,
      registerSmallLayout,
      setTitleMode,
      openProject,
      goBackToProjects,
      resetToIdle,
      notifyPushComplete,
      notifyPopComplete,
    }),
    [
      phase,
      mode,
      sourceLayout,
      titlesHidden,
      overlayActive,
      onProjectDashboard,
      registerLargeLayout,
      registerSmallLayout,
      setTitleMode,
      openProject,
      goBackToProjects,
      resetToIdle,
      notifyPushComplete,
      notifyPopComplete,
    ]
  );

  return (
    <ProjectsTitleTransitionContext.Provider value={value}>
      {children}
    </ProjectsTitleTransitionContext.Provider>
  );
}

export function useProjectsTitleTransition() {
  const ctx = useContext(ProjectsTitleTransitionContext);
  if (!ctx) {
    throw new Error(
      'useProjectsTitleTransition must be used within ProjectsTitleTransitionProvider'
    );
  }
  return ctx;
}

/** Optional hook for screens that may render outside the provider during tests. */
export function useProjectsTitleTransitionOptional() {
  return useContext(ProjectsTitleTransitionContext);
}

export { layoutFromRect };
