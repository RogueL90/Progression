import type { PhotoStats } from '@/types/photo';
import { addDays, daysAgoFromToday } from '@/utils/date';
import { getPhotosForProject } from '@/data/photoStorage';

function computeLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    const expected = addDays(dates[i - 1], 1);
    if (dates[i] === expected) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function computeCurrentStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const latest = dates[dates.length - 1];
  const daysSinceLatest = daysAgoFromToday(latest);

  if (daysSinceLatest > 1) return 0;

  let streak = 1;
  for (let i = dates.length - 2; i >= 0; i--) {
    if (dates[i + 1] === addDays(dates[i], 1)) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export async function getStatsForProject(projectId: string): Promise<PhotoStats> {
  const photos = await getPhotosForProject(projectId);
  const dates = [...photos].reverse().map((p) => p.date);

  return {
    totalPhotos: photos.length,
    firstPhotoDate: dates[0] ?? null,
    latestPhotoDate: dates[dates.length - 1] ?? null,
    currentStreak: computeCurrentStreak(dates),
    longestStreak: computeLongestStreak(dates),
  };
}
