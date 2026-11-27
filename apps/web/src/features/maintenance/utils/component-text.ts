import { componentKindCategory, type VehicleComponent } from "@automate/shared";

import { formatDate, formatDistance, formatNumber } from "@/utils/format";

/** Words for the API's life and warranty figures; estimates are always called estimates. */

/** "44% used · about 27 months left (estimate)", by the track nearer its end. */
export function lifeText({ life }: VehicleComponent): string | null {
  if (!life) return null;
  const used = `${Math.round(life.fractionUsed * 100)}% used`;
  if (life.decidedBy === "DISTANCE" && life.kmRemaining !== null) {
    return life.kmRemaining >= 0
      ? `${used} · about ${formatDistance(life.kmRemaining)} left (estimate)`
      : `${used} · ${formatDistance(-life.kmRemaining)} past the estimate`;
  }
  if (life.daysRemaining === null) return `${used} (estimate)`;
  const months = Math.round(Math.abs(life.daysRemaining) / 30.44);
  const span =
    months >= 1 ? `${formatNumber(months)} month${months === 1 ? "" : "s"}` : "less than a month";
  return life.daysRemaining >= 0
    ? `${used} · about ${span} left (estimate)`
    : `${used} · ${span} past the estimate`;
}

/** "Under warranty until 14/02/2028 or 60,000 km", "Warranty ended", or null without one. */
export function warrantyText(part: VehicleComponent): string | null {
  if (part.warrantyActive === null && !part.warrantyUntil && part.warrantyKm === null) return null;
  const limits = [
    part.warrantyUntil && formatDate(part.warrantyUntil),
    part.warrantyKm !== null && formatDistance(part.warrantyKm),
  ].filter(Boolean);
  if (part.warrantyActive) return `Under warranty until ${limits.join(" or ")}`;
  return part.state === "INSTALLED" ? "Warranty ended" : `Warranty until ${limits.join(" or ")}`;
}

/** "Amaron Pro · 38B20L" or the position. */
export const partCaption = (part: VehicleComponent) =>
  [part.brand, part.partNumber, part.position].filter(Boolean).join(" · ");

/** The maintenance group of a kind (its icon). */
export const kindGroup = (kind: string) => componentKindCategory(kind).split(".")[0]!;
