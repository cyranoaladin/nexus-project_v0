import { generateConsistencyReport } from '@/lib/consistency';
import { prisma } from '@/lib/prisma';

(async () => {
  try {
    const report = await generateConsistencyReport(prisma);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[CONSISTENCY_SCRIPT_ERROR]', err);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
