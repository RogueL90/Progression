import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ProgressPhoto } from '@/types/photo';
import { sortPhotosByDateAsc } from '@/utils/date';

export type PlaybackMode = 'timelapse' | 'custom';

const DEFAULT_SECONDS_PER_PHOTO = 0.5;
const MIN_TOTAL_DURATION = 0.5;
const MIN_SECONDS_PER_PHOTO = 0.1;
const MAX_SECONDS_PER_PHOTO = 5;

export function buildTimelapseFrames(photos: ProgressPhoto[]): ProgressPhoto[] {
  return sortPhotosByDateAsc(photos);
}

export function defaultTotalDuration(frameCount: number): number {
  return Math.max(frameCount * DEFAULT_SECONDS_PER_PHOTO, MIN_TOTAL_DURATION);
}

export function useTimelapse(photos: ProgressPhoto[]) {
  const frames = buildTimelapseFrames(photos);
  const frameCount = frames.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<PlaybackMode>('timelapse');
  const [totalDuration, setTotalDuration] = useState(() =>
    defaultTotalDuration(frameCount)
  );
  const [secondsPerPhoto, setSecondsPerPhoto] = useState(DEFAULT_SECONDS_PER_PHOTO);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFrameCountRef = useRef(frameCount);

  const currentPhoto = frames[currentIndex] ?? null;
  const isAtEnd = frameCount > 0 && currentIndex >= frameCount - 1;

  const maxTotalDuration = useMemo(
    () => Math.max(frameCount * 3, defaultTotalDuration(frameCount), 1),
    [frameCount]
  );

  const intervalMs = useMemo(() => {
    if (frameCount === 0) return 500;
    if (mode === 'timelapse') {
      return (totalDuration / frameCount) * 1000;
    }
    return secondsPerPhoto * 1000;
  }, [mode, totalDuration, secondsPerPhoto, frameCount]);

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
    if (frameCount === 0) return;
    if (currentIndex >= frameCount - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [frameCount, currentIndex]);

  const restart = useCallback(() => {
    clearTimer();
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [clearTimer]);

  const seek = useCallback(
    (index: number) => {
      if (frameCount === 0) return;
      const next = Math.max(0, Math.min(Math.round(index), frameCount - 1));
      setCurrentIndex(next);
    },
    [frameCount]
  );

  const setPlaybackMode = useCallback((nextMode: PlaybackMode) => {
    setMode(nextMode);
  }, []);

  const setTimelapseDuration = useCallback((seconds: number) => {
    setTotalDuration(Math.max(MIN_TOTAL_DURATION, seconds));
  }, []);

  const setCustomSecondsPerPhoto = useCallback((seconds: number) => {
    setSecondsPerPhoto(
      Math.max(MIN_SECONDS_PER_PHOTO, Math.min(MAX_SECONDS_PER_PHOTO, seconds))
    );
  }, []);

  useEffect(() => {
    if (prevFrameCountRef.current !== frameCount) {
      prevFrameCountRef.current = frameCount;
      setTotalDuration(defaultTotalDuration(frameCount));
    }
  }, [frameCount]);

  useEffect(() => {
    if (!isPlaying || frameCount === 0) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= frameCount - 1) {
          clearTimer();
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return clearTimer;
  }, [isPlaying, intervalMs, frameCount, clearTimer]);

  useEffect(() => {
    if (currentIndex >= frameCount && frameCount > 0) {
      setCurrentIndex(frameCount - 1);
    }
  }, [frameCount, currentIndex]);

  return {
    frames,
    currentIndex,
    currentPhoto,
    isPlaying,
    isAtEnd,
    mode,
    totalDuration,
    secondsPerPhoto,
    intervalMs,
    maxTotalDuration,
    minTotalDuration: MIN_TOTAL_DURATION,
    minSecondsPerPhoto: MIN_SECONDS_PER_PHOTO,
    maxSecondsPerPhoto: MAX_SECONDS_PER_PHOTO,
    play,
    pause,
    restart,
    seek,
    setMode: setPlaybackMode,
    setTotalDuration: setTimelapseDuration,
    setSecondsPerPhoto: setCustomSecondsPerPhoto,
  };
}
