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
