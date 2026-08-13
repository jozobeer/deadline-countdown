export type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  overdue: boolean;
};

export function formatRemaining(targetAt: string, now: number): Remaining {
  const remaining = Date.parse(targetAt) - now;
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, overdue: true };
  }

  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, overdue: false };
}
