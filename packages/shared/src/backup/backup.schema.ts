import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";

import type { CostClass } from "../expenses/expense-categories.js";
import type { CreateExpenseInput, createRefundSchema } from "../expenses/expense.schema.js";
import type { createDocumentSchema } from "../documents/document.schema.js";
import type { CreateFuelEntryInput } from "../fuel/fuel.schema.js";
import type { CreateServiceRecordInput } from "../maintenance/maintenance.schema.js";
import type { CreateVehicleInput } from "../vehicles/vehicle.schema.js";

/**
 * Backup & Export (M12): one JSON file with the user's vehicles and what they recorded. Rows are
 * kept in the shape each module's create API takes, so a restore goes through the same checks
 * (and recreates linked expenses) as entering them by hand.
 */
export const BACKUP_FORMAT = "automate-backup";
/** Bumped when a field changes meaning; a restore refuses files from a newer version. */
export const BACKUP_VERSION = 1;
/** The largest backup a restore accepts (the API's limit for these routes). */
export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;
export const BACKUP_MAX_VEHICLES = 50;

export const BACKUP_SECTIONS = [
  "fuel",
  "services",
  "expenses",
  "trips",
  "documents",
  "components",
  "inspections",
  "schedules",
  "loans",
  "recurring",
  "budgets",
] as const;
export type BackupSection = (typeof BACKUP_SECTIONS)[number];

/** A category by system key, else the user's own by name (created on restore when missing). */
export interface BackupCategoryRef {
  key: string | null;
  name: string;
  icon: string;
  /** Top-level categories only. */
  costClass: CostClass | null;
}

export type BackupVehicleRow = Omit<CreateVehicleInput, "id"> & { archived: boolean };

/**
 * A stored file the backup refers to: `path` names it inside a backup ZIP (`files/…`). A plain
 * JSON backup carries the references without the files.
 */
export interface BackupFileRef {
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}
/** `backupId` re-links trips to the fill-ups that were their fuel. */
export type BackupFuelRow = Omit<CreateFuelEntryInput, "id"> & { backupId: string };
export type BackupServiceRow = Omit<CreateServiceRecordInput, "id"> & { files: BackupFileRef[] };
/** One vehicle's share; a shared expense comes back as each vehicle's own. */
export type BackupExpenseRow = Omit<
  CreateExpenseInput,
  "id" | "allocation" | "categoryId" | "subcategoryId" | "loanId"
> & {
  category: BackupCategoryRef;
  subcategory: BackupCategoryRef | null;
  refunds: z.input<typeof createRefundSchema>[];
  /** The loan this payment belongs to (its backup id), restored with the vehicle's loans. */
  loanBackupId: string | null;
  /** Receipts. */
  files: BackupFileRef[];
};
/** Details, and its files by reference (in the ZIP backup). */
export type BackupDocumentRow = Omit<
  z.input<typeof createDocumentSchema>,
  "vehicleId" | "fileIds"
> & {
  files: BackupFileRef[];
};

export interface BackupVehicle {
  vehicle: BackupVehicleRow;
  fuel: BackupFuelRow[];
  services: BackupServiceRow[];
  expenses: BackupExpenseRow[];
  /** Trips and plans in the Trips module's own backup shape (versioned there). */
  trips: Record<string, unknown>[];
  documents: BackupDocumentRow[];
  /** Tracked parts (backupId re-links schedules to them). */
  components: Record<string, unknown>[];
  /** Inspections as create input, their items' parts as `componentBackupId`, with their files. */
  inspections: Record<string, unknown>[];
  /** Maintenance schedules, each with its part's backup id if it had one. */
  schedules: Record<string, unknown>[];
  /** Loans (backupId re-links EMI payments); their EMI schedules come back with them. */
  loans: Record<string, unknown>[];
  /** Recurring payments other than loan EMIs, category by reference. */
  recurring: Record<string, unknown>[];
  /** Budgets, category by reference (null: everything on the vehicle). */
  budgets: Record<string, unknown>[];
}

