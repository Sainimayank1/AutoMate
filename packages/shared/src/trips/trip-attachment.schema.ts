import { z } from "zod";

import { createUploadSchema, type DocumentFileType } from "../documents/document.schema.js";

/** Photos and receipts a trip can hold (trips.md §1 "Attachments"). */
export const TRIP_ATTACHMENTS_MAX = 20;

/** `POST /trips/:id/attachments/uploads`: the file announced, optionally a cost's receipt. */
export const createTripUploadSchema = createUploadSchema.extend({
  costId: z.uuid().optional(),
});
export type CreateTripUploadValues = z.output<typeof createTripUploadSchema>;

export interface TripAttachment {
  id: string;
  tripId: string;
  /** The cost it's the receipt for, if any. */
  costId: string | null;
  fileName: string;
  contentType: DocumentFileType;
  size: number;
  createdAt: string;
}
