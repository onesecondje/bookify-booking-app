import { Temporal } from '@js-temporal/polyfill';

const utcInstantPattern =
  /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?Z$/;

export function parseUtcInstant(value: unknown): string | undefined {
  if (typeof value !== 'string' || !utcInstantPattern.test(value)) return undefined;

  try {
    return Temporal.Instant.from(value).toString();
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}
