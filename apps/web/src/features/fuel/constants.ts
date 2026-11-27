import { FUEL_UNIT, type FuelType, MileageStatus, PaymentMethod } from "@automate/shared";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.UPI]: "UPI",
  [PaymentMethod.CARD]: "Card",
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.NET_BANKING]: "Net banking",
  [PaymentMethod.WALLET]: "Wallet",
  [PaymentMethod.OTHER]: "Other",
};

/** Why a fill-up shows no mileage (design skill: muted, explained, never a warning). */
export const MILEAGE_STATUS_TEXT: Record<
  Exclude<MileageStatus, "CALCULATED">,
  { label: string; hint: string }
> = {
  [MileageStatus.BASELINE]: {
    label: "Baseline",
    hint: "Full tank that starts a sequence: mileage is calculated at the next full-tank fill.",
  },
  [MileageStatus.ROLLED_IN]: {
    label: "In next full tank",
    hint: "Partial fill: its fuel is counted in the next full-tank mileage.",
  },
  [MileageStatus.PENDING]: {
    label: "Pending full tank",
    hint: "Partial sequence: mileage will be calculated at your next full-tank fill.",
  },
  [MileageStatus.EXCLUDED]: {
    label: "Not counted",
    hint: "Partial fill with no full tank before it, or the sequence restarted after a missed fill-up.",
  },
};

/** "km/L", "km/kg", "km/kWh". */
export const efficiencyUnit = (fuelType: FuelType) => `km/${FUEL_UNIT[fuelType]}`;
