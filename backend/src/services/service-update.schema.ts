import type { ServiceUpdate } from './types/service-update.types.js';

export function parseServiceUpdate(body: unknown): ServiceUpdate | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('name' in body) ||
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    body.name.includes('\0') ||
    !('durationMinutes' in body) ||
    typeof body.durationMinutes !== 'number' ||
    !Number.isInteger(body.durationMinutes) ||
    body.durationMinutes < 1 ||
    body.durationMinutes > 2_147_483_647 ||
    !('isActive' in body) ||
    typeof body.isActive !== 'boolean'
  ) {
    return null;
  }

  return {
    name: body.name.trim(),
    durationMinutes: body.durationMinutes,
    isActive: body.isActive,
  };
}
