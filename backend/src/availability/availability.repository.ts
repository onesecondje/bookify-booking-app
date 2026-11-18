import type { PrismaClient } from '../generated/prisma/client.js';

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

export function findActiveBookingsInWindow(
  database: PrismaClient,
  businessId: string,
  specialistId: string,
  windowStart: Date,
  windowEnd: Date,
) {
  return database.booking.findMany({
    where: {
      businessId,
      specialistId,
      cancelledAt: null,
      startsAt: { lt: windowEnd },
      endsAt: { gt: windowStart },
    },
    select: { startsAt: true, endsAt: true },
  });
}
