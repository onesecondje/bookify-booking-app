import type { PrismaClient } from '../generated/prisma/client.js';

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
