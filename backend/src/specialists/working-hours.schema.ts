import type { WorkingHours } from './types/working-hours.types.js';

function isWorkingHours(value: unknown): value is WorkingHours {
  return (
    typeof value === 'object' &&
    value !== null &&
    'startMinute' in value &&
    typeof value.startMinute === 'number' &&
    Number.isInteger(value.startMinute) &&
    value.startMinute >= 0 &&
    'endMinute' in value &&
    typeof value.endMinute === 'number' &&
    Number.isInteger(value.endMinute) &&
    value.endMinute <= 1440 &&
    value.endMinute > value.startMinute
  );
}

export function parseWorkingHours(body: unknown): WorkingHours[] | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('periods' in body) ||
    !Array.isArray(body.periods) ||
    !body.periods.every(isWorkingHours)
  ) {
    return null;
  }

  const periods = [...body.periods].sort((a, b) => a.startMinute - b.startMinute);
  if (periods.some((period, index) => (periods[index - 1]?.endMinute ?? 0) > period.startMinute)) {
    return null;
  }

  return periods.map(({ startMinute, endMinute }) => ({ startMinute, endMinute }));
}
