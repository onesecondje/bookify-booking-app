import type { ScheduleSlot } from '../availability/types/schedule-slots.types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
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
  const [booking] = await database.$queryRaw<CreatedBooking[]>`
    INSERT INTO bookings (business_id, service_id, specialist_id, starts_at, ends_at, customer_name, customer_phone)
    VALUES (${businessId}::uuid, ${serviceId}::uuid, ${specialistId}::uuid, ${startsAt}::timestamptz, ${endsAt}::timestamptz, ${customerName}, ${customerPhone})
    ON CONFLICT ON CONSTRAINT bookings_no_active_overlap DO NOTHING
    RETURNING id, business_id AS "businessId", service_id AS "serviceId",
      specialist_id AS "specialistId", starts_at AS "startsAt", ends_at AS "endsAt"
  `;
  return booking;
}
