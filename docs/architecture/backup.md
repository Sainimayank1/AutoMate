# Backup, import & export (M12): design

Exports, a full JSON backup and restoring one. Product scope: [MODULES.md M12](../MODULES.md#module-12--backup-import--export).

## 1. Rules

- **Exports** are built in the browser from the API's own lists (like the Expenses CSV), for the active vehicle: fuel history, expenses (refunds negative), service history and vehicle details as CSV; the ownership report is the printable Expenses report (save as PDF); trips export and import from Trips (`/trips/history`). CSV cells are escaped once in `apps/web/src/utils/csv.ts` (quotes, and a leading `'` on text a spreadsheet would run as a formula), with a BOM for Excel.
- **Backup file** (`GET /backup`, `Backup` in `@automate/shared`): `format: "automate-backup"`, `version` (`BACKUP_VERSION`, bumped only when a field changes meaning), `exportedAt`, every vehicle (archived ones too) and the papers that aren't a vehicle's. With `vehicleId` it is that vehicle's archive. Each vehicle holds:
  - the vehicle's create fields plus `archived`;
  - fill-ups (each with its `backupId`, so trips can re-link their fuel);
  - service records (workshop by name; items lose their schedule and part links);
  - manual, recurring-recorded and imported expenses, each with its refunds, category by system key or the user's own by name (with icon and cost class). A shared expense comes back as each vehicle's share, and a loan payment without its loan link;
  - trips and plans in the Trips module's own versioned shape (`TripBackupService`);
  - document details.
    Linked expenses (fuel, maintenance, trip costs) aren't in the file: they come back with their records, so nothing is counted twice.
- **Also in the backup:** tracked parts (active ones), inspections (each item's part as `componentBackupId`; follow-up schedule links aren't kept), maintenance schedules (re-linked to their part), loans (with their EMI payment method, reminder and `rateChanges`; EMI payments re-link to the restored loan), recurring payments other than EMIs (active and paused, with `paused`), budgets, and **file references**: each document's files, receipts on expenses and service records, files on parts and inspections, trip photos and receipts (with their cost), and the profile photo (`BackupFileRef`, a `files/<id>/<name>` path inside the ZIP).
- **Not in the backup:** workshop details beyond their name, notifications, preferences, and cancelled recurring payments.
- **Restore** takes the file as posted (up to `BACKUP_MAX_BYTES`, 10 MB: only `/backup/restore*` accept more than the API's usual 100 KB). The frame is checked by `restoreBackupSchema`; every row is then checked by its module's create schema, and a row that fails is skipped with its reason.
  - A vehicle whose registration is already in the garage (or earlier in the file) is left out (`EXISTS`); papers that aren't a vehicle's are left out when one with the same type, name and number is kept.
  - New vehicles are created, then their rows go through each module's own create service, in order: parts → inspections (re-linked to their parts) → fill-ups (oldest first) → service records → loans and their rate changes (a refused change is reported, the loan stays) → recurring payments (paused again if they were) → expenses (a missing category of the user's own is created; EMIs re-linked to their loan) and their refunds → budgets → schedules (re-linked to their part) → trips (one transaction, fill-ups re-linked) → documents → archived again if it was. Loans and recurring payments are tracked from the restore day (`trackedFrom`), so dates already paid aren't owed again; their payments come back as expenses. So the same rules run as for entering them by hand, and linked expenses come back exactly once.
  - A row a module refuses (4xx, such as an odometer out of order) is skipped with its message; anything unexpected undoes that vehicle (it is deleted with everything that cascades from it, and its restored papers) and marks it `FAILED`.
  - Preview runs the same checks without saving. Trips are checked only when restored.
- **Data management:** archiving and deleting a vehicle live in the Garage, deleting the account in Settings, moving a vehicle to another account in the vehicle's page (below).

- **ZIP backups** (`features/backup/utils/archive.ts`, `fflate`): the web asks for the backup and short-lived links to every referenced file (`GET /backup/files`), downloads them and packs `backup.json` plus `files/…` in the browser; nothing large passes through the API. Restoring a ZIP sends `backup.json` as before; the report lists where each file goes (`files`: the restored document, expense, service record, part, inspection, trip (with its cost, for a receipt), or the profile photo when the account has none), and the web uploads them through the normal upload flows (checked like any upload), a document's files attached in one change. A JSON backup restores the records and says how many files it refers to.
- **Vehicle transfer** (`TransfersService`, table `vehicle_transfers`): the owner offers a vehicle to an email address (`POST /vehicle-transfers`); the answer is the same whether or not that email has an account. The account with that email sees it on the Garage page and in its inbox (a `transfer:` notification, never linked to the sender's vehicle) and accepts or declines within 7 days (end of the day, India time); the sender can cancel until then. Accepting is claimed first (no double accept), then `BackupService.moveVehicle` runs the sender's archive through the restore above into the recipient, copies each file in storage (with a new thumbnail), and only then deletes the sender's vehicle and its papers. Any row that wouldn't come across (or a registration the recipient already has) stops the move: the restored copy is removed and the transfer stays open.

## 2. API

| Endpoint                                                      | Notes                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /backup`                                                 | The backup file; `vehicleId` for one vehicle's archive.                                                 |
| `GET /backup/files`                                           | Paginated `{ path, url }` links (15 minutes) to every file the same backup refers to.                   |
| `POST /backup/restore/preview`                                | The file as body: per vehicle its status (`NEW`, `EXISTS`, `INVALID`), counts and the first 50 issues.  |
| `POST /backup/restore`                                        | Restores: statuses become `RESTORED` (with `vehicleId`), `EXISTS`, `INVALID` or `FAILED`.               |
| `GET /vehicle-transfers`                                      | Paginated; `direction` `incoming` (to your email) or `outgoing`. PENDING past its expiry reads EXPIRED. |
| `POST /vehicle-transfers`                                     | `{ vehicleId, email }`: one open transfer per vehicle, never to your own email.                         |
| `POST /vehicle-transfers/:id/accept`, `…/decline`, `…/cancel` | The recipient accepts or declines; the sender cancels.                                                  |

Tested in `test/backup.e2e-spec.ts` (a round trip between two accounts, parts, inspections, rate changes, paused payments and every kind of file, duplicates, the size limit, bad files), `test/transfers.e2e-spec.ts`, `backup.test.tsx` and `garage.test.tsx`.

## 3. Not built

Restoring into an existing vehicle (merging), the items listed under "Not in the backup" above, a fleet-wide PDF, and an email to the transfer's recipient (no email provider: they see it when they sign in).
