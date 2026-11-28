import { TRIP_ATTACHMENTS_MAX, type TripCost } from "@automate/shared";

import { AttachmentsPanel } from "@/features/attachments/components/attachments-panel";
import { COST_LABELS } from "@/features/trips/constants";
import {
  useDeleteTripAttachment,
  useTripAttachments,
  useUploadTripAttachment,
} from "@/features/trips/hooks/use-trips";
import { tripsService } from "@/features/trips/services/trips-service";
import { formatCurrency } from "@/utils/format";

/** Stitch "Trip Details — Photos & Receipts": a trip's (or plan's) photos and receipts. */
export function TripAttachments({
  tripId,
  costs = [],
  readOnly,
}: {
  tripId: string;
  /** To label receipts with their cost. */
  costs?: TripCost[];
  readOnly: boolean;
}) {
  const { data, error } = useTripAttachments(tripId);
  const upload = useUploadTripAttachment(tripId);
  const remove = useDeleteTripAttachment(tripId);
  const items = data?.map((file) => {
    const cost = costs.find((item) => item.id === file.costId);
    return {
      ...file,
      note: cost && `Receipt for ${COST_LABELS[cost.category]} · ${formatCurrency(cost.amount)}`,
    };
  });
  return (
    <AttachmentsPanel
      title="Photos & receipts"
      items={items}
      max={TRIP_ATTACHMENTS_MAX}
      readOnly={readOnly}
      error={error && "Couldn't load the files. Refresh to try again."}
      onUpload={(file) => upload.mutateAsync({ file })}
      onOpen={async (item) => (await tripsService.attachmentLink(tripId, item.id)).url}
      onRemove={(item) => remove.mutateAsync(item.id)}
    />
  );
}
