import { randomBytes } from "node:crypto";

import { type APIRequestContext, expect, type Page } from "@playwright/test";

/** The API the web app talks to (the dev API locally, the started one in CI). */
export const API = process.env.E2E_API_URL ?? "http://localhost:3000/api/v1";
const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:5173";

export type Account = {
  name: string;
  email: string;
  password: string;
  call: <T>(method: string, url: string, body?: object) => Promise<T>;
};

/**
 * A fresh account made through the API, with a caller for setting up its data quickly. Pass a
 * page's `request` (or a context's): registering stores the session cookie in that browser, so
 * it opens the app signed in without another credentials call. The API allows 10 of those a
 * minute per address; a 429 waits and tries again.
 */
export async function signUp(request: APIRequestContext, name: string): Promise<Account> {
  const id = randomBytes(5).toString("hex");
  const email = `e2e-${id}@automate.test`;
  const password = `Drive${id}9`;
  let res = await register(request, { name, email, password, acceptedTerms: true });
  for (let attempt = 0; res.status() === 429 && attempt < 6; attempt++) {
    // Wait as long as the API asks (its window is a minute), then try again.
    const headers = res.headers();
    const wait = Number(headers["retry-after"] ?? headers["x-ratelimit-reset"] ?? 10);
    await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(wait, 1), 60) * 1000));
    res = await register(request, { name, email, password, acceptedTerms: true });
  }
  expect(res.ok(), await res.text()).toBe(true);
  const body = (await res.json()) as {
    data: { accessToken?: string; session?: { accessToken: string } };
  };
  const token = body.data.accessToken ?? body.data.session!.accessToken;
  const call = async <T>(method: string, url: string, data?: object) => {
    const reply = await request.fetch(`${API}${url}`, {
      method,
      headers: { origin: ORIGIN, authorization: `Bearer ${token}` },
      data,
    });
    expect(reply.ok(), `${method} ${url}: ${await reply.text()}`).toBe(true);
    return reply.status() === 204 ? (undefined as T) : ((await reply.json()) as { data: T }).data;
  };
  return { name, email, password, call };
}

const register = (request: APIRequestContext, data: object) =>
  request.post(`${API}/auth/register`, { headers: { origin: ORIGIN }, data });

/** A Victoris with a unique plate (and one full-tank fill-up) in the account. */
export async function addVehicle(account: Account) {
  const plate = `HR26EV${Math.floor(1000 + Math.random() * 8999)}`;
  const vehicle = await account.call<{ id: string; registrationNumber: string }>(
    "POST",
    "/vehicles",
    {
      make: "Maruti Suzuki",
      model: "Victoris",
      variant: "LXI",
      manufacturingYear: 2025,
      category: "SUV",
      registrationNumber: plate,
      fuelType: "PETROL",
      transmission: "MANUAL",
      ownershipType: "OWNED",
      odometerKm: 8000,
    },
  );
  await account.call("POST", `/vehicles/${vehicle.id}/fuel-entries`, {
    filledAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    odometerKm: 8300,
    fuelType: "PETROL",
    quantity: "30",
    pricePerUnit: "104.32",
    totalAmount: "3129.60",
    isFullTank: true,
  });
  return vehicle;
}

/** The first match a person can see (phones hide the sidebar's copy, for example). */
export const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();
