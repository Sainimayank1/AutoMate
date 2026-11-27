import {
  type CreateProviderValues,
  pageMeta,
  type PaginationQuery,
  type ProviderListQuery,
  type ProviderProfile,
  type ServiceRecord,
  type UpdateProviderValues,
} from "@automate/shared";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { Prisma, type ServiceProvider } from "@/generated/prisma/client";
import { LinkedExpensesService } from "@/modules/expenses/linked-expenses.service";

import { ServiceRecordsService } from "./service-records.service";

const NOT_FOUND = "Workshop not found";
const isoDate = (value: Date) => value.toISOString().slice(0, 10);

/**
 * The user's workshops (docs/architecture/maintenance.md §3d), shared by all their vehicles:
 * profile, preferred, archive. Visits are their service records; what was spent there is read
 * from the records' expenses, net of refunds.
 */
@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly records: ServiceRecordsService,
    private readonly linked: LinkedExpensesService,
  ) {}

  async list(
    userId: string,
    { search, preferred, archived, ...page }: ProviderListQuery,
  ): Promise<Paginated<ProviderProfile>> {
    const where: Prisma.ServiceProviderWhereInput = {
      userId,
      archivedAt: archived ? { not: null } : null,
      ...(preferred !== undefined && { preferred }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceProvider.findMany({
        where,
        orderBy: [{ preferred: "desc" }, { name: "asc" }, { id: "asc" }],
        ...pageArgs(page),
      }),
      this.prisma.serviceProvider.count({ where }),
    ]);
    return new Paginated(await this.present(rows), pageMeta(page, total));
  }

  async get(userId: string, id: string): Promise<ProviderProfile> {
    const [profile] = await this.present([await this.owned(userId, id)]);
    return profile!;
  }

  async create(userId: string, input: CreateProviderValues): Promise<ProviderProfile> {
    // A retried save (same client id) returns the workshop it already made.
    if (input.id) {
      const existing = await this.prisma.serviceProvider.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (existing) return this.get(userId, existing.id);
    }
    await this.assertNameFree(userId, input.name);
    const row = await this.prisma.serviceProvider.create({
      data: { ...columns(input), ...(input.id && { id: input.id }), userId, name: input.name },
    });
    this.logger.log(`Workshop ${row.id} created`);
    return this.get(userId, row.id);
  }

  async update(userId: string, id: string, input: UpdateProviderValues): Promise<ProviderProfile> {
    await this.owned(userId, id);
    if (input.name) await this.assertNameFree(userId, input.name, id);
    await this.prisma.serviceProvider.update({ where: { id }, data: columns(input) });
    this.logger.log(`Workshop ${id} updated`);
    return this.get(userId, id);
  }

  /** Archived workshops leave the suggestions; their history stays. Idempotent. */
  async setArchived(userId: string, id: string, archived: boolean): Promise<ProviderProfile> {
    const row = await this.owned(userId, id);
    if (!!row.archivedAt !== archived) {
      await this.prisma.serviceProvider.update({
        where: { id },
        data: { archivedAt: archived ? new Date() : null },
      });
      this.logger.log(`Workshop ${id} ${archived ? "archived" : "restored"}`);
    }
    return this.get(userId, id);
  }

  /** Only a workshop nothing mentions; one with history is archived instead. */
  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    const [records, components, inspections] = await this.prisma.$transaction([
      this.prisma.serviceRecord.count({ where: { providerId: id } }),
      this.prisma.vehicleComponent.count({ where: { providerId: id } }),
      this.prisma.inspection.count({ where: { providerId: id } }),
    ]);
    if (records + components + inspections > 0) {
      throw new ConflictException(
        "This workshop has history, so it can't be deleted. Archive it to hide it from suggestions.",
      );
    }
    // shortcut: a record saved with this name between the count and the delete loses its
    // workshop link (onDelete SetNull); lock the row if workshops get busy enough to matter.
    await this.prisma.serviceProvider.delete({ where: { id } });
    this.logger.log(`Workshop ${id} deleted`);
  }

  async visits(
    userId: string,
    id: string,
    page: PaginationQuery,
  ): Promise<Paginated<ServiceRecord>> {
    await this.owned(userId, id);
    return this.records.byProvider(userId, id, page);
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.serviceProvider.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  /** Names are unique per user, ignoring case (a concurrent duplicate still hits the index). */
  private async assertNameFree(userId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.serviceProvider.findFirst({
      where: {
        userId,
        name: { equals: name, mode: "insensitive" },
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { archivedAt: true },
    });
    if (!clash) return;
    const message = clash.archivedAt
      ? "An archived workshop has this name. Restore it instead."
      : "You already have a workshop with this name";
    throw new ConflictException({ message, details: [{ field: "name", message }] });
  }

  private async present(rows: ServiceProvider[]): Promise<ProviderProfile[]> {
    const visits = await this.prisma.serviceRecord.findMany({
      where: { providerId: { in: rows.map((row) => row.id) } },
      select: { id: true, providerId: true, serviceDate: true },
    });
    const paid = await this.linked.netBySource(
      this.prisma,
      "MAINTENANCE",
      visits.map((visit) => visit.id),
    );
    return rows.map((row) => {
      const mine = visits.filter((visit) => visit.providerId === row.id);
      const dates = mine.map((visit) => isoDate(visit.serviceDate)).sort();
      const spent = mine.reduce(
        (sum, visit) => sum.plus(paid.get(visit.id) ?? 0),
        new Prisma.Decimal(0),
      );
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        phone: row.phone,
        email: row.email,
        address: row.address,
        city: row.city,
        preferred: row.preferred,
        notes: row.notes,
        archivedAt: row.archivedAt?.toISOString() ?? null,
        stats: {
          visits: mine.length,
          firstVisit: dates[0] ?? null,
          lastVisit: dates.at(-1) ?? null,
          spent: spent.toFixed(2),
        },
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
}

/** The profile fields a create or PATCH sets (undefined leaves a field as it is). */
const columns = (values: UpdateProviderValues) => ({
  name: values.name,
  type: values.type,
  phone: values.phone,
  email: values.email,
  address: values.address,
  city: values.city,
  preferred: values.preferred,
  notes: values.notes,
});
