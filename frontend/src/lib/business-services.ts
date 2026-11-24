import 'server-only';
import { businessApiRequest } from './business-api-request';
import { parseBusinessServices } from './business-services.schema';
import type { BusinessService } from './types/business-services.types';

export async function getBusinessServices(): Promise<BusinessService[] | null> {
  try {
    const { url, options } = businessApiRequest('manage/services');
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return parseBusinessServices(await response.json());
  } catch {
    return null;
  }
}
