import type { PrismaClient } from '../generated/prisma/client.js';
import type { ServiceCreation, ServiceUpdate } from './types/service-update.types.js';

export function createManagedBusinessService(
  database: PrismaClient,
  businessId: string,
  { name, durationMinutes, specialistIds }: ServiceCreation,
) {
  return database.$transaction(async (transaction) => {
    const activeSpecialistCount = await transaction.specialist.count({
      where: { businessId, isActive: true, id: { in: specialistIds } },
    });
    if (activeSpecialistCount !== specialistIds.length) {
      return null;
    }

    return transaction.service.create({
      data: {
        businessId,
        name,
        durationMinutes,
        specialists: {
          createMany: { data: specialistIds.map((specialistId) => ({ specialistId })) },
        },
      },
      select: { id: true },
    });
  });
}

export async function updateManagedBusinessService(
  database: PrismaClient,
  businessId: string,
  serviceId: string,
  data: ServiceUpdate,
): Promise<boolean> {
  const { count } = await database.service.updateMany({
    where: { businessId, id: serviceId },
    data,
  });
  return count === 1;
}

export async function findManagedBusinessServices(database: PrismaClient, businessId: string) {
  const business = await database.business.findUnique({
    where: { id: businessId },
    select: {
      services: {
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          isActive: true,
          specialists: {
            orderBy: [{ specialist: { name: 'asc' } }, { specialistId: 'asc' }],
            select: { specialist: { select: { id: true, name: true, isActive: true } } },
          },
        },
      },
    },
  });

  return (
    business?.services.map(({ specialists, ...service }) => ({
      ...service,
      specialists: specialists.map(({ specialist }) => specialist),
    })) ?? null
  );
}

export async function findBusinessServices(database: PrismaClient, businessId: string) {
  const business = await database.business.findUnique({
    where: { id: businessId },
    select: {
      services: {
        where: { isActive: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, durationMinutes: true },
      },
    },
  });

  // null distinguishes a missing business from an existing one with no services.
  return business?.services ?? null;
}
