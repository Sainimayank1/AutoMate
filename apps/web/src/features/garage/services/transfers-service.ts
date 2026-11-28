import type { CreateTransferValues, TransferDirection, VehicleTransfer } from "@automate/shared";

import { request, requestPage } from "@/lib/api-client";

/** Moving a vehicle to another account (`/vehicle-transfers`). */
export const transfersService = {
  list: (direction: TransferDirection, page = 1) =>
    requestPage<VehicleTransfer>({
      url: "/vehicle-transfers",
      params: { direction, page, pageSize: 20 },
    }),
  offer: (values: CreateTransferValues) =>
    request<VehicleTransfer>({ method: "POST", url: "/vehicle-transfers", data: values }),
  act: (id: string, action: "accept" | "decline" | "cancel") =>
    request<VehicleTransfer>({ method: "POST", url: `/vehicle-transfers/${id}/${action}` }),
};
