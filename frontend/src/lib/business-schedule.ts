import 'server-only';
import { businessApiRequest } from './business-api-request';
import { parseBusinessSchedule } from './business-schedule.schema';
import type { BusinessScheduleResponse, WorkingPeriod } from './types/business-schedule.types';

export async function getBusinessSchedule(
  specialistId?: string,
): Promise<BusinessScheduleResponse | null> {
  try {
    const { url, options } = businessApiRequest('schedule');
    if (specialistId !== undefined) url.searchParams.set('specialistId', specialistId);
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return parseBusinessSchedule(await response.json());
  } catch {
    return null;
  }
}

export async function saveBusinessWorkingDay(
  specialistId: string,
  weekday: number,
  periods: Omit<WorkingPeriod, 'weekday'>[],
): Promise<number | null> {
  try {
    const { url, options } = businessApiRequest('schedule');
    url.pathname += `/${specialistId}/${weekday}`;
    const response = await fetch(url, {
      ...options,
      method: 'PUT',
      headers: { ...options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ periods }),
    });
    return response.status;
  } catch {
    return null;
  }
}
