import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { theme } from '@/constants/theme';
import {
  from24HourTime,
  HOUR_ITEMS,
  MINUTE_ITEMS,
  PERIOD_ITEMS,
  to24HourTime,
} from '@/utils/reminderInterval';

import { WheelPicker } from '@/components/WheelPicker';

type ReminderTimePickerProps = {
  hour: number;
  minute: number;
  disabled?: boolean;
  onTimeChange: (hour: number, minute: number) => void;
  onInteractionChange?: (active: boolean) => void;
};

function triggerWheelHaptic(): void {
  void Haptics.selectionAsync();
}

export function ReminderTimePicker({
  hour,
  minute,
  disabled = false,
  onTimeChange,
  onInteractionChange,
}: ReminderTimePickerProps) {
  const lastEmittedRef = useRef({ hour, minute });
  const timeParts = from24HourTime(hour, minute);

  const pickerDate = useMemo(() => {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }, [hour, minute]);

  if (Platform.OS === 'ios') {
    const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (!selectedDate || disabled) {
        return;
      }

      const nextHour = selectedDate.getHours();
      const nextMinute = selectedDate.getMinutes();

      if (
        nextHour === lastEmittedRef.current.hour &&
        nextMinute === lastEmittedRef.current.minute
      ) {
        return;
      }

      lastEmittedRef.current = { hour: nextHour, minute: nextMinute };
      triggerWheelHaptic();
      onTimeChange(nextHour, nextMinute);
    };

    return (
      <View
        style={styles.iosTimePickerWrap}
        onTouchStart={() => {
          if (!disabled) {
            onInteractionChange?.(true);
          }
        }}
        onTouchEnd={() => onInteractionChange?.(false)}
        onTouchCancel={() => onInteractionChange?.(false)}
      >
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="spinner"
          onChange={handleChange}
          themeVariant="dark"
          style={styles.iosTimePicker}
        />
      </View>
    );
  }

  return (
    <View style={styles.androidTimeRow}>
      <WheelPicker
        items={HOUR_ITEMS}
        value={timeParts.hour12}
        disabled={disabled}
        onInteractionChange={onInteractionChange}
        onValueChange={(value) => {
          const next = to24HourTime(value, timeParts.minute, timeParts.period);
          onTimeChange(next.hour, next.minute);
        }}
        width={64}
      />
      <WheelPicker
        items={MINUTE_ITEMS}
        value={timeParts.minute}
        disabled={disabled}
        onInteractionChange={onInteractionChange}
        onValueChange={(value) => {
          const next = to24HourTime(timeParts.hour12, value, timeParts.period);
          onTimeChange(next.hour, next.minute);
        }}
        width={64}
      />
      <WheelPicker
        items={PERIOD_ITEMS}
        value={timeParts.period}
        disabled={disabled}
        onInteractionChange={onInteractionChange}
        onValueChange={(value) => {
          const next = to24HourTime(timeParts.hour12, timeParts.minute, value);
          onTimeChange(next.hour, next.minute);
        }}
        width={72}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iosTimePickerWrap: {
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  iosTimePicker: {
    height: 216,
    width: '100%',
  },
  androidTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
