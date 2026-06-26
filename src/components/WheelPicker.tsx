import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { theme } from '@/constants/theme';

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
export const WHEEL_HEIGHT = Platform.OS === 'ios' ? 216 : ITEM_HEIGHT * VISIBLE_COUNT;

type WheelPickerProps<T extends string | number> = {
  items: { value: T; label: string }[];
  value: T;
  onValueChange: (value: T) => void;
  onValueSettled?: (value: T) => void;
  disabled?: boolean;
  width?: number;
  onInteractionChange?: (active: boolean) => void;
};

function triggerWheelHaptic(): void {
  void Haptics.selectionAsync();
}

function PickerInteractionWrapper({
  children,
  onInteractionChange,
  disabled,
}: {
  children: ReactNode;
  onInteractionChange?: (active: boolean) => void;
  disabled?: boolean;
}) {
  if (!onInteractionChange) {
    return <>{children}</>;
  }

  return (
    <View
      onTouchStart={() => {
        if (!disabled) {
          onInteractionChange(true);
        }
      }}
      onTouchEnd={() => onInteractionChange(false)}
      onTouchCancel={() => onInteractionChange(false)}
    >
      {children}
    </View>
  );
}

function NativeWheelPicker<T extends string | number>({
  items,
  value,
  onValueChange,
  onValueSettled,
  disabled = false,
  width = 88,
  onInteractionChange,
}: WheelPickerProps<T>) {
  const lastValueRef = useRef(value);

  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  return (
    <PickerInteractionWrapper onInteractionChange={onInteractionChange} disabled={disabled}>
      <Picker
        enabled={!disabled}
        selectedValue={value}
        onValueChange={(nextValue) => {
          if (nextValue === lastValueRef.current) {
            return;
          }

          lastValueRef.current = nextValue as T;
          triggerWheelHaptic();
          onValueChange(nextValue as T);
          onValueSettled?.(nextValue as T);
        }}
        style={[styles.nativePicker, { width, minWidth: width }]}
        itemStyle={styles.nativePickerItem}
      >
        {items.map((item) => (
          <Picker.Item key={String(item.value)} label={item.label} value={item.value} />
        ))}
      </Picker>
    </PickerInteractionWrapper>
  );
}

function ScrollWheelPicker<T extends string | number>({
  items,
  value,
  onValueChange,
  onValueSettled,
  disabled = false,
  width = 72,
  onInteractionChange,
}: WheelPickerProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndexRef = useRef(Math.max(0, items.findIndex((item) => item.value === value)));
  const isDraggingRef = useRef(false);

  const paddingVertical = ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2);

  useEffect(() => {
    const index = items.findIndex((item) => item.value === value);
    if (index < 0) {
      return;
    }

    if (index !== selectedIndexRef.current && !isDraggingRef.current) {
      selectedIndexRef.current = index;
      scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
    }
  }, [items, value]);

  const settleAtOffset = (offsetY: number) => {
    const index = Math.min(items.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
    const previousIndex = selectedIndexRef.current;
    selectedIndexRef.current = index;

    if (index !== previousIndex) {
      triggerWheelHaptic();
      onValueChange(items[index].value);
    }

    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    onValueSettled?.(items[index].value);
    isDraggingRef.current = false;
    onInteractionChange?.(false);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!isDraggingRef.current) {
      return;
    }

    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.min(items.length - 1, Math.max(0, index));

    if (clamped !== selectedIndexRef.current) {
      selectedIndexRef.current = clamped;
      triggerWheelHaptic();
      onValueChange(items[clamped].value);
    }
  };

  return (
    <PickerInteractionWrapper onInteractionChange={onInteractionChange} disabled={disabled}>
      <View style={[styles.scrollContainer, { height: WHEEL_HEIGHT, width }]}>
        <View pointerEvents="none" style={styles.selectionHighlight} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="center"
          decelerationRate={0.92}
          nestedScrollEnabled
          scrollEnabled={!disabled}
          contentContainerStyle={{ paddingVertical }}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            isDraggingRef.current = true;
            onInteractionChange?.(true);
          }}
          onScroll={handleScroll}
          onMomentumScrollEnd={(event) => {
            settleAtOffset(event.nativeEvent.contentOffset.y);
          }}
          onScrollEndDrag={(event) => {
            const velocityY = event.nativeEvent.velocity?.y ?? 0;
            if (Math.abs(velocityY) < 0.1) {
              settleAtOffset(event.nativeEvent.contentOffset.y);
            }
          }}
          onLayout={() => {
            const index = Math.max(0, items.findIndex((item) => item.value === value));
            selectedIndexRef.current = index;
            scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
          }}
        >
          {items.map((item) => (
            <View key={String(item.value)} style={styles.item}>
              <Text style={styles.itemText}>{item.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </PickerInteractionWrapper>
  );
}

export function WheelPicker<T extends string | number>(props: WheelPickerProps<T>) {
  if (Platform.OS === 'ios') {
    return <NativeWheelPicker {...props} />;
  }

  return <ScrollWheelPicker {...props} />;
}

const styles = StyleSheet.create({
  nativePicker: {
    height: WHEEL_HEIGHT,
  },
  nativePickerItem: {
    color: theme.text,
    fontSize: 20,
  },
  scrollContainer: {
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2),
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    minWidth: 48,
  },
});
