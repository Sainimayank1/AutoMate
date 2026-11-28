import type { Backup, BackupRestoreReport, FuelEntry, ServiceRecord } from "@automate/shared";

import { request, requestAllPages } from "@/lib/api-client";

/** Backup & Export (M12): the backup file, restoring one, and the lists the CSV exports need. */
export const backupService = {
  /** Everything, or one vehicle's archive. */
  backup: (vehicleId?: string) => request<Backup>({ url: "/backup", params: { vehicleId } }),
  /** The parsed file goes back as-is; the API checks it. */
  preview: (backup: unknown) =>
    request<BackupRestoreReport>({ method: "POST", url: "/backup/restore/preview", data: backup }),
  restore: (backup: unknown) =>
    request<BackupRestoreReport>({ method: "POST", url: "/backup/restore", data: backup }),
  fills: (vehicleId: string) =>
    requestAllPages<FuelEntry>({ url: `/vehicles/${vehicleId}/fuel-entries` }),
  serviceRecords: (vehicleId: string) =>
    requestAllPages<ServiceRecord>({ url: `/vehicles/${vehicleId}/service-records` }),
};
