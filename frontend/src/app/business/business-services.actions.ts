'use server';

import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { updateBusinessService } from '@/lib/business-services';
import { isUuid } from '@/lib/validation/uuid';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import type { ServiceEditState } from './types/business-services.types';

export async function saveService(
  serviceId: string,
  _previous: ServiceEditState | null,
  form: FormData,
): Promise<ServiceEditState> {
  if (!canViewBusinessDashboard((await headers()).get('authorization')))
    return { saved: false, message: 'Sign in again to save the service.' };
  if (!isUuid(serviceId)) return { saved: false, message: 'This service is unavailable.' };

  const name = form.get('name');
  const duration = form.get('durationMinutes');
  const status = form.get('isActive');
  const durationMinutes =
    typeof duration === 'string' && /^\d+$/.test(duration) ? Number(duration) : NaN;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 2_147_483_647 ||
    (status !== 'true' && status !== 'false')
  )
    return {
      saved: false,
      message: 'Enter a name, a positive whole number of minutes, and a status.',
    };

  const result = await updateBusinessService(serviceId, {
    name: name.trim(),
    durationMinutes,
    isActive: status === 'true',
  });
  if (result === 400)
    return { saved: false, message: 'Enter a valid service name, duration, and status.' };
  if (result === 404) return { saved: false, message: 'This service is unavailable.' };
  if (result !== 204)
    return {
      saved: false,
      message: 'The save could not be confirmed. Refresh to check the service.',
    };

  revalidatePath('/business');
  return { saved: true, message: 'Service saved.' };
}
