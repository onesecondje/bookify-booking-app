import 'server-only';
import { AvailabilityLoadStatus } from '../enums/availability-load-status.enum';
import { parseAvailabilityNotFoundStatus, parseAvailabilityResponse } from './availability.schema';
import { getCatalogueConfig } from './config';
import type { AvailabilityResult } from './types/availability.types';
import { isLocalDate } from './validation/local-date';
import { isUuid } from './validation/uuid';

export async function getSpecialistAvailability(
  serviceId: string,
  specialistId: string,
  date: string,
): Promise<AvailabilityResult> {
  if (!isUuid(serviceId)) {
    return { status: AvailabilityLoadStatus.InvalidServiceId };
  }
  if (!isUuid(specialistId)) {
    return { status: AvailabilityLoadStatus.InvalidSpecialistId };
  }
  if (!isLocalDate(date)) {
    return { status: AvailabilityLoadStatus.InvalidDate };
  }

  try {
    const { apiOrigin, businessId } = getCatalogueConfig();
    const url = new URL(
      `/api/businesses/${businessId}/services/${serviceId}/specialists/${specialistId}/availability`,
      apiOrigin,
    );
    url.searchParams.set('date', date);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });

    if (response.status === 404) {
      return { status: parseAvailabilityNotFoundStatus(await response.json()) };
    }
    if (!response.ok) {
      throw new Error('Availability request failed.');
    }

    const availability = parseAvailabilityResponse(await response.json());
    if (availability.date !== date) {
      throw new Error('Availability date does not match request.');
    }
    return { status: AvailabilityLoadStatus.Ready, availability };
  } catch {
    // Do not log URLs, response bodies, or internal error details.
    console.error('Unable to load specialist availability.');
    return { status: AvailabilityLoadStatus.Unavailable };
  }
}
