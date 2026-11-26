import { isUuid } from '../validation/uuid.js';
import type {
  ServiceCreation,
  ServiceDetails,
  ServiceUpdate,
} from './types/service-update.types.js';

function parseServiceDetails(body: object): ServiceDetails | null {
  if (
    !('name' in body) ||
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    body.name.includes('\0') ||
    !('durationMinutes' in body) ||
    typeof body.durationMinutes !== 'number' ||
    !Number.isInteger(body.durationMinutes) ||
    body.durationMinutes < 1 ||
    body.durationMinutes > 2_147_483_647
  ) {
    return null;
  }

  return {
    name: body.name.trim(),
    durationMinutes: body.durationMinutes,
  };
}

export function parseServiceUpdate(body: unknown): ServiceUpdate | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('isActive' in body) ||
    typeof body.isActive !== 'boolean'
  ) {
    return null;
  }
  const details = parseServiceDetails(body);
  return details && { ...details, isActive: body.isActive };
}

export function parseServiceCreation(body: unknown): ServiceCreation | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('specialistIds' in body) ||
    !Array.isArray(body.specialistIds) ||
    body.specialistIds.length === 0 ||
    !body.specialistIds.every(isUuid)
  ) {
    return null;
  }
  const details = parseServiceDetails(body);
  if (!details) {
    return null;
  }

  const specialistIds = body.specialistIds.map((id) => id.toLowerCase());
  if (new Set(specialistIds).size !== specialistIds.length) {
    return null;
  }
  return { ...details, specialistIds };
}
