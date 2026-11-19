export function parseCustomerName(value: unknown): string | undefined {
  if (typeof value !== 'string' || /\p{Cc}/u.test(value)) return undefined;
  const name = value.trim();
  return name.length >= 1 && name.length <= 100 ? name : undefined;
}

export function parseCustomerPhone(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 40 || /\p{Cc}/u.test(value)) return undefined;
  const phone = value.trim().replace(/[ ().-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : undefined;
}
