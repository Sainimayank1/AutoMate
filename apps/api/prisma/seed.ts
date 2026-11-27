/**
 * Seeds reference data only (e.g. expense categories once that table exists), using idempotent
 * upserts so it is safe to re-run. Never seed users, vehicles or other mock business data.
 * Run: pnpm --filter @automate/api prisma:seed
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await prisma.$connect();
    // No reference tables yet; add upserts here as modules introduce them.
    console.log("Seed complete (nothing to seed yet).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
