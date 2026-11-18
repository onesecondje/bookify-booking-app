import type { AvailabilitySlot } from './types/availability.types';

export function formatSlotTimes(slots: AvailabilitySlot[], timeZone: string): string[] {
  const clockOptions = { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
  const clock = new Intl.DateTimeFormat('en-GB', clockOptions);
  const clockWithOffset = new Intl.DateTimeFormat('en-GB', {
    ...clockOptions,
    timeZoneName: 'longOffset',
  });
  const starts = slots.map(({ startsAt }) => new Date(startsAt));
  const labels = starts.map((start) => clock.format(start));
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return labels.map((label, index) =>
    counts.get(label) === 1 ? label : clockWithOffset.format(starts[index]),
  );
}
