import cron from 'node-cron';
import prisma from '../config/prisma';

// Runs daily at 00:05 — marks expired comp-off records (toDate < now) as REJECTED
export function startExpireCompOffJob() {
  cron.schedule('5 0 * * *', async () => {
    try {
      const result = await prisma.compOffRecord.updateMany({
        where: {
          status: 'APPROVED',
          toDate: { lt: new Date() },
        },
        data: { status: 'REJECTED' },
      });
      console.log(`[cron:expire-compoff] Expired ${result.count} comp-off records`);
    } catch (err) {
      console.error('[cron:expire-compoff] Error:', err);
    }
  });
}
