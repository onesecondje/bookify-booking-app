import type { PrismaClient } from '../generated/prisma/client.js';

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
