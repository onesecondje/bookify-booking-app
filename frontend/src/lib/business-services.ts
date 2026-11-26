import 'server-only';
import { businessApiRequest } from './business-api-request';
import { parseBusinessServices } from './business-services.schema';
import type {
  BusinessService,
  BusinessServiceCreation,
  BusinessServiceUpdate,
} from './types/business-services.types';

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

async function writeBusinessService(
  data: BusinessServiceCreation | BusinessServiceUpdate,
  serviceId?: string,
): Promise<number | null> {
  try {
    const { url, options } = businessApiRequest('manage/services');
    if (serviceId !== undefined) {
      url.pathname += `/${serviceId}`;
    }
    const response = await fetch(url, {
      ...options,
      method: serviceId === undefined ? 'POST' : 'PUT',
      headers: { ...options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.status;
  } catch {
    return null;
  }
}

export function createBusinessService(data: BusinessServiceCreation): Promise<number | null> {
  return writeBusinessService(data);
}

export function updateBusinessService(
  serviceId: string,
  update: BusinessServiceUpdate,
): Promise<number | null> {
  return writeBusinessService(update, serviceId);
}
