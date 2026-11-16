import type { PrismaClient } from './generated/prisma/client.js';

// Stable IDs identify only seed-owned records, independently of editable names.
export const demoBusiness = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Bookify Demo Studio',
  timeZone: 'Europe/Warsaw',
};

export const demoServices = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Haircut',
    durationMinutes: 30,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Beard trim',
    durationMinutes: 15,
    isActive: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    name: 'Hair coloring',
    durationMinutes: 90,
    isActive: false,
  },
];

export const demoSpecialists = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'Alice', isActive: true },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Alex', isActive: true },
] as const;

export const demoAssignments = [
  {
    specialistId: '30000000-0000-4000-8000-000000000001',
    serviceId: '20000000-0000-4000-8000-000000000001',
  },
  {
    specialistId: '30000000-0000-4000-8000-000000000001',
    serviceId: '20000000-0000-4000-8000-000000000002',
  },
  {
    specialistId: '30000000-0000-4000-8000-000000000002',
    serviceId: '20000000-0000-4000-8000-000000000001',
  },
];

// Each weekday has stable IDs for Alice's two periods and Alex's single period.
export const demoWorkingPeriods = [1, 2, 3, 4, 5].flatMap((weekday) => [
  {
    id: `40000000-0000-4000-8000-${String(weekday * 10 + 1).padStart(12, '0')}`,
    specialistId: demoSpecialists[0].id,
    weekday,
    startMinute: 540,
    endMinute: 780,
  },
  {
    id: `40000000-0000-4000-8000-${String(weekday * 10 + 2).padStart(12, '0')}`,
    specialistId: demoSpecialists[0].id,
    weekday,
    startMinute: 840,
    endMinute: 1080,
  },
  {
    id: `40000000-0000-4000-8000-${String(weekday * 10 + 3).padStart(12, '0')}`,
    specialistId: demoSpecialists[1].id,
    weekday,
    startMinute: 600,
    endMinute: 960,
  },
]);

export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.business.upsert({
      where: { id: demoBusiness.id },
      create: demoBusiness,
      update: { name: demoBusiness.name, timeZone: demoBusiness.timeZone },
    });

    for (const service of demoServices) {
      const data = { ...service, businessId: demoBusiness.id };
      await transaction.service.upsert({
        where: { id: service.id },
        create: data,
        update: {
          businessId: data.businessId,
          name: data.name,
          durationMinutes: data.durationMinutes,
          isActive: data.isActive,
        },
      });
    }

    for (const specialist of demoSpecialists) {
      const data = { ...specialist, businessId: demoBusiness.id };
      await transaction.specialist.upsert({
        where: { id: specialist.id },
        create: data,
        update: { businessId: data.businessId, name: data.name, isActive: data.isActive },
      });
    }

    for (const assignment of demoAssignments) {
      const data = { ...assignment, businessId: demoBusiness.id };
      await transaction.specialistService.upsert({
        where: { businessId_specialistId_serviceId: data },
        create: data,
        // Existing assignments have no editable payload; preserve their creation time.
        update: {},
      });
    }

    for (const period of demoWorkingPeriods) {
      const data = { ...period, businessId: demoBusiness.id };
      await transaction.specialistWorkingPeriod.upsert({
        where: { id: period.id },
        create: data,
        update: {
          businessId: data.businessId,
          specialistId: data.specialistId,
          weekday: data.weekday,
          startMinute: data.startMinute,
          endMinute: data.endMinute,
        },
      });
    }
  });
}
