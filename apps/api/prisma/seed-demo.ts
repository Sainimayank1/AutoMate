/**
 * Demo data for exploring AutoMate locally and for README screenshots. Everything is synthetic.
 *
 * It drives a running API over HTTP, so every record goes through the same validation and linking
 * as real use (fill-ups and service records file their expenses, schedules see their services).
 * Re-running replaces the demo account. It refuses any API that isn't on this machine unless
 * DEMO_ALLOW_REMOTE=true, and it never touches a database directly.
 *
 *   pnpm dev:api               # in one terminal
 *   pnpm db:seed:demo          # in another; then sign in with the account printed at the end
 *
 * DEMO_API_URL (default http://localhost:3000/api/v1) points it at another local port.
 */
import type { ApiSuccessResponse, ExpenseCategory, TripCategory, Vehicle } from "@automate/shared";

const API = process.env.DEMO_API_URL ?? "http://localhost:3000/api/v1";
const ORIGIN = process.env.DEMO_WEB_ORIGIN ?? "http://localhost:5173";
/** A local demo account; not a secret (it only exists on your machine). */
export const DEMO_ACCOUNT = {
  name: "Arjun Mehta",
  email: "demo@automate.example",
  password: "AutoMate-demo-2026",
};

const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(API);
if (!local && process.env.DEMO_ALLOW_REMOTE !== "true") {
  console.error(`Refusing to seed demo data into ${API}: not a local API.`);
  console.error("Demo data is for local exploration. Set DEMO_ALLOW_REMOTE=true to override.");
  process.exit(1);
}

let token = "";
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as ApiSuccessResponse<T>;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json.data;
}
type Session = { accessToken?: string; session?: { accessToken: string } };
const tokenOf = (session: Session) => session.accessToken ?? session.session!.accessToken;

