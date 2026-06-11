import type { ProgressPhoto } from '@/types/photo';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function daysBetween(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function sortPhotosByDateAsc(photos: ProgressPhoto[]): ProgressPhoto[] {
  return [...photos].sort((a, b) => a.date.localeCompare(b.date));
}

export function sortPhotosByDateDesc(photos: ProgressPhoto[]): ProgressPhoto[] {
  return [...photos].sort((a, b) => b.date.localeCompare(a.date));
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgoFromToday(dateStr: string): number {
  const today = getTodayDateString();
  const [ty, tm, td] = today.split('-').map(Number);
  const [y, m, d] = dateStr.split('-').map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const target = new Date(y, m - 1, d);
  return Math.floor((todayDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
}
