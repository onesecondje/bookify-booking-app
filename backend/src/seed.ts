import { closeDatabase, prisma } from './db.js';
import { demoBusiness, demoServices, seedDemoData } from './demo-data.js';

try {
  await seedDemoData(prisma);
  console.log(`Demo data ready: business ${demoBusiness.id}, ${demoServices.length} services.`);
} catch {
  // Driver and Prisma errors may contain connection details or row values.
  console.error('Demo seed failed. No changes from this transaction were committed.');
  process.exitCode = 1;
} finally {
  try {
    await closeDatabase();
  } catch {
    console.error('Failed to close database resources after seeding.');
    process.exitCode = 1;
  }
}
