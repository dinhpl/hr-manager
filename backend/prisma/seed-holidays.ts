import { PrismaClient } from '@prisma/client';
import { seedDefaultHolidays } from './holiday-seed';

const prisma = new PrismaClient();

async function main() {
  const result = await seedDefaultHolidays(prisma);

  if (result.skipped) {
    console.log('[seed:holidays] No default holiday data found. Skipping bootstrap.');
    return;
  }

  console.log(
    `[seed:holidays] Imported ${result.created}/${result.totalDefaults} default holidays from JSON.`,
  );
}

main()
  .catch((error) => {
    console.error('[seed:holidays] Failed to seed holidays.', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
