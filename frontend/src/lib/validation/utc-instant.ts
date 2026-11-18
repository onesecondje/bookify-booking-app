export function isUtcInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    return false;
  }

  const instant = new Date(value);
  // Date can normalize invalid calendar dates and 24:00.
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().split('.')[0] === value.replace(/(?:\.\d+)?Z$/, '')
  );
}
