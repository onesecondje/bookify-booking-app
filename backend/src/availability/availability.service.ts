import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { parseLocalDate } from '../validation/local-date.js';
import { findActiveBookingsInWindow, findAvailabilitySchedule } from './availability.repository.js';
import { generateScheduleSlots } from './schedule-slots.js';

export async function getScheduleAvailability(
  database: PrismaClient,
  businessId: string,
  serviceId: string,
  specialistId: string,
  date: NonNullable<ReturnType<typeof parseLocalDate>>,
) {
  const business = await findAvailabilitySchedule(
    database,
    businessId,
    serviceId,
    specialistId,
    date.dayOfWeek,
  );
  if (!business) {
    return { error: { code: ApiErrorCode.BusinessNotFound, message: 'Business not found.' } };
  }
  const service = business.services[0];
  if (!service) {
    return { error: { code: ApiErrorCode.ServiceNotFound, message: 'Service not found.' } };
  }
  const assignment = service.specialists[0];
  if (!assignment) {
    return {
      error: {
        code: ApiErrorCode.SpecialistNotFound,
        message: 'Specialist not found for this service.',
      },
    };
  }

  const localDate = date.toString();
  const result = generateScheduleSlots({
    date: localDate,
    timeZone: business.timeZone,
    periods: assignment.specialist.workingPeriods,
    durationMinutes: service.durationMinutes,
    now: new Date().toISOString(),
  });
  return { availability: { date: localDate, timeZone: business.timeZone, ...result } };
}

export async function getBookingAvailability(
  database: PrismaClient,
  businessId: string,
  serviceId: string,
  specialistId: string,
  date: NonNullable<ReturnType<typeof parseLocalDate>>,
) {
  const result = await getScheduleAvailability(database, businessId, serviceId, specialistId, date);
  if (result.error) return result;

  const { availability } = result;
  const candidates = availability.slots.map((slot) => ({
    slot,
    startsAt: new Date(slot.startsAt),
    endsAt: new Date(slot.endsAt),
  }));
  const first = candidates[0];
  const last = candidates.at(-1);
  if (!first || !last) return result;

  // Slots are ordered by start and have the same elapsed service duration.
  const bookings = await findActiveBookingsInWindow(
    database,
    businessId,
    specialistId,
    first.startsAt,
    last.endsAt,
  );
  const freeSlots = candidates.filter(
    (slot) =>
      !bookings.some((booking) => slot.startsAt < booking.endsAt && booking.startsAt < slot.endsAt),
  );
  return {
    availability: {
      ...availability,
      slots: freeSlots.map(({ slot }) => slot),
    },
  };
}
