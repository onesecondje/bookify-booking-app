import { Temporal } from '@js-temporal/polyfill';

export function parseLocalDate(value: unknown): Temporal.PlainDate | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return undefined;
  }
  try {
    return Temporal.PlainDate.from(value);
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}
