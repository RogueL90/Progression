import { Ionicons } from '@expo/vector-icons';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useProjectsTitleTransition } from '@/context/ProjectsTitleTransition';
import { projectDashboardTitleOpacity } from '@/data/projectDashboardHeader';

const TOOLBAR_HEIGHT = 44;

/**
 * Custom project dashboard header — no system back / liquid glass.
 * Center title fades in as the large in-page name scrolls away (home-page style).
 */
export function ProjectNavHeader({ options }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phase, overlayActive, goBackToProjects } =
    useProjectsTitleTransition();

  const title =
    typeof options.headerTitle === 'string'
      ? options.headerTitle
      : typeof options.title === 'string'
        ? options.title
        : '';

  // Overlay owns back while active; otherwise show a plain custom control.
  const showFallbackBack = !overlayActive && phase !== 'popping';

  const titleStyle = useAnimatedStyle(() => ({
    opacity: projectDashboardTitleOpacity.value,
  }));

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {showFallbackBack ? (
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                goBackToProjects();
              }
            }}
            hitSlop={10}
            style={styles.fallbackBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Projects"
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
            <Text style={styles.fallbackLabel}>Projects</Text>
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Animated.Text
          style={[styles.title, titleStyle]}
          numberOfLines={1}
          pointerEvents="none"
        >
          {title}
        </Animated.Text>
        <View style={styles.side} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.background,
  },
  bar: {
    height: TOOLBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  side: {
    width: 96,
  },
  fallbackBack: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  fallbackLabel: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: theme.text,
    fontSize: 17,
    fontWeight: '600',
  },
});
