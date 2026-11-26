import { getScheduleAvailability } from '../availability/availability.service.js';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { insertBooking } from './bookings.repository.js';
import type { BookingRequest } from './types/booking.types.js';

export async function createBooking(database: PrismaClient, request: BookingRequest) {
  const { businessId, serviceId, specialistId, date, startsAt } = request;
  const result = await getScheduleAvailability(database, businessId, serviceId, specialistId, date);
  if (result.error) {
    return { status: 404, error: result.error } as const;
  }

  const slot = result.availability.slots.find((candidate) => candidate.startsAt === startsAt);
  if (!slot) {
    return {
      status: 409,
      error: {
        code: ApiErrorCode.SlotUnavailable,
        message: 'The selected slot is no longer offered.',
      },
    } as const;
  }

  const booking = await insertBooking(database, request, slot);
  if (!booking) {
    return {
      status: 409,
      error: {
        code: ApiErrorCode.BookingConflict,
        message: 'The selected time overlaps an existing booking.',
      },
    } as const;
  }

  return { status: 201, booking } as const;
}
