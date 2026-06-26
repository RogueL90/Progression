export type ProjectType = 'selfie' | 'side_profile' | 'plant_growth' | 'other';

export type ReminderFrequency =
  | 'daily'
  | 'weekly'
  | 'every_2_days'
  | 'every_3_days'
  | 'custom_days';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReminderIntervalUnit = 'hours' | 'days';

export type ProjectReminderSettings = {
  enabled: boolean;
  frequency: ReminderFrequency;
  intervalValue?: number;
  intervalUnit?: ReminderIntervalUnit;
  timeHour: number;
  timeMinute: number;
  weekdays?: Weekday[];
  notificationIds: string[];
  lastScheduledAt?: string;
};

export type Project = {
  id: string;
  name: string;
  type: ProjectType;
  createdAt: string;
  updatedAt: string;
  coverPhotoUri?: string;
  lastBackedUpAt?: string;
  reminderSettings?: ProjectReminderSettings;
};
