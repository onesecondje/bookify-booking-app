import type { ScheduleSlot } from '../availability/types/schedule-slots.types.js';
import { ApiErrorCode } from '../enums/api-error-code.enum.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { BusinessBookingAction } from './enums/business-booking-action.enum.js';
import type { BookingContact, BookingSelection, CreatedBooking } from './types/booking.types.js';

export async function updateUpcomingBusinessBooking(
  database: PrismaClient,
  businessId: string,
  bookingId: string,
  action: BusinessBookingAction,
  now: Date,
) {
  const booking = { id: bookingId, businessId, startsAt: { gt: now } };
  const isCancellation = action === BusinessBookingAction.Cancel;
  // Match the expected state and change it in one statement.
  const { count } = await database.booking.updateMany({
    where: {
      ...booking,
      approvedAt: isCancellation ? { not: null } : null,
      cancelledAt: null,
    },
    data: action === BusinessBookingAction.Approve ? { approvedAt: now } : { cancelledAt: now },
  });
  if (count > 0) {
    return null;
  }

  const current = await database.booking.findFirst({
    where: booking,
    select: { approvedAt: true, cancelledAt: true },
  });
  if (!current) {
    return ApiErrorCode.BookingNotFound;
  }
  if (isCancellation && current.approvedAt && current.cancelledAt) {
    return null;
  }
  return ApiErrorCode.BookingStateConflict;
}

export function findUpcomingBusinessBookings(
  database: PrismaClient,
  businessId: string,
  now: Date,
) {
  return database.booking.findMany({
    where: { businessId, startsAt: { gt: now } },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      approvedAt: true,
      cancelledAt: true,
      customerName: true,
      customerPhone: true,
      service: { select: { id: true, name: true } },
      specialist: { select: { id: true, name: true } },
    },
  });
}

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
    if (isBookingOverlap(error)) {
      return undefined;
    }
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
