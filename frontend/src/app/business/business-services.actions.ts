'use server';

import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { createBusinessService, updateBusinessService } from '@/lib/business-services';
import { isUuid } from '@/lib/validation/uuid';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import type { ServiceFormState } from './types/business-services.types';

function readServiceDetails(form: FormData) {
  const name = form.get('name');
  const duration = form.get('durationMinutes');
  const durationMinutes =
    typeof duration === 'string' && /^\d+$/.test(duration) ? Number(duration) : NaN;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 2_147_483_647
  ) {
    return null;
  }
  return { name: name.trim(), durationMinutes };
}

export async function createService(form: FormData): Promise<ServiceFormState> {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) {
    return { saved: false, message: 'Sign in again to create a service.' };
  }

  const details = readServiceDetails(form);
  const specialistIds = form.getAll('specialistIds');
  if (!details) {
    return { saved: false, message: 'Enter a name and a positive whole number of minutes.' };
  }
  if (!specialistIds.length || !specialistIds.every(isUuid)) {
    return { saved: false, message: 'Choose at least one active specialist.' };
  }

  const result = await createBusinessService({ ...details, specialistIds });
  if (result === 400) {
    return { saved: false, message: 'Check the service details and specialist selection.' };
  }
  if (result === 404) {
    return {
      saved: false,
      message: 'A selected specialist is unavailable. Refresh and try again.',
    };
  }
  if (result !== 201) {
    return {
      saved: false,
      message: 'Creation could not be confirmed. Refresh the service list before trying again.',
    };
  }

  revalidatePath('/business');
  return { saved: true, message: 'Service created.' };
}

export async function saveService(
  serviceId: string,
  _previous: ServiceFormState | null,
  form: FormData,
): Promise<ServiceFormState> {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) {
    return { saved: false, message: 'Sign in again to save the service.' };
  }
  if (!isUuid(serviceId)) {
    return { saved: false, message: 'This service is unavailable.' };
  }

  const details = readServiceDetails(form);
  const status = form.get('isActive');
  if (!details || (status !== 'true' && status !== 'false')) {
    return {
      saved: false,
      message: 'Enter a name, a positive whole number of minutes, and a status.',
    };
  }

  const specialistIds =
    form.get('editSpecialists') === 'true' ? form.getAll('specialistIds') : undefined;
  if (specialistIds && !specialistIds.every(isUuid)) {
    return { saved: false, message: 'Check the specialist selection.' };
  }

  const result = await updateBusinessService(serviceId, {
    ...details,
    isActive: status === 'true',
    specialistIds,
  });
  if (result === 400) {
    return { saved: false, message: 'Check the service details and specialist selection.' };
  }
  if (result === 404) {
    return {
      saved: false,
      message: 'The service or a selected specialist is unavailable. Refresh and try again.',
    };
  }
  if (result !== 204) {
    return {
      saved: false,
      message: 'The save could not be confirmed. Refresh to check the service.',
    };
  }

  revalidatePath('/business');
  return { saved: true, message: 'Service saved.' };
}
