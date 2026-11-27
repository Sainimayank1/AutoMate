/**
 * Seeds reference data only (e.g. expense categories once that table exists), using idempotent
 * upserts so it is safe to re-run. Never seed users, vehicles or other mock business data.
 * Run: pnpm --filter @automate/api prisma:seed
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedSystemExpenseCategories } from "../src/modules/expenses/expense-categories.seed.js";

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await prisma.$connect();
    const categories = await seedSystemExpenseCategories(prisma);
    console.log(`Seed complete: ${categories} system expense categories.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
