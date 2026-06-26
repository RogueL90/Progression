import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsLinkRow } from '@/components/SettingsLinkRow';
import { theme } from '@/constants/theme';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function SettingsScreen() {
  const { settings, loading, updateSettings } = useAppSettings();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Save Photos to Camera Roll</Text>
                  <Text style={styles.rowHint}>
                    Also save captured photos to your device photo library
                  </Text>
                </View>
                <Switch
                  value={settings.savePhotosToCameraRoll}
                  onValueChange={(savePhotosToCameraRoll) => {
                    void updateSettings({ savePhotosToCameraRoll });
                  }}
                  trackColor={{ false: theme.cardBorder, true: theme.accentMuted }}
                  thumbColor={
                    settings.savePhotosToCameraRoll ? theme.accent : theme.textMuted
                  }
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Save Photos to Dropbox</Text>
                  <Text style={styles.rowHint}>
                    Upload captured photos to your Dropbox account
                  </Text>
                </View>
                <Switch
                  value={settings.savePhotosToDropbox}
                  onValueChange={(savePhotosToDropbox) => {
                    void updateSettings({ savePhotosToDropbox });
                  }}
                  trackColor={{ false: theme.cardBorder, true: theme.accentMuted }}
                  thumbColor={settings.savePhotosToDropbox ? theme.accent : theme.textMuted}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <SettingsLinkRow label="Our Instagram" />
              <View style={styles.divider} />
              <SettingsLinkRow label="Privacy Policy" />
              <View style={styles.divider} />
              <SettingsLinkRow label="Terms of Service" />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  rowText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  rowLabel: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
  },
  rowHint: {
    color: theme.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: theme.cardBorder,
    marginLeft: theme.spacing.lg,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
});