/** `GET /backup`: the file the web saves. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  vehicles: BackupVehicle[];
  /** Papers that aren't a vehicle's (a driving licence). */
  documents: BackupDocumentRow[];
  profilePhoto: BackupFileRef | null;
}

/** `GET /backup/files`: a short-lived link to each referenced file, for the ZIP backup. */
export interface BackupFileLink {
  path: string;
  url: string;
}

export const backupQuerySchema = z.object({
  /** One vehicle's archive; every vehicle without it. */
  vehicleId: z.uuid().optional(),
});
export type BackupQuery = z.output<typeof backupQuerySchema>;

/** `GET /backup/files`: links for the same scope as the backup, a page at a time. */
export const backupFilesQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid().optional(),
});
export type BackupFilesQuery = z.output<typeof backupFilesQuerySchema>;

const rows = z.array(z.record(z.string(), z.unknown())).max(20_000).default([]);

/**
 * A backup file as posted to preview and restore. Only its frame is checked here; each row is
 * checked by its module's create schema, and a row that fails is skipped with the reason.
 */
export const restoreBackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT, { error: "This isn't an AutoMate backup file" }),
  version: z
    .number({ error: "This isn't an AutoMate backup file" })
    .int()
    .min(1, "This isn't an AutoMate backup file")
    .max(BACKUP_VERSION, "Made by a newer version of AutoMate: update the app, then restore"),
  exportedAt: z.iso.datetime({ offset: true, error: "This isn't an AutoMate backup file" }),
  vehicles: z
    .array(
      z.object({
        vehicle: z.record(z.string(), z.unknown()),
        fuel: rows,
        services: rows,
        expenses: rows,
        trips: rows,
        documents: rows,
        components: rows,
        inspections: rows,
        schedules: rows,
        loans: rows,
        recurring: rows,
        budgets: rows,
      }),
    )
    .max(BACKUP_MAX_VEHICLES, `A backup holds up to ${BACKUP_MAX_VEHICLES} vehicles`),
  documents: rows,
  profilePhoto: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type RestoreBackupValues = z.output<typeof restoreBackupSchema>;

export type BackupCounts = Record<BackupSection, number>;

/** A row that won't be (or wasn't) restored. `index` is its position in its section. */
export interface BackupIssue {
  section: BackupSection | "vehicle";
  index: number;
  message: string;
}

/**
 * NEW: restored as a new vehicle (preview); RESTORED: done; EXISTS: a vehicle with that
 * registration is already in the garage (or earlier in the file), so it's left out;
 * INVALID: the vehicle's details can't be read; FAILED: restoring it stopped and was undone.
 */
export type BackupVehicleStatus = "NEW" | "RESTORED" | "EXISTS" | "INVALID" | "FAILED";

export interface BackupVehicleOutcome {
  index: number;
  name: string;
  registrationNumber: string;
  status: BackupVehicleStatus;
  /** The restored vehicle. */
  vehicleId: string | null;
  /** Rows that will be (or were) restored. Trips are checked when they're restored. */
  counts: BackupCounts;
  /** The first 50 rows left out, with why. */
  issues: BackupIssue[];
  issueCount: number;
}

/** Where a file from a ZIP backup goes once its record is restored (the web uploads it). */
export interface BackupFileTarget {
  path: string;
  fileName: string;
  contentType: string;
  kind: "document" | "expense" | "service-record" | "component" | "inspection" | "trip" | "avatar";
  /** The restored record (null for the profile photo). */
  id: string | null;
  /** A trip receipt's restored cost. */
  costId?: string | null;
}

/** `POST /backup/restore/preview` (nothing saved) and `POST /backup/restore`. */
export interface BackupRestoreReport {
  exportedAt: string;
  vehicles: BackupVehicleOutcome[];
  /** Papers that aren't a vehicle's. */
  documents: { count: number; issues: BackupIssue[] };
  /** Files the backup refers to that would be (preview) or can now be (restore) uploaded. */
  fileCount: number;
  /** After a restore: where each file goes. */
  files: BackupFileTarget[];
}
