import { DocumentState, DocumentType } from "@automate/shared";
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  Clock,
  FileText,
  IdCard,
  Landmark,
  Leaf,
  LifeBuoy,
  type LucideIcon,
  Minus,
  ReceiptIndianRupee,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import type { StatusTone } from "@/components/common/status-badge";

export const DOCUMENT_TYPES: Record<
  DocumentType,
  { label: string; icon: LucideIcon; number: string }
> = {
  [DocumentType.REGISTRATION]: { label: "Registration (RC)", icon: IdCard, number: "Reg. number" },
  [DocumentType.INSURANCE]: { label: "Insurance", icon: ShieldCheck, number: "Policy no." },
  [DocumentType.PUC]: { label: "PUC", icon: Leaf, number: "Certificate no." },
  [DocumentType.DRIVING_LICENCE]: { label: "Driving licence", icon: IdCard, number: "Licence no." },
  [DocumentType.WARRANTY]: { label: "Warranty", icon: BadgeCheck, number: "Warranty no." },
  [DocumentType.ROADSIDE_ASSISTANCE]: {
    label: "Roadside assistance",
    icon: LifeBuoy,
    number: "Plan ID",
  },
  [DocumentType.LOAN]: { label: "Loan papers", icon: Landmark, number: "Loan account" },
  [DocumentType.SERVICE_INVOICE]: { label: "Service invoice", icon: Wrench, number: "Invoice no." },
  [DocumentType.PURCHASE_INVOICE]: {
    label: "Purchase invoice",
    icon: ReceiptIndianRupee,
    number: "Invoice no.",
  },
  [DocumentType.OTHER]: { label: "Other", icon: FileText, number: "Number" },
};

/** The state's badge, and the tint of the card and its icon (design skill: amber soon, red late). */
export const DOCUMENT_STATE: Record<
  DocumentState,
  { label: string; tone: StatusTone; icon: LucideIcon; card: string; tile: string; date: string }
> = {
  [DocumentState.EXPIRED]: {
    label: "Expired",
    tone: "destructive",
    icon: CircleAlert,
    card: "border-destructive/60",
    tile: "bg-destructive/10 text-destructive",
    date: "text-destructive",
  },
  [DocumentState.EXPIRING]: {
    label: "Expiring",
    tone: "warning",
    icon: Clock,
    card: "border-warning/60",
    tile: "bg-warning/10 text-warning",
    date: "text-warning",
  },
  [DocumentState.VALID]: {
    label: "Valid",
    tone: "success",
    icon: CircleCheck,
    card: "",
    tile: "bg-success/10 text-success",
    date: "",
  },
  [DocumentState.NO_EXPIRY]: {
    label: "No expiry",
    tone: "neutral",
    icon: Minus,
    card: "",
    tile: "bg-muted text-muted-foreground",
    date: "text-muted-foreground",
  },
};

/** "14 days", "Today", "Tomorrow" for an expiring document; the state's label otherwise. */
export function stateLabel(state: DocumentState, daysLeft: number | null) {
  if (state !== DocumentState.EXPIRING || daysLeft === null) return DOCUMENT_STATE[state].label;
  return daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft} days`;
}
