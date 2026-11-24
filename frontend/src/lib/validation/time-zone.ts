export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false;
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
