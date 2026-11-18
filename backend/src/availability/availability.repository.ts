import type { PrismaClient } from '../generated/prisma/client.js';
import type { ScheduleSlot } from './types/schedule-slots.types.js';

export function findAvailabilitySchedule(
  database: PrismaClient,
  businessId: string,
  serviceId: string,
  specialistId: string,
  weekday: number,
) {
  return database.business.findUnique({
    where: { id: businessId },
    select: {
      timeZone: true,
      services: {
        where: { id: serviceId, isActive: true },
        select: {
          durationMinutes: true,
          specialists: {
            where: { specialistId, specialist: { isActive: true } },
            select: {
              specialist: {
                select: {
                  workingPeriods: {
                    where: { weekday },
                    select: { weekday: true, startMinute: true, endMinute: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export function findUnoccupiedSlotStarts(
  database: PrismaClient,
  businessId: string,
  specialistId: string,
  slots: ScheduleSlot[],
) {
  return database.$queryRaw<Pick<ScheduleSlot, 'startsAt'>[]>`
    SELECT candidate."startsAt"
    FROM jsonb_to_recordset(${JSON.stringify(slots)}::jsonb)
      AS candidate("startsAt" text, "endsAt" text)
    WHERE NOT EXISTS (
      SELECT 1
      FROM bookings
      WHERE business_id = ${businessId}::uuid
        AND specialist_id = ${specialistId}::uuid
        AND cancelled_at IS NULL
        AND tstzrange(starts_at, ends_at, '[)') &&
            tstzrange(candidate."startsAt"::timestamptz, candidate."endsAt"::timestamptz, '[)')
    )
  `;
}
