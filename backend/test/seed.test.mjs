import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import { URL } from 'node:url';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { demoBusiness, demoServices, seedDemoData } from '../src/demo-data.ts';

async function withSeedDatabase(check) {
  const schema = `bookify_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
    connectionTimeoutMillis: 5000,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, { schema, disposeExternalPool: false }),
    log: [],
  });
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(
      await readFile(new URL('../prisma/migrations/0_init/migration.sql', import.meta.url), 'utf8'),
    );
    await check(prisma, pool);
  } finally {
    try {
      await prisma.$disconnect();
    } finally {
      await pool.end();
      try {
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    }
  }
}

test('seed restores demo values without duplicates and preserves unrelated records and creation times', async () => {
  await withSeedDatabase(async (prisma) => {
    const other = await prisma.business.create({
      data: { name: 'Other studio', timeZone: 'Europe/Kyiv' },
    });
    const otherService = await prisma.service.create({
      data: { name: 'Other service', businessId: other.id, durationMinutes: 45 },
    });
    await seedDemoData(prisma);
    const before = await prisma.service.findMany({
      where: { businessId: demoBusiness.id },
      orderBy: { id: 'asc' },
    });
    const businessBefore = await prisma.business.findUniqueOrThrow({
      where: { id: demoBusiness.id },
    });
    await prisma.business.update({ where: { id: demoBusiness.id }, data: { name: 'Edited demo' } });
    await prisma.service.update({
      where: { id: before[0].id },
      data: { durationMinutes: 60, isActive: false },
    });
    await seedDemoData(prisma);
    assert.equal(await prisma.business.count(), 2);
    assert.equal(await prisma.service.count(), 4);
    assert.deepEqual(
      await prisma.service.findMany({
        where: { businessId: demoBusiness.id },
        orderBy: { id: 'asc' },
      }),
      before,
    );
    assert.deepEqual(
      await prisma.business.findUniqueOrThrow({ where: { id: demoBusiness.id } }),
      businessBefore,
    );
    assert.deepEqual(await prisma.business.findUniqueOrThrow({ where: { id: other.id } }), other);
    assert.deepEqual(
      await prisma.service.findUniqueOrThrow({ where: { id: otherService.id } }),
      otherService,
    );
    assert.equal(before.filter((service) => service.isActive).length, 2);
    assert.equal(before.length, demoServices.length);
  });
});

test('seed rolls back the whole demo dataset when a later service fails', async () => {
  await withSeedDatabase(async (prisma, pool) => {
    await pool.query(
      "ALTER TABLE services ADD CONSTRAINT seed_failure_probe CHECK (name <> 'Beard trim')",
    );
    await assert.rejects(seedDemoData(prisma));
    assert.equal(await prisma.business.count(), 0);
    assert.equal(await prisma.service.count(), 0);
  });
});
