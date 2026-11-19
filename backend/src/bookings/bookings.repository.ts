import type { ScheduleSlot } from '../availability/types/schedule-slots.types.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import type { BookingContact, BookingSelection, CreatedBooking } from './types/booking.types.js';

export async function insertBooking(
  database: PrismaClient,
  {
    businessId,
    serviceId,
    specialistId,
    customerName,
    customerPhone,
  }: BookingSelection & BookingContact,
  { startsAt, endsAt }: ScheduleSlot,
): Promise<CreatedBooking | undefined> {
  try {
    return await database.booking.create({
      data: {
        businessId,
        serviceId,
        specialistId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        customerName,
        customerPhone,
      },
      select: {
        id: true,
        businessId: true,
        serviceId: true,
        specialistId: true,
        startsAt: true,
        endsAt: true,
      },
    });
  } catch (error) {
    if (isBookingOverlap(error)) return undefined;
    throw error;
  }
}

function isBookingOverlap(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2039') {
    return false;
  }
  const adapterError = error.meta?.driverAdapterError;
  if (typeof adapterError !== 'object' || adapterError === null || !('cause' in adapterError)) {
    return false;
  }
  const cause = adapterError.cause;
  // The bookings table has one exclusion constraint: active specialist overlap.
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'originalCode' in cause &&
    cause.originalCode === '23P01'
  );
}
