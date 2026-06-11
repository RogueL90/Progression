import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProgressPhoto } from '@/types/photo';
import { sortPhotosByDateAsc } from '@/utils/date';

export type TimelapseSpeed = 1 | 2 | 5 | 10;

export function buildTimelapseFrames(photos: ProgressPhoto[]): ProgressPhoto[] {
  return sortPhotosByDateAsc(photos);
}

export function useTimelapse(photos: ProgressPhoto[]) {
  const frames = buildTimelapseFrames(photos);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<TimelapseSpeed>(2);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentPhoto = frames[currentIndex] ?? null;
  const isAtEnd = frames.length > 0 && currentIndex >= frames.length - 1;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
  }, [clearTimer]);

  const play = useCallback(() => {
    if (frames.length === 0) return;
    if (currentIndex >= frames.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [frames.length, currentIndex]);

  const restart = useCallback(() => {
    clearTimer();
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [clearTimer]);

  const setTimelapseSpeed = useCallback(
    (newSpeed: TimelapseSpeed) => {
      setSpeed(newSpeed);
      if (isPlaying) {
        clearTimer();
        setIsPlaying(true);
      }
    },
    [isPlaying, clearTimer]
  );

  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      clearTimer();
      return;
    }

    const intervalMs = 1000 / speed;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= frames.length - 1) {
          clearTimer();
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return clearTimer;
  }, [isPlaying, speed, frames.length, clearTimer]);

  useEffect(() => {
    if (currentIndex >= frames.length && frames.length > 0) {
      setCurrentIndex(frames.length - 1);
    }
  }, [frames.length, currentIndex]);

  return {
    frames,
    currentIndex,
    currentPhoto,
    isPlaying,
    isAtEnd,
    speed,
    play,
    pause,
    restart,
    setSpeed: setTimelapseSpeed,
  };
}
