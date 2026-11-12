import { isUuid } from './validation/uuid';

export type SpecialistSummary = {
  id: string;
  name: string;
};

function isSpecialist(value: unknown): value is SpecialistSummary {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value &&
    isUuid(value.id) &&
    'name' in value &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0
  );
}

export function parseSpecialistsResponse(payload: unknown): SpecialistSummary[] {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('specialists' in payload) ||
    !Array.isArray(payload.specialists) ||
    !payload.specialists.every(isSpecialist)
  ) {
    throw new Error('Invalid specialists response.');
  }

  return payload.specialists.map(({ id, name }) => ({ id, name }));
}

export function parseSpecialistsNotFoundCode(
  payload: unknown,
): 'BUSINESS_NOT_FOUND' | 'SERVICE_NOT_FOUND' {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('error' in payload) ||
    typeof payload.error !== 'object' ||
    payload.error === null ||
    !('code' in payload.error) ||
    (payload.error.code !== 'BUSINESS_NOT_FOUND' && payload.error.code !== 'SERVICE_NOT_FOUND')
  ) {
    throw new Error('Invalid specialists error response.');
  }

  return payload.error.code;
}
