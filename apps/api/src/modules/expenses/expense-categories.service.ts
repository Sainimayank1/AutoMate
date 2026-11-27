import {
  type CostClass,
  type CreateExpenseCategoryValues,
  type ExpenseCategory,
  type ExpenseIcon,
  FUEL_CATEGORY_KEY,
  pageMeta,
  type PaginationQuery,
  type UpdateExpenseCategoryValues,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { ExpenseCategory as CategoryRow, Prisma } from "@/generated/prisma/client";

const NOT_FOUND = "Category not found";

type Db = Prisma.TransactionClient | PrismaService;

/** A category an expense can be filed under, with the cost class that decides its money views. */
export type ResolvedCategory = {
  category: CategoryRow;
  subcategory: CategoryRow | null;
  costClass: CostClass;
};

const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });

/**
 * Owns `expense_categories`: system categories (seeded, read-only, userId null) and each user's
 * custom ones. A user sees system categories plus their own; never anyone else's.
 */
@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Top-level categories (system first, then yours), with subcategories and how often each is used. */
  async list(
    userId: string,
    { includeInactive, ...page }: PaginationQuery & { includeInactive: boolean },
  ): Promise<Paginated<ExpenseCategory>> {
    const visible = {
      OR: [{ userId: null }, { userId }],
      ...(includeInactive ? {} : { active: true }),
    };
    const where = { ...visible, parentId: null };
    const orderBy: Prisma.ExpenseCategoryOrderByWithRelationInput[] = [
      { userId: { sort: "asc", nulls: "first" } },
      { sortOrder: "asc" },
      { name: "asc" },
    ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.expenseCategory.count({ where }),
      this.prisma.expenseCategory.findMany({
        where,
        orderBy,
        include: { subcategories: { where: visible, orderBy } },
        ...pageArgs(page),
      }),
    ]);

    const ids = rows.flatMap((row) => [row.id, ...row.subcategories.map((item) => item.id)]);
    const [byCategory, bySubcategory] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ["categoryId"],
        where: { userId, categoryId: { in: ids } },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ["subcategoryId"],
        where: { userId, subcategoryId: { in: ids } },
        _count: true,
      }),
    ]);
    const usage = new Map<string, number>([
      ...byCategory.map((group) => [group.categoryId, group._count] as const),
      ...bySubcategory.map((group) => [group.subcategoryId!, group._count] as const),
    ]);

    const toCategory = (row: CategoryRow, costClass: CostClass): ExpenseCategory => ({
      id: row.id,
      key: row.key,
      name: row.name,
      icon: row.icon as ExpenseIcon,
      costClass,
      parentId: row.parentId,
      custom: row.userId !== null,
      active: row.active,
      usage: usage.get(row.id) ?? 0,
      subcategories: [],
    });
    const items = rows.map((row) => ({
      ...toCategory(row, row.costClass!),
      subcategories: row.subcategories.map((item) => toCategory(item, row.costClass!)),
    }));
    return new Paginated(items, pageMeta(page, total));
  }

  async create(userId: string, input: CreateExpenseCategoryValues): Promise<ExpenseCategory> {
    if (input.parentId) {
      const parent = await this.findVisible(userId, input.parentId);
      if (parent.parentId) {
        throw new BadRequestException(fieldError("parentId", "Subcategories can't have their own"));
      }
      if (parent.key === FUEL_CATEGORY_KEY) {
        throw new BadRequestException(
          fieldError("parentId", "Fuel types come from your vehicles' fuel; they can't be added"),
        );
      }
    }
    await this.assertNameFree(userId, input.parentId ?? null, input.name);
    const row = await this.prisma.expenseCategory.create({
      data: {
        userId,
        parentId: input.parentId ?? null,
        name: input.name,
        icon: input.icon,
        costClass: input.parentId ? null : input.costClass,
      },
    });
    return this.one(userId, row.parentId ?? row.id, row.id);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateExpenseCategoryValues,
  ): Promise<ExpenseCategory> {
    const row = await this.findOwnCustom(userId, id);
    if (input.name && input.name.toLowerCase() !== row.name.toLowerCase()) {
      await this.assertNameFree(userId, row.parentId, input.name, id);
    }
    await this.prisma.expenseCategory.update({ where: { id }, data: input });
    return this.one(userId, row.parentId ?? row.id, id);
  }

  /** Only unused custom categories; a used one is disabled instead, so history keeps its label. */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.findOwnCustom(userId, id);
    const children = await this.prisma.expenseCategory.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    const ids = [id, ...children.map((child) => child.id)];
    const used = await this.prisma.expense.count({
      where: { userId, OR: [{ categoryId: { in: ids } }, { subcategoryId: { in: ids } }] },
    });
    if (used > 0) {
      throw new ConflictException(
        `"${row.name}" is used by ${used} ${used === 1 ? "expense" : "expenses"}. Disable it instead.`,
      );
    }
    await this.prisma.expenseCategory.delete({ where: { id } }); // subcategories cascade
  }

  /**
   * The category and subcategory an expense is filed under, checked: visible to the user, a
   * real parent/child pair, active when newly chosen, and not Fuel unless the caller is the Fuel
   * sync. The cost class always comes from the top-level category.
   */
  async resolve(
    userId: string,
    categoryId: string,
    subcategoryId: string | null | undefined,
    {
      requireActive,
      allowFuel = false,
      db = this.prisma,
    }: { requireActive: boolean; allowFuel?: boolean; db?: Db },
  ): Promise<ResolvedCategory> {
    const category = await db.expenseCategory.findFirst({
      where: { id: categoryId, OR: [{ userId: null }, { userId }] },
    });
    if (!category) throw new BadRequestException(fieldError("categoryId", "Choose a category"));
    if (category.parentId) {
      throw new BadRequestException(fieldError("categoryId", "Choose a main category"));
    }
    if (category.key === FUEL_CATEGORY_KEY && !allowFuel) {
      throw new BadRequestException(
        fieldError("categoryId", "Fuel expenses come from fuel entries. Log the fill-up in Fuel."),
      );
    }
    if (requireActive && !category.active) {
      throw new BadRequestException(fieldError("categoryId", "This category is disabled"));
    }
    let subcategory: CategoryRow | null = null;
    if (subcategoryId) {
      subcategory = await db.expenseCategory.findFirst({
        where: { id: subcategoryId, parentId: category.id, OR: [{ userId: null }, { userId }] },
      });
      if (!subcategory) {
        throw new BadRequestException(fieldError("subcategoryId", "Choose a subcategory of it"));
      }
      if (requireActive && !subcategory.active) {
        throw new BadRequestException(fieldError("subcategoryId", "This subcategory is disabled"));
      }
    }
    return { category, subcategory, costClass: category.costClass! };
  }

  private async one(userId: string, topId: string, id: string): Promise<ExpenseCategory> {
    const page = await this.list(userId, { includeInactive: true, page: 1, pageSize: 100 });
    const top = page.items.find((item) => item.id === topId)!;
    return top.id === id ? top : top.subcategories.find((item) => item.id === id)!;
  }

  private async findVisible(userId: string, id: string): Promise<CategoryRow> {
    const row = await this.prisma.expenseCategory.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  private async findOwnCustom(userId: string, id: string): Promise<CategoryRow> {
    const row = await this.findVisible(userId, id);
    if (row.userId === null) {
      throw new ConflictException("System categories can't be changed. Add your own instead.");
    }
    return row;
  }

  /** Names are unique among siblings, system ones included, ignoring case. */
  private async assertNameFree(
    userId: string,
    parentId: string | null,
    name: string,
    exceptId?: string,
  ) {
    const clash = await this.prisma.expenseCategory.findFirst({
      where: {
        parentId,
        name: { equals: name, mode: "insensitive" },
        OR: [{ userId: null }, { userId }],
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(fieldError("name", "There's already a category with this name"));
    }
  }
}
