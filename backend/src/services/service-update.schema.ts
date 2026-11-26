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

function parseSpecialistIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || !input.every(isUuid)) {
    return null;
  }

  const ids = input.map((id) => id.toLowerCase());
  return new Set(ids).size === ids.length ? ids : null;
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
  if (!details) {
    return null;
  }

  const update = { ...details, isActive: body.isActive };
  if (!('specialistIds' in body)) {
    return update;
  }

  const specialistIds = parseSpecialistIds(body.specialistIds);
  return specialistIds && { ...update, specialistIds };
}

export function parseServiceCreation(body: unknown): ServiceCreation | null {
  if (typeof body !== 'object' || body === null || !('specialistIds' in body)) {
    return null;
  }
  const details = parseServiceDetails(body);
  const specialistIds = parseSpecialistIds(body.specialistIds);
  if (!details || !specialistIds?.length) {
    return null;
  }
  return { ...details, specialistIds };
}
