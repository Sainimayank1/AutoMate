import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import { emailSchema } from "../auth/auth.schema.js";

/** A transfer waits this long for the recipient. */
export const TRANSFER_EXPIRY_DAYS = 7;

/** `POST /vehicle-transfers`: offer a vehicle, with all its records, to another account. */
export const createTransferSchema = z.object({
  vehicleId: z.uuid("Choose a vehicle"),
  email: emailSchema,
});
export type CreateTransferValues = z.output<typeof createTransferSchema>;

export const TRANSFER_DIRECTIONS = ["incoming", "outgoing"] as const;
export type TransferDirection = (typeof TRANSFER_DIRECTIONS)[number];

export const transferListQuerySchema = paginationQuerySchema.extend({
  direction: z.enum(TRANSFER_DIRECTIONS).default("incoming"),
});
export type TransferListQuery = z.output<typeof transferListQuerySchema>;

export type TransferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";

export interface VehicleTransfer {
  id: string;
  direction: TransferDirection;
  vehicleName: string;
  registrationNumber: string;
  /** The sender (incoming) or the recipient (outgoing). */
  otherParty: { name: string | null; email: string };
  /** PENDING past its expiry reads EXPIRED. */
  status: TransferStatus;
  expiresAt: string;
  decidedAt: string | null;
  createdAt: string;
  /** The recipient's new vehicle, once accepted (incoming only). */
  vehicleId: string | null;
}
