import 'server-only';
import { SpecialistsLoadStatus } from '../enums/specialists-load-status.enum';
import { getCatalogueConfig } from './config';
import { parseSpecialistsNotFoundCode, parseSpecialistsResponse } from './specialists.schema';
import type { SpecialistsResult } from './types/specialists.types';
import { isUuid } from './validation/uuid';

export async function getServiceSpecialists(serviceId: string): Promise<SpecialistsResult> {
  if (!isUuid(serviceId)) {
    return { status: SpecialistsLoadStatus.InvalidServiceId };
  }

  try {
    const { apiOrigin, businessId } = getCatalogueConfig();
    const url = new URL(
      `/api/businesses/${businessId}/services/${serviceId}/specialists`,
      apiOrigin,
    );
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });

    if (response.status === 404) {
      const code = parseSpecialistsNotFoundCode(await response.json());
      return {
        status:
          code === 'BUSINESS_NOT_FOUND'
            ? SpecialistsLoadStatus.BusinessNotFound
            : SpecialistsLoadStatus.ServiceNotFound,
      };
    }
    if (!response.ok) {
      throw new Error('Specialists request failed.');
    }

    return {
      status: SpecialistsLoadStatus.Ready,
      specialists: parseSpecialistsResponse(await response.json()),
    };
  } catch {
    // Do not log URLs, response bodies, or internal error details.
    console.error('Unable to load service specialists.');
    return { status: SpecialistsLoadStatus.Unavailable };
  }
}
