import { SYSTEM_EXPENSE_CATEGORIES } from "@automate/shared";

import type { PrismaClient } from "../../generated/prisma/client";

/**
 * Upserts the system expense categories by key (idempotent: safe on every deploy and in tests).
 * Renames and new entries in SYSTEM_EXPENSE_CATEGORIES reach existing databases this way; ids
 * never change, so expenses keep pointing at the same rows.
 */
export async function seedSystemExpenseCategories(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const [order, category] of SYSTEM_EXPENSE_CATEGORIES.entries()) {
    const fields = { name: category.name, icon: category.icon, sortOrder: order };
    const parent = await prisma.expenseCategory.upsert({
      where: { key: category.key },
      create: { key: category.key, costClass: category.costClass, ...fields },
      update: { costClass: category.costClass, ...fields },
    });
    for (const [index, item] of category.subcategories.entries()) {
      const subFields = {
        name: item.name,
        icon: category.icon,
        sortOrder: index,
        parentId: parent.id,
      };
      await prisma.expenseCategory.upsert({
        where: { key: item.key },
        create: { key: item.key, ...subFields },
        update: subFields,
      });
    }
    count += 1 + category.subcategories.length;
  }
  return count;
}
