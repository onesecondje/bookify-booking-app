import 'server-only';
import { businessApiRequest } from './business-api-request';
import { parseBusinessServices } from './business-services.schema';
import type { BusinessService, BusinessServiceUpdate } from './types/business-services.types';

export async function getBusinessServices(): Promise<BusinessService[] | null> {
  try {
    const { url, options } = businessApiRequest('manage/services');
    const response = await fetch(url, options);
    if (!response.ok) {
      return null;
    }
    return parseBusinessServices(await response.json());
  } catch {
    return null;
  }
}

export async function updateBusinessService(
  serviceId: string,
  update: BusinessServiceUpdate,
): Promise<number | null> {
  try {
    const { url, options } = businessApiRequest('manage/services');
    url.pathname += `/${serviceId}`;
    const response = await fetch(url, {
      ...options,
      method: 'PUT',
      headers: { ...options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    return response.status;
  } catch {
    return null;
  }
}
