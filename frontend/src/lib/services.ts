import 'server-only';
import { getCatalogueConfig } from './config';
import { parseServicesResponse, type ServiceSummary } from './services.schema';

type CatalogueResult =
  | { status: 'ready'; services: ServiceSummary[] }
  | { status: 'not-found' }
  | { status: 'unavailable' };

export async function getBusinessServices(): Promise<CatalogueResult> {
  try {
    const { apiOrigin, businessId } = getCatalogueConfig();
    const url = new URL(`/api/businesses/${businessId}/services`, apiOrigin);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });

    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) throw new Error('Service catalogue request failed.');

    return {
      status: 'ready',
      services: parseServicesResponse(await response.json()),
    };
  } catch {
    // Avoid logging backend URLs, response bodies, or internal error details.
    console.error('Unable to load the service catalogue.');
    return { status: 'unavailable' };
  }
}
