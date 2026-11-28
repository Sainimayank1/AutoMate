import type { BackupFileTarget } from "@automate/shared";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { attachmentsService } from "@/features/attachments/services/attachments-service";
import { backupService } from "@/features/backup/services/backup-service";
import { documentsService } from "@/features/documents/services/documents-service";
import { settingsService } from "@/features/settings/services/settings-service";
import { tripsService } from "@/features/trips/services/trips-service";

/** The JSON inside a ZIP backup; files sit beside it under `files/`. */
export const BACKUP_ENTRY = "backup.json";
/** The largest ZIP a restore reads in the browser. */
export const MAX_ARCHIVE_BYTES = 300 * 1024 * 1024;

/**
 * A ZIP backup: `backup.json` plus every file it refers to, fetched through short-lived links and
 * packed in the browser (nothing large passes through the API).
 */
export async function buildArchive(vehicleId?: string): Promise<Blob> {
  const [backup, links] = await Promise.all([
    backupService.backup(vehicleId),
    backupService.fileLinks(vehicleId),
  ]);
  const entries: Record<string, Uint8Array> = {
    [BACKUP_ENTRY]: strToU8(JSON.stringify(backup, null, 2)),
  };
  for (const link of links) {
    const response = await fetch(link.url);
    if (!response.ok)
      throw new Error(`Couldn't download ${link.path.split("/").pop()}. Try again.`);
    entries[link.path] = new Uint8Array(await response.arrayBuffer());
  }
  // Photos and PDFs are already compressed: a light level keeps it quick.
  return new Blob([zipSync(entries, { level: 1 }) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}

/** The backup and its files from a ZIP; throws when it isn't one of ours. */
export function readArchive(bytes: Uint8Array): {
  backup: unknown;
  files: Record<string, Uint8Array>;
} {
  const files = unzipSync(bytes);
  const json = files[BACKUP_ENTRY];
  if (!json) throw new Error("This ZIP isn't an AutoMate backup (no backup.json inside).");
  return { backup: JSON.parse(strFromU8(json)) as unknown, files };
}

/**
 * Uploads each file from the ZIP to the record it was restored to, through the normal upload
 * flows (checked like any upload). A document's files are attached in one change.
 */
export async function restoreFiles(
  targets: BackupFileTarget[],
  files: Record<string, Uint8Array>,
  onProgress: (done: number, total: number) => void,
): Promise<{ restored: number; failed: string[] }> {
  const failed: string[] = [];
  const documents = new Map<string, { ids: string[]; names: string[] }>();
  let restored = 0;
  let done = 0;
  for (const target of targets) {
    const bytes = files[target.path];
    try {
      if (!bytes) throw new Error("Not in the ZIP");
      const file = new File([bytes as Uint8Array<ArrayBuffer>], target.fileName, {
        type: target.contentType,
      });
      if (target.kind === "document") {
        const uploaded = await documentsService.upload(file);
        const entry = documents.get(target.id!) ?? { ids: [], names: [] };
        entry.ids.push(uploaded.id);
        entry.names.push(target.fileName);
        documents.set(target.id!, entry);
      } else if (target.kind === "avatar") {
        await settingsService.uploadAvatar(file);
      } else if (target.kind === "trip") {
        await tripsService.uploadAttachment(target.id!, file, target.costId ?? undefined);
      } else {
        await attachmentsService.upload(target.kind, target.id!, file);
      }
      restored += 1;
    } catch {
      failed.push(target.fileName);
    }
    onProgress(++done, targets.length);
  }
  for (const [id, { ids, names }] of documents) {
    try {
      await documentsService.update(id, { fileIds: ids });
    } catch {
      restored -= ids.length;
      failed.push(...names);
    }
  }
  return { restored, failed };
}
