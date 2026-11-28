# Documents & reminders (M6): design

A vehicle's papers (RC, insurance, PUC, warranty, roadside assistance, loan papers, invoices) and the owner's driving licence, with their dates, reminders and files. Product scope: [MODULES.md M6](../MODULES.md#module-6--documents--reminders); storage strategy: [backend.md §11](backend.md#11-file-storage-strategy); upload security: [security.md §3](security.md#3-file-uploads-when-documents-ships).

## 1. Records

| Rule      | How                                                                                                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vehicle   | Required, except for a driving licence (the owner's). Deleting a vehicle keeps its documents and files, unassigned (`SetNull`), so nothing is lost by accident.                                                                                                 |
| Dates     | Issue date not in the future; expiry on or after issue (shared schema and a database CHECK).                                                                                                                                                                    |
| State     | Worked out on every read from the expiry date (IST): **expired** before today, **expiring** within 30 days (today included), **valid** after, **no expiry** without a date (`document-state.ts`, tested). Lists sort expired and soonest first, no-expiry last. |
| Reminders | Days before expiry, default 30, 7 and 1 (up to five, 0–365), plus an optional date of the user's choosing. They're stored here; Notifications (M10) turns them into alerts.                                                                                     |
| Files     | Up to five per document (front and back of a licence, a multi-page scan): PDF, JPEG, PNG, WebP or HEIC, 10 MB each.                                                                                                                                             |

## 2. Files and storage

File bytes never pass through the JSON API and are never stored in PostgreSQL; a `document_files` row keeps the key (`users/<userId>/<uuid>`, server-made), the client's file name (metadata only), type and size.

1. `POST /documents/uploads { fileName, contentType, size }` checks the type and size and returns a slot: a short-lived (10 minutes) URL to PUT the file to, with its headers.
2. The browser PUTs the file **straight to storage**.
3. `POST /documents/uploads/:fileId/confirm` checks it arrived, its size matches, and its first bytes say it's the announced type (`file-signature.ts`: a renamed file is refused and deleted). Only confirmed files can be attached.
4. `POST /documents` (or `PATCH`) attaches files by id; `fileIds` on a PATCH replaces the set, and dropped files are deleted from storage after the database change. Deleting a document deletes its files.
5. `GET /documents/:id/files/:fileId/link` returns a link valid for 5 minutes, after the ownership check.

**Providers** (`src/storage`, `STORAGE_PROVIDER`):

- `local` (the default outside production): files on disk under `STORAGE_LOCAL_DIR`, uploaded and read through `/storage/local/:token` with HMAC-signed, expiring tokens that stand in for presigned links (an upload larger than announced is refused). Env validation refuses it in production.
- `r2` / `s3`: presigned PUT and GET with `aws4fetch` (path-style `<endpoint>/<bucket>/<key>`). A presigned PUT can't cap the size, so confirm re-checks it. The bucket stays private and its CORS rules must allow the web origin to PUT and GET.
- Production without a bucket: documents work, file routes answer 503.

**Attachments** (`/attachments`, `AttachmentsService`): receipts, invoices, job cards and photos on an expense, a service record, a tracked part or an inspection use the same flow, types and 10 MB limit, up to `MAX_ATTACHMENTS` (10) per record. One `attachments` table with a column per owner (a check constraint allows exactly one); a file goes with its record (cascade). Trips keeps its own `trip_attachments` (trips.md). The web shows them with the shared `AttachmentsPanel` (`features/attachments`).

**Storage cleanup** (`StorageSweepService`, tested in `test/attachments.e2e-spec.ts`): delete triggers on `document_files`, `attachments` and `trip_attachments` queue every removed row's key in `storage_orphans`, whatever removed it (the record, its vehicle, the account). A sweep drops uploads not confirmed within a day (and document files never attached), which queues them too, then deletes queued objects and their queue rows; a failed delete stays queued. It runs at start-up and, at most every ten minutes, after an upload is announced: no scheduler.

**Photo size**: the web scales photos over 1.5 MB down to 2048 px on the long side before announcing the upload (`utils/image.ts`, JPEG stays JPEG, PNG becomes WebP; PDFs, HEIC and small files go as they are), so storage stays light.

**Thumbnails**: on confirm, a JPEG, PNG or WebP document file or attachment gets a 400 px WebP preview made with `sharp` (`ThumbnailService`, stored under its own key in `thumb_key`; HEIC and PDFs get none, and a failure only means no preview). Responses say `thumbnail: true`; the link endpoints return it with `?size=thumb` (the original otherwise), and the `AttachmentsPanel` draws its tiles from it. The thumbnail is deleted with its file (the delete trigger queues `thumb_key` too). Trip attachments have none yet.

## 3. API

| Endpoint                                                | Notes                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /documents`                                        | Paginated. `vehicleId`, `type`, `state`, `search` (name, number, issuer).             |
| `GET /documents/summary`                                | Counts: total, valid, expiring, expired, no expiry, and how many vehicles they cover. |
| `POST /documents`, `GET/PATCH/DELETE /documents/:id`    | PATCH merges onto the stored document and re-checks it whole.                         |
| `POST /documents/uploads`, `POST …/uploads/:id/confirm` | The upload flow (§2).                                                                 |
| `GET /documents/:id/files/:fileId/link`                 | A short-lived link to view or download.                                               |

`DocumentsService.expiring(userId, { vehicleId?, horizonDays })` (exported) lists documents expired or expiring within the horizon, soonest first, for the dashboard and Notifications.

## 4. Phases

All built: **1 · Storage and API** (tested in `document-state.spec.ts`, `file-signature.spec.ts` and `test/documents.e2e-spec.ts`), **2 · Web** (Stitch "Documents Vault", "Add Document", "Document Details": the vault, add / edit with upload and camera, details with preview and download; `documents.test.tsx`) and **3 · Dashboard** ([dashboard.md §6](dashboard.md#6-pending-integrations-do-these-when-the-module-is-built): status items, the expiry card, activity, the quick action; the interim insurance and warranty sources stand in only until the vehicle has those documents).

Reminders are stored on each document (days before expiry and a custom date); delivering them (in-app alerts, snooze) is Notifications (M10), which reads `DocumentsService.expiring`.
