import type {
  ProjectReminderSettings,
  ReminderFrequency,
  ReminderIntervalUnit,
} from '@/types/project';

export const MAX_INTERVAL_HOURS = 24;
export const MAX_INTERVAL_DAYS = 30;

export function getIntervalFromSettings(settings: ProjectReminderSettings): {
  value: number;
  unit: ReminderIntervalUnit;
} {
  if (settings.intervalValue != null && settings.intervalUnit) {
    return {
      value: clampIntervalValue(settings.intervalValue, settings.intervalUnit),
      unit: settings.intervalUnit,
    };
  }

  switch (settings.frequency) {
    case 'every_2_days':
      return { value: 2, unit: 'days' };
    case 'every_3_days':
      return { value: 3, unit: 'days' };
    case 'weekly':
      return { value: 7, unit: 'days' };
    case 'daily':
    default:
      return { value: 1, unit: 'days' };
  }
}

export function clampIntervalValue(
  value: number,
  unit: ReminderIntervalUnit
): number {
  const max = unit === 'hours' ? MAX_INTERVAL_HOURS : MAX_INTERVAL_DAYS;
  return Math.min(max, Math.max(1, Math.round(value)));
}

export function deriveFrequency(
  value: number,
  unit: ReminderIntervalUnit
): ReminderFrequency {
  if (unit === 'hours') {
    return 'custom_days';
  }

  if (value === 1) {
    return 'daily';
  }

  if (value === 7) {
    return 'weekly';
  }

  if (value === 2) {
    return 'every_2_days';
  }

  if (value === 3) {
    return 'every_3_days';
  }

  return 'custom_days';
}

export function applyIntervalToSettings(
  settings: ProjectReminderSettings,
  value: number,
  unit: ReminderIntervalUnit
): ProjectReminderSettings {
  const clampedValue = clampIntervalValue(value, unit);
  const frequency = deriveFrequency(clampedValue, unit);

  return {
    ...settings,
    intervalValue: clampedValue,
    intervalUnit: unit,
    frequency,
    weekdays:
      clampedValue === 7 && unit === 'days'
        ? settings.weekdays?.length
          ? settings.weekdays
          : [2]
        : settings.weekdays,
  };
}

export function formatIntervalLabel(value: number, unit: ReminderIntervalUnit): string {
  const unitLabel = value === 1 ? unit.slice(0, -1) : unit;
  return `Every ${value} ${unitLabel}`;
}

export function to24HourTime(hour12: number, minute: number, period: 'AM' | 'PM'): {
  hour: number;
  minute: number;
} {
  let hour = hour12 % 12;
  if (period === 'PM') {
    hour += 12;
  }
  return { hour, minute };
}

export function from24HourTime(hour24: number, minute: number): {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
} {
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

export function buildNumberItems(max: number): { value: number; label: string }[] {
  return Array.from({ length: max }, (_, index) => {
    const value = index + 1;
    return { value, label: String(value) };
  });
}

export const INTERVAL_UNIT_ITEMS: { value: ReminderIntervalUnit; label: string }[] = [
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
];

export const HOUR_ITEMS = Array.from({ length: 12 }, (_, index) => {
  const value = index + 1;
  return { value, label: String(value) };
});

export const MINUTE_ITEMS = Array.from({ length: 60 }, (_, index) => {
  const label = index.toString().padStart(2, '0');
  return { value: index, label };
});

export const PERIOD_ITEMS: { value: 'AM' | 'PM'; label: string }[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

export function usesRollingDayInterval(settings: ProjectReminderSettings): boolean {
  const { value, unit } = getIntervalFromSettings(settings);
  return unit === 'days' && value !== 1 && value !== 7;
}

export function usesHourInterval(settings: ProjectReminderSettings): boolean {
  const { unit } = getIntervalFromSettings(settings);
  return unit === 'hours';
}
