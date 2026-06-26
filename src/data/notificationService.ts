import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { PROJECT_REMINDERS_CHANNEL_ID } from '@/constants/notifications';
import { readProjectsRaw } from '@/data/rawMetadataStorage';
import type {
  Project,
  ProjectReminderSettings,
  Weekday,
} from '@/types/project';
import {
  formatIntervalLabel,
  getIntervalFromSettings,
  usesRollingDayInterval,
} from '@/utils/reminderInterval';

const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Sunday',
  2: 'Monday',
  3: 'Tuesday',
  4: 'Wednesday',
  5: 'Thursday',
  6: 'Friday',
  7: 'Saturday',
};

const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  every_2_days: 'Every 2 days',
  every_3_days: 'Every 3 days',
  custom_days: 'Custom interval',
} as const;

let androidChannelReady = false;

export function resolveReminderSettings(
  settings?: ProjectReminderSettings
): ProjectReminderSettings {
  const resolved: ProjectReminderSettings = {
    enabled: settings?.enabled ?? false,
    frequency: settings?.frequency ?? 'daily',
    timeHour: settings?.timeHour ?? 20,
    timeMinute: settings?.timeMinute ?? 0,
    weekdays: settings?.weekdays,
    notificationIds: settings?.notificationIds ?? [],
    lastScheduledAt: settings?.lastScheduledAt,
    intervalValue: settings?.intervalValue,
    intervalUnit: settings?.intervalUnit,
  };

  const interval = getIntervalFromSettings(resolved);
  return {
    ...resolved,
    intervalValue: interval.value,
    intervalUnit: interval.unit,
  };
}

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) {
    return;
  }

  await Notifications.setNotificationChannelAsync(PROJECT_REMINDERS_CHANNEL_ID, {
    name: 'Project reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: undefined,
  });

  androidChannelReady = true;
}

export async function getNotificationPermissionStatus(): Promise<{
  granted: boolean;
  canAskAgain?: boolean;
}> {
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted, canAskAgain };
}

export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  if (current.canAskAgain === false) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function buildReminderBody(project: Project): string {
  switch (project.type) {
    case 'selfie':
      return `Time to take your ${project.name} photo.`;
    case 'side_profile':
      return `Time to capture your ${project.name}.`;
    case 'plant_growth':
      return `Time to update your ${project.name}.`;
    case 'other':
    default:
      return 'Time to update your progress project.';
  }
}

export function buildProjectReminderContent(
  project: Project
): Notifications.NotificationContentInput {
  return {
    title: 'Progression',
    body: buildReminderBody(project),
    data: {
      type: 'project_reminder',
      projectId: project.id,
      route: `/projects/${project.id}/capture`,
    },
  };
}

function getWeeklyWeekday(settings: ProjectReminderSettings): Weekday {
  return settings.weekdays?.[0] ?? 2;
}

export function computeNextIntervalFireDate(
  settings: ProjectReminderSettings,
  from: Date = new Date()
): Date {
  const { value: intervalDays } = getIntervalFromSettings(settings);
  const result = new Date(from);
  result.setSeconds(0, 0);
  result.setMilliseconds(0);
  result.setHours(settings.timeHour, settings.timeMinute, 0, 0);

  if (settings.lastScheduledAt) {
    const last = new Date(settings.lastScheduledAt);
    const minNext = new Date(last);
    minNext.setDate(minNext.getDate() + intervalDays);
    minNext.setHours(settings.timeHour, settings.timeMinute, 0, 0);

    if (minNext > from) {
      return minNext;
    }
  }

  while (result <= from) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

export function buildReminderTriggers(
  settings: ProjectReminderSettings
): Notifications.NotificationTriggerInput[] {
  const resolved = resolveReminderSettings(settings);
  const channelId = PROJECT_REMINDERS_CHANNEL_ID;
  const { value, unit } = getIntervalFromSettings(resolved);

  if (unit === 'hours') {
    const seconds = value * 60 * 60;
    if (seconds < 60) {
      return [];
    }

    return [
      {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
        channelId,
      },
    ];
  }

  if (value === 1) {
    return [
      {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: resolved.timeHour,
        minute: resolved.timeMinute,
        channelId,
      },
    ];
  }

  if (value === 7) {
    return [
      {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: getWeeklyWeekday(resolved),
        hour: resolved.timeHour,
        minute: resolved.timeMinute,
        channelId,
      },
    ];
  }

  const fireDate = computeNextIntervalFireDate(resolved);
  return [
    {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      channelId,
    },
  ];
}

export function formatReminderTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minutePadded = minute.toString().padStart(2, '0');
  return `${hour12}:${minutePadded} ${period}`;
}

