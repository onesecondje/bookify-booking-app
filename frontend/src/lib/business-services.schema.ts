import { isService } from './services.schema';
import { isSpecialist } from './specialists.schema';
import type { BusinessService, BusinessServiceSpecialist } from './types/business-services.types';

function isBusinessServiceSpecialist(value: unknown): value is BusinessServiceSpecialist {
  return isSpecialist(value) && 'isActive' in value && typeof value.isActive === 'boolean';
}

function isBusinessService(value: unknown): value is BusinessService {
  return (
    isService(value) &&
    'isActive' in value &&
    typeof value.isActive === 'boolean' &&
    'specialists' in value &&
    Array.isArray(value.specialists) &&
    value.specialists.every(isBusinessServiceSpecialist)
  );
}

export function parseBusinessServices(payload: unknown): BusinessService[] {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('services' in payload) ||
    !Array.isArray(payload.services) ||
    !payload.services.every(isBusinessService)
  ) {
    throw new Error('Invalid business services response.');
  }

  return payload.services;
}
