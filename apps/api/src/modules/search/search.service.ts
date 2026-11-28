import {
  pageMeta,
  SEARCH_KINDS,
  type SearchKind,
  type SearchQuery,
  type SearchResult,
} from "@automate/shared";
import { Injectable } from "@nestjs/common";

import { day, rupees } from "@/common/format";
import { Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const plain = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;
type Found = { results: SearchResult[]; total: number };

/**
 * App-wide search (the header's "Search records…", Ctrl K): the user's own records whose names,
 * numbers or notes contain the text, case-insensitively. Results come grouped by kind (vehicles
 * first), newest first within each kind, one page at a time.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, { q, page, pageSize }: SearchQuery) {
    const has = { contains: q, mode: "insensitive" as const };
    // Enough of each kind to fill this page whichever kinds it lands in.
    const take = page * pageSize;
    const found = await Promise.all(SEARCH_KINDS.map((kind) => this.find(kind, userId, has, take)));
    const all = found.flatMap((group) => group.results);
    const total = found.reduce((sum, group) => sum + group.total, 0);
    const start = (page - 1) * pageSize;
    return new Paginated(all.slice(start, start + pageSize), pageMeta({ page, pageSize }, total));
  }

  private async find(
    kind: SearchKind,
    userId: string,
    has: { contains: string; mode: "insensitive" },
    take: number,
  ): Promise<Found> {
    const db = this.prisma;
    switch (kind) {
      case "vehicle": {
        const where = {
          userId,
          OR: [
            { make: has },
            { model: has },
            { variant: has },
            { registrationNumber: has },
            { vin: has },
          ],
        };
        const [rows, total] = await Promise.all([
          db.vehicle.findMany({ where, orderBy: { createdAt: "desc" }, take }),
          db.vehicle.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => ({
            kind,
            id: row.id,
            title: [row.make, row.model, row.variant].filter(Boolean).join(" "),
            subtitle: plain([row.registrationNumber, row.archivedAt ? "Archived" : null]),
            href: `/garage/${row.id}`,
          })),
        };
      }
      case "expense": {
        const where = {
          userId,
          OR: [{ title: has }, { vendor: has }, { description: has }, { notes: has }],
        };
        const [rows, total] = await Promise.all([
          db.expense.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], take }),
          db.expense.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => ({
            kind,
            id: row.id,
            title: row.title,
            subtitle: plain([
              `${row.kind === "REFUND" ? "−" : ""}${rupees(row.amount)}`,
              day(iso(row.date)),
              row.vendor,
            ]),
            href: `/expenses/transactions/${row.id}`,
          })),
        };
      }
      case "fuel": {
        const where = { userId, OR: [{ stationName: has }, { location: has }, { notes: has }] };
        const [rows, total] = await Promise.all([
          db.fuelEntry.findMany({ where, orderBy: { filledAt: "desc" }, take }),
          db.fuelEntry.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => ({
            kind,
            id: row.id,
            title: row.stationName ?? row.location ?? "Fill-up",
            subtitle: plain([rupees(row.totalAmount), day(iso(row.filledAt))]),
            href: `/fuel/${row.vehicleId}/${row.id}/edit`,
          })),
        };
      }
      case "service": {
        const where = {
          userId,
          OR: [
            { title: has },
            { description: has },
            { notes: has },
            { technician: has },
            { provider: { name: has } },
          ],
        };
        const [rows, total] = await Promise.all([
          db.serviceRecord.findMany({
            where,
            include: { provider: { select: { name: true } } },
            orderBy: [{ serviceDate: "desc" }, { id: "desc" }],
            take,
          }),
          db.serviceRecord.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => ({
            kind,
            id: row.id,
            title: row.title,
            subtitle: plain([day(iso(row.serviceDate)), row.provider?.name]),
            href: `/maintenance/records/${row.vehicleId}/${row.id}`,
          })),
        };
      }
      case "workshop": {
        const where = { userId, OR: [{ name: has }, { notes: has }] };
        const [rows, total] = await Promise.all([
          db.serviceProvider.findMany({ where, orderBy: { name: "asc" }, take }),
          db.serviceProvider.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => ({
            kind,
            id: row.id,
            title: row.name,
            subtitle: "Workshop",
            href: `/maintenance/workshops/${row.id}`,
          })),
        };
      }
      case "document": {
        const where = {
          userId,
          OR: [{ name: has }, { number: has }, { issuer: has }, { notes: has }],
        };
        const [rows, total] = await Promise.all([
          db.document.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take }),
          db.document.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => ({
            kind,
            id: row.id,
            title: row.name,
            subtitle: plain([
              row.number,
              row.expiryDate ? `Expires ${day(iso(row.expiryDate))}` : null,
            ]),
            href: `/documents/${row.id}`,
          })),
        };
      }
      case "trip": {
        const where = {
          userId,
          OR: [{ title: has }, { origin: has }, { destination: has }, { notes: has }],
        };
        const [rows, total] = await Promise.all([
          db.trip.findMany({ where, orderBy: [{ date: "desc" }, { id: "desc" }], take }),
          db.trip.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => {
            const plan = row.status === "PLANNED" || row.status === "DRAFT";
            const route =
              row.origin && row.destination ? `${row.origin} → ${row.destination}` : null;
            return {
              kind,
              id: row.id,
              title: row.title ?? route ?? "Trip",
              subtitle: plain([
                day(iso(row.date)),
                row.title ? route : null,
                plan ? "Planned" : null,
              ]),
              href: plan ? `/trips/planner/${row.id}` : `/trips/${row.id}`,
            };
          }),
        };
      }
      case "reminder": {
        const where = { userId, OR: [{ title: has }, { notes: has }] };
        const [rows, total] = await Promise.all([
          db.reminder.findMany({ where, orderBy: [{ dueDate: "desc" }, { id: "desc" }], take }),
          db.reminder.count({ where }),
        ]);
        return {
          total,
          results: rows.map((row) => ({
            kind,
            id: row.id,
            title: row.title,
            subtitle: plain([`Due ${day(iso(row.dueDate))}`, row.doneAt ? "Done" : null]),
            href: `/notifications/reminders?reminder=${row.id}`,
          })),
        };
      }
    }
  }
}
