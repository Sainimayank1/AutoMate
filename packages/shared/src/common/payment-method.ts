/** How a record was paid for. Shared by Fuel and Expenses (and their linked expense). */
export const PaymentMethod = {
  UPI: "UPI",
  CARD: "CARD",
  CASH: "CASH",
  NET_BANKING: "NET_BANKING",
  WALLET: "WALLET",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
