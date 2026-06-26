import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { ReminderTimePicker } from '@/components/ReminderTimePicker';
import { WheelPicker } from '@/components/WheelPicker';
import { theme } from '@/constants/theme';
import {
  cancelAllProgressionNotifications,
  getNextReminderDescription,
  getScheduledNotificationCount,
  resolveReminderSettings,
  scheduleTestNotificationInSeconds,
} from '@/data/notificationService';
import {
  getDefaultReminderSettings,
  updateProjectReminderSettings,
} from '@/data/projectStorage';
import type { Project, ProjectReminderSettings } from '@/types/project';
import {
  INTERVAL_UNIT_ITEMS,
  MAX_INTERVAL_DAYS,
  MAX_INTERVAL_HOURS,
  applyIntervalToSettings,
  buildNumberItems,
  clampIntervalValue,
  getIntervalFromSettings,
} from '@/utils/reminderInterval';

type ProjectReminderSectionProps = {
  project: Project;
  onProjectUpdated: (project: Project) => void;
  onPickerActiveChange?: (active: boolean) => void;
};

const PERMISSION_DENIED_MESSAGE =
  'Notifications are turned off. Enable notifications in system settings to receive project reminders.';

export function ProjectReminderSection({
  project,
  onProjectUpdated,
  onPickerActiveChange,
}: ProjectReminderSectionProps) {
  const [saving, setSaving] = useState(false);
  const settings = resolveReminderSettings(project.reminderSettings);
  const interval = getIntervalFromSettings(settings);

  const [intervalValue, setIntervalValue] = useState(interval.value);
  const [intervalUnit, setIntervalUnit] = useState(interval.unit);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<ProjectReminderSettings>(settings);
  const pickerActiveCountRef = useRef(0);

  const numberItems = useMemo(
    () => buildNumberItems(intervalUnit === 'hours' ? MAX_INTERVAL_HOURS : MAX_INTERVAL_DAYS),
    [intervalUnit]
  );

  useEffect(() => {
    const resolved = resolveReminderSettings(project.reminderSettings);
    const nextInterval = getIntervalFromSettings(resolved);
    setIntervalValue(nextInterval.value);
    setIntervalUnit(nextInterval.unit);
    latestDraftRef.current = resolved;
  }, [project.id, project.updatedAt, project.reminderSettings]);

  const handlePickerInteraction = useCallback(
    (active: boolean) => {
      if (active) {
        pickerActiveCountRef.current += 1;
        onPickerActiveChange?.(true);
        return;
      }

      pickerActiveCountRef.current = Math.max(0, pickerActiveCountRef.current - 1);
      if (pickerActiveCountRef.current === 0) {
        onPickerActiveChange?.(false);
      }
    },
    [onPickerActiveChange]
  );

  const persistSettings = useCallback(
    async (draft: ProjectReminderSettings) => {
      try {
        setSaving(true);
        const updatedProject = await updateProjectReminderSettings(project.id, draft);
        onProjectUpdated(updatedProject);

        const resolved = resolveReminderSettings(updatedProject.reminderSettings);
        if (draft.enabled && !resolved.enabled) {
          Alert.alert('Notifications unavailable', PERMISSION_DENIED_MESSAGE);
        }
      } catch {
        Alert.alert('Could not update reminders', 'Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [onProjectUpdated, project.id]
  );

  const queuePersist = useCallback(
    (draft: ProjectReminderSettings) => {
      latestDraftRef.current = draft;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        void persistSettings(latestDraftRef.current);
      }, 350);
    },
    [persistSettings]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      pickerActiveCountRef.current = 0;
      onPickerActiveChange?.(false);
    };
  }, [onPickerActiveChange]);

  const buildDraft = useCallback(
    (overrides: Partial<ProjectReminderSettings> = {}): ProjectReminderSettings => {
      const base = resolveReminderSettings({
        ...settings,
        ...latestDraftRef.current,
        ...overrides,
      });

      return resolveReminderSettings(base);
    },
    [settings]
  );

  const handleToggle = (enabled: boolean) => {
    const draft = buildDraft({
      enabled,
      notificationIds: enabled ? settings.notificationIds : [],
    });
    void persistSettings(draft);
  };

  const handleIntervalValueChange = (value: number) => {
    setIntervalValue(value);
    const draft = applyIntervalToSettings(buildDraft(), value, intervalUnit);
    latestDraftRef.current = draft;
    queuePersist(draft);
  };

  const handleIntervalUnitChange = (unit: 'hours' | 'days') => {
    const nextValue = clampIntervalValue(intervalValue, unit);
    setIntervalUnit(unit);
    setIntervalValue(nextValue);
    const draft = applyIntervalToSettings(buildDraft(), nextValue, unit);
    latestDraftRef.current = draft;
    queuePersist(draft);
  };

  const handleTimeChange = (hour: number, minute: number) => {
    const draft = buildDraft({ timeHour: hour, timeMinute: minute });
    latestDraftRef.current = draft;
    queuePersist(draft);
  };

  const showTimePicker = intervalUnit === 'days';

  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Text style={styles.title}>Reminders</Text>
        <Switch
          value={settings.enabled}
          onValueChange={handleToggle}
          disabled={saving}
          trackColor={{ false: theme.cardBorder, true: theme.accentMuted }}
          thumbColor={settings.enabled ? theme.accent : theme.textMuted}
        />
      </View>

      {settings.enabled && (
        <>
          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.wheelGroup}>
            <WheelPicker
              items={numberItems}
              value={intervalValue}
              onValueChange={handleIntervalValueChange}
              onValueSettled={handleIntervalValueChange}
              disabled={saving}
              width={72}
              onInteractionChange={handlePickerInteraction}
            />
            <WheelPicker
              items={INTERVAL_UNIT_ITEMS}
              value={intervalUnit}
              onValueChange={handleIntervalUnitChange}
              onValueSettled={handleIntervalUnitChange}
              disabled={saving}
              width={128}
              onInteractionChange={handlePickerInteraction}
            />
          </View>
          <Text style={styles.wheelCaption}>
            Every {intervalValue} {intervalValue === 1 ? intervalUnit.slice(0, -1) : intervalUnit}
          </Text>

          {showTimePicker && (
            <>
              <Text style={styles.fieldLabel}>Time</Text>
              <ReminderTimePicker
                hour={settings.timeHour}
                minute={settings.timeMinute}
                disabled={saving}
                onTimeChange={handleTimeChange}
                onInteractionChange={handlePickerInteraction}
              />
            </>
          )}

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Reminders are on</Text>
            <Text style={styles.statusValue}>
              Next reminder: {getNextReminderDescription(settings)}
            </Text>
          </View>
        </>
      )}

      {__DEV__ && settings.enabled && (
        <View style={styles.debugSection}>
          <Text style={styles.fieldLabel}>Debug</Text>
          <PrimaryButton
            title="Schedule test notification in 10s"
            variant="secondary"
            onPress={() => {
              void scheduleTestNotificationInSeconds(10);
            }}
          />
          <PrimaryButton
            title="Cancel all Progression notifications"
            variant="secondary"
            onPress={() => {
              void cancelAllProgressionNotifications();
            }}
          />
          <PrimaryButton
            title="List scheduled notifications"
            variant="secondary"
            onPress={() => {
              void getScheduledNotificationCount().then((count) => {
                Alert.alert('Scheduled notifications', `${count} notification(s) scheduled.`);
              });
            }}
          />
          <PrimaryButton
            title="Reset reminder settings"
            variant="secondary"
            onPress={() => {
              void persistSettings(getDefaultReminderSettings());
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  fieldLabel: {
    color: theme.textMuted,
    fontSize: 13,
    marginTop: theme.spacing.sm,
  },
  wheelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  wheelCaption: {
    color: theme.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  statusCard: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: theme.spacing.xs,
  },
  statusLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  statusValue: {
    color: theme.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  debugSection: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
});