// Dates relative to today (India), so the dashboard always looks current.
const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const day = (offset: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const at = (offset: number, time = "09:00") => `${day(offset)}T${time}:00.000+05:30`;

async function main() {
  // A fresh demo account each run.
  try {
    token = tokenOf(
      await call<Session>("POST", "/auth/login", {
        email: DEMO_ACCOUNT.email,
        password: DEMO_ACCOUNT.password,
      }),
    );
    await call("POST", "/users/me/delete", { password: DEMO_ACCOUNT.password, confirm: "DELETE" });
    console.log("Replaced the previous demo account.");
  } catch {
    // No demo account yet.
  }
  token = tokenOf(
    await call<Session>("POST", "/auth/register", { ...DEMO_ACCOUNT, acceptedTerms: true }),
  );

  const categories = await call<ExpenseCategory[]>("GET", "/expense-categories?pageSize=100");
  const category = (key: string) => {
    const top = categories.find((item) => item.key === key.split(".")[0]);
    const sub = top?.subcategories.find((item) => item.key === key);
    if (!top) throw new Error(`No expense category ${key}`);
    return { categoryId: top.id, subcategoryId: sub?.id ?? null };
  };
  const tripTypes = await call<TripCategory[]>("GET", "/trip-categories?pageSize=100");
  const tripType = (key: string) => tripTypes.find((item) => item.key === key)!.id;

  // ---- Vehicles
  const victoris = await call<Vehicle>("POST", "/vehicles", {
    make: "Maruti Suzuki",
    model: "Victoris",
    variant: "LXI",
    manufacturingYear: 2025,
    category: "SUV",
    registrationNumber: "HR26EV4821",
    fuelType: "PETROL",
    transmission: "MANUAL",
    colour: "Pearl Silver",
    ownershipType: "FINANCED",
    purchaseDate: day(-290),
    purchasePrice: "1145000",
    odometerKm: 2600,
    fuelTankCapacityL: "45",
  });
  const creta = await call<Vehicle>("POST", "/vehicles", {
    make: "Hyundai",
    model: "Creta",
    variant: "SX(O)",
    manufacturingYear: 2023,
    category: "SUV",
    registrationNumber: "DL8CAB9104",
    fuelType: "DIESEL",
    transmission: "AUTOMATIC",
    ownershipType: "OWNED",
    purchaseDate: day(-900),
    purchasePrice: "1890000",
    odometerKm: 30500,
  });

  // ---- Fill-ups: full tanks, one partial, so mileage comes from reliable sequences only.
  const fills: [number, number, string, string, boolean, string][] = [
    [-270, 3000, "38.20", "102.85", true, "IndianOil, Sohna Road"],
    [-240, 3560, "36.10", "103.10", true, "HP, Golf Course Road"],
    [-210, 4110, "35.40", "103.40", true, "IndianOil, Sohna Road"],
    [-182, 4480, "20.00", "103.60", false, "Bharat Petroleum, NH-48"],
    [-165, 4950, "33.80", "103.75", true, "IndianOil, Sohna Road"],
    [-130, 5520, "37.00", "104.02", true, "Shell, Cyber City"],
    [-100, 6060, "35.60", "104.10", true, "HP, Golf Course Road"],
    [-70, 6640, "38.40", "104.25", true, "IndianOil, Sohna Road"],
    [-41, 7180, "36.30", "104.32", true, "Bharat Petroleum, NH-48"],
    [-12, 7760, "38.90", "104.32", true, "IndianOil, Sohna Road"],
  ];
  for (const [offset, km, litres, price, full, station] of fills) {
    await call("POST", `/vehicles/${victoris.id}/fuel-entries`, {
      filledAt: at(offset, "08:30"),
      odometerKm: km,
      fuelType: "PETROL",
      quantity: litres,
      pricePerUnit: price,
      totalAmount: (Number(litres) * Number(price)).toFixed(2),
      isFullTank: full,
      stationName: station,
      paymentMethod: "UPI",
    });
  }
  for (const [offset, km, litres] of [
    [-60, 31200, "42.00"],
    [-20, 31950, "44.50"],
  ] as const) {
    await call("POST", `/vehicles/${creta.id}/fuel-entries`, {
      filledAt: at(offset),
      odometerKm: km,
      fuelType: "DIESEL",
      quantity: litres,
      pricePerUnit: "90.48",
      totalAmount: (Number(litres) * 90.48).toFixed(2),
      isFullTank: true,
      stationName: "IndianOil, Ring Road",
    });
  }

  // ---- Maintenance: schedules, parts and service history (each service files its expense).
  const oil = await call<{ id: string }>("POST", `/vehicles/${victoris.id}/maintenance-schedules`, {
    name: "Engine oil & filter",
    categoryKey: "ENGINE.ENGINE_OIL",
    intervalKm: 10000,
    intervalMonths: 12,
    lastDoneKm: 2900,
    lastDoneDate: day(-280),
  });
  await call("POST", `/vehicles/${victoris.id}/maintenance-schedules`, {
    name: "Periodic service",
    categoryKey: "GENERAL.PERIODIC_SERVICE",
    intervalKm: 5000,
    intervalMonths: 6,
    priority: "HIGH",
  });
  await call("POST", `/vehicles/${victoris.id}/maintenance-schedules`, {
    name: "Wheel alignment & balancing",
    categoryKey: "TYRES.ALIGNMENT",
    intervalKm: 5000,
    lastDoneKm: 2700,
    lastDoneDate: day(-285),
  });
  await call("POST", `/vehicles/${victoris.id}/maintenance-schedules`, {
    name: "Replace tyres",
    categoryKey: "TYRES.REPLACEMENT",
    dueKm: 45000,
    estimatedCost: "24000",
  });
  await call("POST", `/vehicles/${victoris.id}/components`, {
    kind: "BATTERY",
    name: "Amaron Pro battery",
    brand: "Amaron",
    installedAt: day(-290),
    installedKm: 2600,
    expectedLifeMonths: 48,
    warrantyUntil: day(-290 + 3 * 365),
  });
  const service = (body: object) =>
    call("POST", `/vehicles/${victoris.id}/service-records`, {
      providerName: "Maruti Arena Service, Gurugram",
      paymentMethod: "UPI",
      ...body,
    });
  await service({
    type: "ROUTINE_SERVICE",
    title: "1st free service",
    categoryKey: "GENERAL.PERIODIC_SERVICE",
    serviceDate: day(-250),
    odometerKm: 3400,
    labourAmount: "0",
    partsAmount: "650",
    taxAmount: "117",
  });
  await service({
    type: "ROUTINE_SERVICE",
    title: "2nd free service",
    categoryKey: "GENERAL.PERIODIC_SERVICE",
    serviceDate: day(-150),
    odometerKm: 5100,
    labourAmount: "0",
    partsAmount: "4800",
    taxAmount: "864",
    items: [{ name: "Engine oil 0W-20", scheduleId: oil.id }],
  });
  await service({
    type: "REPAIR",
    title: "AC compressor relay",
    categoryKey: "AC.SERVICE",
    serviceDate: day(-55),
    odometerKm: 6800,
    labourAmount: "900",
    partsAmount: "2350",
    taxAmount: "585",
    providerName: "CoolCar AC Works, Sector 49",
  });

  // ---- Expenses (beyond the fill-ups and services above)
  const expense = (key: string, title: string, amount: string, offset: number, extra = {}) =>
    call("POST", "/expenses", {
      allocation: { mode: "single", vehicleId: victoris.id },
      ...category(key),
      title,
      amount,
      date: day(offset),
      paymentMethod: "UPI",
      ...extra,
    });
  await expense("INSURANCE_LEGAL.COMPREHENSIVE", "Comprehensive insurance renewal", "28450", -280, {
    vendor: "ICICI Lombard",
  });
  await expense("DAILY_USAGE.FASTAG", "FASTag recharge", "1000", -95);
  await expense("DAILY_USAGE.FASTAG", "FASTag recharge", "1500", -33);
  await expense("DAILY_USAGE.PARKING", "Cyber Hub parking", "120", -18);
  await expense("DAILY_USAGE.WASHING", "Foam wash", "450", -9);
  await expense("ACCESSORIES.DASHCAM", "Dashcam with rear camera", "6499", -200, {
    vendor: "Car accessories store",
  });
  await expense("INSURANCE_LEGAL.PUC", "PUC certificate", "150", -170);

  // ---- Loan, recurring payment and budget
  await call("POST", "/vehicle-loans", {
    vehicleId: victoris.id,
    lender: "HDFC Bank",
    principal: "800000",
    annualRate: "9",
    tenureMonths: 60,
    firstEmiDate: day(-260),
    paymentMethod: "NET_BANKING",
  });
  await call("POST", "/recurring-expenses", {
    vehicleId: victoris.id,
    title: "Society parking pass",
    amount: "1500",
    ...category("DAILY_USAGE.PARKING"),
    every: 1,
    unit: "MONTH",
    startDate: day(-120),
  });
  await call("POST", "/expense-budgets", { vehicleId: victoris.id, amount: "15000" });

  // ---- Documents (an expiring PUC raises a notification with a Renew action)
  const papers = [
    {
      type: "REGISTRATION",
      name: "Registration certificate",
      number: "HR26EV4821",
      expiryDate: day(15 * 365 - 290),
    },
    {
      type: "INSURANCE",
      name: "Comprehensive insurance",
      issuer: "ICICI Lombard",
      expiryDate: day(85),
    },
    { type: "PUC", name: "PUC certificate", number: "HR026-PUC-9921", expiryDate: day(12) },
  ];
  for (const paper of papers) {
    await call("POST", "/documents", { vehicleId: victoris.id, fileIds: [], ...paper });
  }

  // ---- Trips
  const trip = (body: object) =>
    call("POST", "/trips", { vehicleId: victoris.id, method: "ODOMETER", ...body });
  await trip({
    categoryId: tripType("ROAD_TRIP"),
    date: day(-140),
    endDate: day(-138),
    startKm: 5150,
    endKm: 5500,
    origin: "Gurugram",
    destination: "Jaipur",
    notes: "Weekend trip via NH-48",
  });
  await trip({
    categoryId: tripType("ROAD_TRIP"),
    date: day(-45),
    endDate: day(-43),
    startKm: 6850,
    endKm: 7140,
    origin: "Gurugram",
    destination: "Rishikesh",
  });
  await trip({
    categoryId: tripType("BUSINESS"),
    date: day(-7),
    startKm: 7770,
    endKm: 7812,
    origin: "Gurugram",
    destination: "Noida, Sector 62",
  });

  // ---- Reminders
  await call("POST", "/reminders", {
    title: "Renew FASTag KYC",
    dueDate: day(4),
    vehicleId: victoris.id,
    remindDaysBefore: 7,
  });
  await call("POST", "/reminders", {
    title: "Rotate tyres",
    dueDate: day(-1),
    vehicleId: victoris.id,
    notes: "Ask for a balancing check too",
  });

  console.log("\nDemo data is ready. Sign in at http://localhost:5173 with:");
  console.log(`  Email:    ${DEMO_ACCOUNT.email}`);
  console.log(`  Password: ${DEMO_ACCOUNT.password}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  console.error("\nIs the API running (pnpm dev:api) with migrations and the base seed applied?");
  process.exit(1);
});
