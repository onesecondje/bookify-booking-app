import { ApiErrorCode } from '../enums/api-error-code.enum.js';
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

export function updateManagedBusinessService(
  database: PrismaClient,
  businessId: string,
  serviceId: string,
  { specialistIds, ...details }: ServiceUpdate,
) {
  return database.$transaction(async (transaction) => {
    // Serialize edits by locking the service before reading its assignments.
    const [service] = await transaction.$queryRaw<{ id: string }[]>`
      SELECT id FROM services
      WHERE business_id = ${businessId}::uuid AND id = ${serviceId}::uuid
      FOR NO KEY UPDATE
    `;
    if (!service) {
      return ApiErrorCode.ServiceNotFound;
    }

    if (specialistIds?.length) {
      const availableCount = await transaction.specialist.count({
        where: {
          businessId,
          id: { in: specialistIds },
          OR: [{ isActive: true }, { services: { some: { businessId, serviceId } } }],
        },
      });
      if (availableCount !== specialistIds.length) {
        return ApiErrorCode.SpecialistNotFound;
      }
    }

    await transaction.service.update({
      where: { businessId_id: { businessId, id: serviceId } },
      data: details,
      select: { id: true },
    });
    if (specialistIds !== undefined) {
      await transaction.specialistService.deleteMany({
        where: { businessId, serviceId, specialistId: { notIn: specialistIds } },
      });
      if (specialistIds.length) {
        await transaction.specialistService.createMany({
          data: specialistIds.map((specialistId) => ({ businessId, serviceId, specialistId })),
          skipDuplicates: true,
        });
      }
    }
    return null;
  });
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