export function getNextReminderDescription(settings: ProjectReminderSettings): string {
  const resolved = resolveReminderSettings(settings);
  const { value, unit } = getIntervalFromSettings(resolved);

  if (unit === 'hours') {
    return formatIntervalLabel(value, unit);
  }

  const timeLabel = formatReminderTime(resolved.timeHour, resolved.timeMinute);

  if (value === 7) {
    const weekday = WEEKDAY_NAMES[getWeeklyWeekday(resolved)];
    return `${FREQUENCY_LABELS.weekly} on ${weekday} at ${timeLabel}`;
  }

  if (value === 1) {
    return `${FREQUENCY_LABELS.daily} at ${timeLabel}`;
  }

  const nextDate = computeNextIntervalFireDate(resolved);
  const dateLabel = nextDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return `${formatIntervalLabel(value, unit)} at ${timeLabel} (next: ${dateLabel})`;
}

async function cancelNotificationIds(notificationIds: string[]): Promise<void> {
  await Promise.all(
    notificationIds.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Ignore stale or missing notification IDs.
      }
    })
  );
}

export async function scheduleProjectReminder(project: Project): Promise<string[]> {
  await ensureAndroidChannel();

  const settings = resolveReminderSettings(project.reminderSettings);
  const content = buildProjectReminderContent(project);
  const triggers = buildReminderTriggers(settings);
  const notificationIds: string[] = [];

  for (const trigger of triggers) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });
    notificationIds.push(id);
  }

  return notificationIds;
}

export async function cancelProjectReminders(project: Project): Promise<void> {
  const settings = resolveReminderSettings(project.reminderSettings);
  await cancelNotificationIds(settings.notificationIds);
}

export async function rescheduleProjectReminder(
  project: Project,
  reminderSettings: ProjectReminderSettings
): Promise<ProjectReminderSettings> {
  await cancelProjectReminders(project);

  if (!reminderSettings.enabled) {
    return {
      ...reminderSettings,
      notificationIds: [],
    };
  }

  const projectWithSettings: Project = {
    ...project,
    reminderSettings,
  };

  const notificationIds = await scheduleProjectReminder(projectWithSettings);

  return {
    ...reminderSettings,
    notificationIds,
    lastScheduledAt: new Date().toISOString(),
  };
}

export async function cancelAllProgressionNotifications(): Promise<void> {
  const projects = await readProjectsRaw();
  const knownIds = new Set<string>();

  for (const project of projects) {
    for (const id of resolveReminderSettings(project.reminderSettings).notificationIds) {
      knownIds.add(id);
    }
  }

  await cancelNotificationIds([...knownIds]);

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      const data = notification.content.data;
      if (data?.type === 'project_reminder') {
        try {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        } catch {
          // Ignore cancellation failures.
        }
      }
    }
  } catch {
    // Ignore listing failures.
  }
}

export async function refreshRollingReminders(): Promise<void> {
  await ensureAndroidChannel();

  const projects = await readProjectsRaw();
  let scheduledIds: Set<string>;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    scheduledIds = new Set(scheduled.map((notification) => notification.identifier));
  } catch {
    return;
  }

  for (const project of projects) {
    const settings = resolveReminderSettings(project.reminderSettings);
    if (!settings.enabled || !usesRollingDayInterval(settings)) {
      continue;
    }

    const hasValidSchedule =
      settings.notificationIds.length > 0 &&
      settings.notificationIds.every((id) => scheduledIds.has(id));

    if (hasValidSchedule) {
      continue;
    }

    try {
      const updatedSettings = await rescheduleProjectReminder(project, settings);
      const { updateProject } = await import('@/data/projectStorage');
      await updateProject(project.id, { reminderSettings: updatedSettings });
    } catch {
      // Best effort only on startup.
    }
  }
}

export async function scheduleTestNotificationInSeconds(seconds: number): Promise<string> {
  await ensureAndroidChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Progression',
      body: 'Test reminder notification.',
      data: { type: 'project_reminder', projectId: 'test', route: '/' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: PROJECT_REMINDERS_CHANNEL_ID,
    },
  });
}

export async function getScheduledNotificationCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}
