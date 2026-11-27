import type { AuthSession, LoginValues, RegisterValues } from "@automate/shared";

import { request } from "@/lib/api-client";

/** Auth endpoints. The refresh cookie is set and cleared by the API; JavaScript never sees it. */
export const authService = {
  login: (values: LoginValues) =>
    request<AuthSession>({ method: "POST", url: "/auth/login", data: values }),
  register: (values: RegisterValues) =>
    request<AuthSession>({ method: "POST", url: "/auth/register", data: values }),
  logout: () => request<void>({ method: "POST", url: "/auth/logout" }),
};
