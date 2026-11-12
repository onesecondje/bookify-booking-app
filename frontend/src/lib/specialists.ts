import 'server-only';
import { SpecialistsLoadStatus } from '../enums/specialists-load-status.enum';
import { getCatalogueConfig } from './config';
import {
  parseSpecialistsNotFoundCode,
  parseSpecialistsResponse,
  type SpecialistSummary,
} from './specialists.schema';
import { isUuid } from './validation/uuid';

type SpecialistsResult =
  | { status: SpecialistsLoadStatus.Ready; specialists: SpecialistSummary[] }
  | {
      status:
        | SpecialistsLoadStatus.InvalidServiceId
        | SpecialistsLoadStatus.BusinessNotFound
        | SpecialistsLoadStatus.ServiceNotFound
        | SpecialistsLoadStatus.Unavailable;
    };

export async function getServiceSpecialists(serviceId: string): Promise<SpecialistsResult> {
  if (!isUuid(serviceId)) return { status: SpecialistsLoadStatus.InvalidServiceId };

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
    if (!response.ok) throw new Error('Specialists request failed.');

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
