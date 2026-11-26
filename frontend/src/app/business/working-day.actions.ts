'use server';

import { canViewBusinessDashboard } from '@/lib/business-dashboard-auth';
import { saveBusinessWorkingDay } from '@/lib/business-schedule';
import { isUuid } from '@/lib/validation/uuid';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import type { WorkingDayState } from './types/working-day.types';

function minuteOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export async function saveWorkingDay(
  specialistId: string,
  weekday: number,
  _previous: WorkingDayState | null,
  form: FormData,
): Promise<WorkingDayState> {
  if (!canViewBusinessDashboard((await headers()).get('authorization'))) {
    return { saved: false, message: 'Sign in again to save working hours.' };
  }

  const hours = form.get('hours');
  if (
    !isUuid(specialistId) ||
    !Number.isInteger(weekday) ||
    weekday < 1 ||
    weekday > 7 ||
    typeof hours !== 'string' ||
    hours.length > 20000
  ) {
    return { saved: false, message: 'Invalid working day or working hours.' };
  }

  const periods = [];
  for (const line of hours
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)) {
    const match = /^((?:[01]\d|2[0-3]):[0-5]\d)\s*-\s*((?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.exec(
      line,
    );
    if (!match) {
      return { saved: false, message: 'Use HH:MM-HH:MM on each line.' };
    }
    periods.push({ startMinute: minuteOfDay(match[1]), endMinute: minuteOfDay(match[2]) });
  }

  const status = await saveBusinessWorkingDay(specialistId, weekday, periods);
  if (status === 400) {
    return {
      saved: false,
      message: 'Enter non-overlapping intervals with the end after the start.',
    };
  }
  if (status === 409) {
    return { saved: false, message: 'The schedule changed. Refresh the page and try again.' };
  }
  if (status === 404) {
    return { saved: false, message: 'This specialist is unavailable.' };
  }
  if (status !== 204) {
    return {
      saved: false,
      message: 'The save could not be confirmed. Refresh to check the schedule.',
    };
  }

  revalidatePath('/business');
  return { saved: true, message: 'Working hours saved.' };
}
