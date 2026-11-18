import 'server-only';
import { CatalogueLoadStatus } from '../enums/catalogue-load-status.enum';
import { getCatalogueConfig } from './config';
import { parseServicesResponse } from './services.schema';
import type { CatalogueResult } from './types/services.types';

export async function getBusinessServices(): Promise<CatalogueResult> {
  try {
    const { apiOrigin, businessId } = getCatalogueConfig();
    const url = new URL(`/api/businesses/${businessId}/services`, apiOrigin);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });

    if (response.status === 404) return { status: CatalogueLoadStatus.NotFound };
    if (!response.ok) throw new Error('Service catalogue request failed.');

    return {
      status: CatalogueLoadStatus.Ready,
      services: parseServicesResponse(await response.json()),
    };
  } catch {
    // Avoid logging backend URLs, response bodies, or internal error details.
    console.error('Unable to load the service catalogue.');
    return { status: CatalogueLoadStatus.Unavailable };
  }
}
