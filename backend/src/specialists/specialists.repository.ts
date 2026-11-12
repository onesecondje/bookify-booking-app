import { ServiceSpecialistsStatus } from './specialists.types.js';
import type { PrismaClient } from '../generated/prisma/client.js';

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
