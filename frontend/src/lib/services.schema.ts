import type { ServiceSummary } from './types/services.types';
import { isUuid } from './validation/uuid';

function isService(value: unknown): value is ServiceSummary {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value &&
    isUuid(value.id) &&
    'name' in value &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    'durationMinutes' in value &&
    typeof value.durationMinutes === 'number' &&
    Number.isInteger(value.durationMinutes) &&
    value.durationMinutes > 0
  );
}

export function parseServicesResponse(payload: unknown): ServiceSummary[] {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('services' in payload) ||
    !Array.isArray(payload.services) ||
    !payload.services.every(isService)
  ) {
    throw new Error('Invalid service catalogue response.');
  }

  // Keep the frontend contract explicit even if the API later adds more fields.
  return payload.services.map(({ id, name, durationMinutes }) => ({ id, name, durationMinutes }));
}
