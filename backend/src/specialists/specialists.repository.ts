import { ServiceSpecialistsStatus } from '../enums/service-specialists-status.enum.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { WorkingHours } from './types/working-hours.types.js';

export function replaceSpecialistWorkingDay(
  database: PrismaClient,
  businessId: string,
  specialistId: string,
  weekday: number,
  periods: WorkingHours[],
) {
  return database.$transaction(
    async (tx) => {
      const specialist = await tx.specialist.findUnique({
        where: { businessId_id: { businessId, id: specialistId } },
        select: { id: true },
      });
      if (!specialist) return false;

      const day = { businessId, specialistId, weekday };
      await tx.specialistWorkingPeriod.deleteMany({ where: day });
      if (periods.length) {
        await tx.specialistWorkingPeriod.createMany({
          data: periods.map((period) => ({ ...day, ...period })),
        });
      }
      return true;
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function findBusinessSchedule(
  database: PrismaClient,
  businessId: string,
  specialistId?: string,
) {
  const business = await database.business.findUnique({
    where: { id: businessId },
    select: {
      timeZone: true,
      specialists: {
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, isActive: true },
      },
    },
  });
  if (!business) return null;

  const { specialists, timeZone } = business;
  const specialist = specialistId
    ? specialists.find(({ id }) => id === specialistId)
    : specialists[0];
  if (!specialist) return { specialists, schedule: null };

  const workingPeriods = await database.specialistWorkingPeriod.findMany({
    where: { businessId, specialistId: specialist.id },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    select: { weekday: true, startMinute: true, endMinute: true },
  });
  return {
    specialists,
    schedule: { id: specialist.id, name: specialist.name, timeZone, workingPeriods },
  };
}

export async function findServiceSpecialists(
  database: PrismaClient,
  businessId: string,
  serviceId: string,
) {
  const business = await database.business.findUnique({
    where: { id: businessId },
    select: {
      services: {
        where: { id: serviceId, isActive: true },
        select: {
          specialists: {
            where: { businessId, specialist: { businessId, isActive: true } },
            orderBy: [{ specialist: { name: 'asc' } }, { specialistId: 'asc' }],
            select: { specialist: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (business === null) return { status: ServiceSpecialistsStatus.BusinessNotFound } as const;

  const service = business.services[0];
  if (service === undefined) return { status: ServiceSpecialistsStatus.ServiceNotFound } as const;

  return {
    status: ServiceSpecialistsStatus.Ready,
    specialists: service.specialists.map((assignment) => assignment.specialist),
  } as const;
}
