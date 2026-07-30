import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ProjectNavHeader } from '@/components/ProjectNavHeader';
import { ProjectsTitleOverlay } from '@/components/ProjectsTitleOverlay';
import { ProjectStackBackButton } from '@/components/StackBackButton';
import { theme } from '@/constants/theme';
import { NOTIFICATIONS_ENABLED } from '@/constants/featureFlags';
import {
  configureNotificationHandler,
  refreshRollingReminders,
} from '@/data/notificationService';
import { runMigrations } from '@/data/migrations';
import { useNotificationRouting } from '@/hooks/useNotificationRouting';
import { ProjectsTitleTransitionProvider } from '@/context/ProjectsTitleTransition';

function nestedBackOptions(title: string) {
  if (Platform.OS === 'ios') {
    return {
      title,
      headerBackVisible: false as const,
      unstable_headerLeftItems: () => [
        {
          type: 'custom' as const,
          element: <ProjectStackBackButton />,
          hidesSharedBackground: true,
        },
      ],
    };
  }

  return {
    title,
    headerBackVisible: false as const,
    headerLeft: (props: { label?: string }) => (
      <ProjectStackBackButton label={props.label} />
    ),
  };
}

function AppShell() {
  useNotificationRouting();
  return (
    <ProjectsTitleTransitionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, title: 'Projects' }}
        />
        <Stack.Screen name="projects/new" options={{ title: 'New Project' }} />
        <Stack.Screen
          name="projects/[projectId]/index"
          options={{
            title: 'Project',
            headerBackVisible: false,
            header: (props) => <ProjectNavHeader {...props} />,
          }}
        />
        <Stack.Screen
          name="projects/[projectId]/capture"
          options={nestedBackOptions('Take Photo')}
        />
        <Stack.Screen
          name="projects/[projectId]/timeline"
          options={nestedBackOptions('Timeline')}
        />
        <Stack.Screen
          name="projects/[projectId]/progress"
          options={nestedBackOptions('Progress')}
        />
        <Stack.Screen
          name="projects/[projectId]/photo/[photoId]"
          options={nestedBackOptions('Photo')}
        />
      </Stack>
      <ProjectsTitleOverlay />
    </ProjectsTitleTransitionProvider>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (NOTIFICATIONS_ENABLED) {
      configureNotificationHandler();
    }

    runMigrations()
      .catch(() => {
        // Migration failure should not block the app
      })
      .then(() => {
        if (NOTIFICATIONS_ENABLED) {
          return refreshRollingReminders();
        }
      })
      .catch(() => {
        // Rolling reminder refresh should not block the app
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View
            style={{
              flex: 1,
              backgroundColor: theme.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
