# Frontend architecture (`apps/web`)

Phase 0 foundation. Covers how the frontend is organised and the conventions every module follows. Product scope is in [MODULES.md](../MODULES.md); stack choices are in [TECH_STACK.md](../TECH_STACK.md).

## 1. Principles

- **Feature-oriented.** Everything a module needs lives in `src/features/<id>/`. Shared code moves up into `components/`, `hooks/`, `lib/` or `utils/` only when a second module needs it.
- **Server data lives in TanStack Query; client state lives in Zustand.** API responses never go into Zustand.
- **Components never call the API.** They call feature hooks, which call feature services, which call `request()`.
- **The backend owns financial truth.** The UI formats numbers; it never calculates mileage, costs or due dates.
- **Use the library.** shadcn/ui for primitives, TanStack Table for tables, react-hook-form + zod for forms, sonner for toasts, date-fns and `Intl` for formatting. Write a thin app-specific wrapper when needed, never a replacement.

## 2. Folder structure

```
apps/web/src/
├── main.tsx                    # entry: CSS, env validation, <App/>
├── app/
│   ├── App.tsx                 # global error boundary → providers → router
│   ├── modules.ts              # module registry: drives routes AND sidebar
│   ├── providers/app-providers.tsx
│   └── router/
│       ├── routes.tsx          # the route tree
│       ├── guards.tsx          # SessionGate, RequireAuth, RequireGuest
│       └── route-handle.ts     # `handle` type (title → breadcrumbs + <title>)
├── components/
│   ├── ui/                     # shadcn/ui primitives (generated, owned by us)
│   ├── common/                 # PageContainer, PageHeader, SectionHeader, Breadcrumbs,
│   │                           # SearchInput, StatCard, DataTable, ConfirmDialog,
│   │                           # FormField, FormError, DatePicker, ModulePlaceholder
│   ├── feedback/               # EmptyState, ErrorState, LoadingState, LoadingSkeleton,
│   │                           # RouteError/NotFoundState, AppErrorFallback
│   └── layout/                 # AppShell, AppSidebar, AppHeader, ThemeToggle, UserMenu
├── features/
│   ├── auth/                   # sign-in + registration (login-route, register-route,
│   │                           #   components/, hooks/, services/)
│   └── <module>/route.tsx      # 12 module entries (placeholders in Phase 0)
├── hooks/                      # use-mobile, use-breadcrumbs
├── lib/
│   ├── env.ts                  # zod-validated import.meta.env
│   ├── api-client.ts           # axios instance + interceptors + request<T>()
│   ├── api-error.ts            # ApiError + normalizeApiError + isRetryableError
│   ├── query-client.ts         # QueryClient defaults + global error toasts
│   ├── forms.ts                # applyServerErrors (API errors → form errors)
│   └── utils.ts                # shadcn CLI alias for `cn`
├── stores/                     # session-store (in memory), vehicle-store (persisted id)
├── styles/index.css            # Tailwind v4 entry + design tokens
├── test/setup.ts
└── utils/format.ts             # Indian formatters
```

A built module's folder grows like this. Create subfolders only when there's something to put in them:

```
features/fuel/
├── route.tsx          # export function Component() — the page entry (lazy-loaded)
├── components/        # FuelEntryForm, FuelHistoryTable…
├── hooks/             # useFuelEntries, useCreateFuelEntry (TanStack Query)
├── services/          # fuel-service.ts: request() calls only
├── schemas/           # form schemas (import shared zod schemas once they exist)
└── types/             # UI-only types; API types come from @automate/shared
```

**Naming:** files use kebab-case (`stat-card.tsx`, matching shadcn); components use PascalCase; hooks are `useX`; tests sit next to their file as `*.test.ts(x)`. Imports use the `@/` alias for `src/`.

## 3. Dependency responsibilities

| Concern            | Package                                                                                 | Where it's wired                                       |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Routing            | react-router 8 (data router)                                                            | `app/router/routes.tsx`                                |
| Server state       | @tanstack/react-query 5                                                                 | `lib/query-client.ts`                                  |
| Client state       | zustand 5                                                                               | `stores/`                                              |
| HTTP               | axios                                                                                   | `lib/api-client.ts`                                    |
| API contract types | @automate/shared (workspace)                                                            | `lib/api-client.ts`, `lib/api-error.ts`                |
| Forms              | react-hook-form + @hookform/resolvers + zod 4                                           | `components/common/form-field.tsx`, `lib/forms.ts`     |
| UI primitives      | shadcn/ui (radix-ui, `cn`, class-variance-authority)                                    | `components/ui/`                                       |
| Icons              | lucide-react                                                                            | everywhere                                             |
| Theme              | next-themes                                                                             | `app/providers/app-providers.tsx`, `index.html`        |
| Toasts             | sonner                                                                                  | `components/ui/sonner.tsx`                             |
| Tables             | @tanstack/react-table 8                                                                 | `components/common/data-table.tsx`                     |
| Dates              | date-fns 4, react-day-picker (via shadcn calendar)                                      | `utils/format.ts`, `components/common/date-picker.tsx` |
| Error boundaries   | react-error-boundary + router `errorElement`                                            | `app/App.tsx`, `app/router/routes.tsx`                 |
| Fonts              | @fontsource-variable/manrope, inter, geist-mono (self-hosted, Stitch)                   | `styles/index.css`                                     |
| Tests              | vitest, @testing-library/react, user-event, jest-dom, jsdom                             | `vite.config.ts`, `test/setup.ts`                      |
| Lint/format        | eslint 10 (typescript-eslint, react-hooks, react-refresh, simple-import-sort), prettier | `eslint.config.js`, root `.prettierrc`                 |

**Approved but not installed yet.** Install each one with the module that first needs it, and import it only from that module's lazy route so it stays out of the startup bundle:

| Package                   | Install with            |
| ------------------------- | ----------------------- |
| recharts                  | Dashboard / Analytics   |
| react-dropzone, react-pdf | Documents               |
| @dnd-kit/*                | Dashboard customisation |
| papaparse                 | Backup & Export         |

**Deviations from TECH_STACK.md:**

- `clsx` + `tailwind-merge` are replaced by `cn`, shadcn's own drop-in that their generated components import.
- **Manrope + Inter + Geist Mono** are the fonts, from the Stitch design (replacing shadcn Nova's Geist).
- **TypeScript 6.0**, not 7: typescript-eslint supports TypeScript below 6.1 only.
- **TanStack Table 8**, not 9: shadcn's data-table pattern targets v8.

**Version policy:** `minimumReleaseAge: 10080` in `pnpm-workspace.yaml` stops pnpm installing anything published less than 7 days ago.

## 4. Routing

- **One registry.** `app/modules.ts` lists every module: id, title, path, icon, nav group and lazy entry, plus optional `children` (sub-pages inside the shell, e.g. `:vehicleId`) and `taskRoutes` (full-page flows outside the shell, e.g. `/garage/new`). `routes.tsx` maps it to routes, and `AppSidebar` maps it to navigation. Nothing else hardcodes module paths.
- **Route tree:**
  ```
  SessionGate                        (root: restores the session once; errorElement, hydrateFallback)
  ├── RequireGuest                   (signed-in users are sent on to state.from or /dashboard)
  │   ├── /login                     → features/auth/login-route.tsx
  │   └── /register                  → features/auth/register-route.tsx
  └── RequireAuth                    (signed-out users go to /login with state.from)
      ├── <module taskRoutes>        (full-page flows, e.g. /garage/new, /garage/:id/edit → TaskPage)
      └── AppShell                   (sidebar + header)
          └── (errorElement: page errors render inside the shell)
              ├── /             → redirect /dashboard
              ├── /<module>     → the module's index page (lazy, own chunk) + its `children`
              └── *             → NotFoundState
  ```
- **Lazy routes.** Each `features/<id>/route.tsx` exports `Component` (React Router's lazy-route convention); later it can also export `loader`, `ErrorBoundary`, etc. Each module ships as its own JS chunk.
- **Titles and breadcrumbs.** Give a route `handle: { title } satisfies RouteHandle`. The header builds breadcrumbs from every matched handle and sets `document.title` to `"<title> · AutoMate"`. Nested pages (e.g. `/garage/:vehicleId`) just add a handle.
- **Guards** (`app/router/guards.tsx`):
  - `SessionGate` shows a full-screen loader until the start-up refresh has decided whether the visitor is signed in.
  - `RequireAuth` sends signed-out visitors to `/login`, remembering the requested URL in `state.from`.
  - `RequireGuest` moves a signed-in user off the auth pages, to `state.from` or `/dashboard`. That's how a successful sign-in navigates: the form only stores the session.

## 4a. Authentication

Email and password only (no Google or OTP). The API side is described in [backend.md §6](backend.md#6-authentication) and [security.md](security.md).

| Piece                         | Where                                                              | What it does                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token                  | `stores/session-store.ts` (memory only)                            | 15-minute JWT, sent as `Authorization: Bearer` by the request interceptor                                                                                                                                                                                                                     |
| Refresh token                 | httpOnly cookie `automate_rt`, path `/api/v1/auth`                 | JavaScript never sees it; `apiClient` sends it because of `withCredentials: true`                                                                                                                                                                                                             |
| Session restore               | `refreshSession()` in `lib/api-client.ts`, called by `SessionGate` | One `POST /auth/refresh` per page load; success stores the user and token, failure marks the visitor signed out                                                                                                                                                                               |
| Expired access token          | Response interceptor                                               | On a 401 from a non-auth route: refresh once, then replay the request. Concurrent 401s in a tab share one refresh; other tabs wait their turn on a Web Lock (`automate:auth-refresh`), because the server rotates the cookie and parallel refreshes from several tabs would sign the user out |
| Sign in / register / sign out | `features/auth/hooks/use-auth.ts` → `services/auth-service.ts`     | Sign-in and registration store the session and clear the query cache; sign-out calls `/auth/logout`, then clears the session and cache, even if the request fails                                                                                                                             |
| Forms                         | `login-route.tsx`, `register-route.tsx`                            | Shared zod schemas (`loginSchema`, `registerSchema` from `@automate/shared`); API errors are mapped onto the form by `applyServerErrors`                                                                                                                                                      |

The session store has a `status` of `unknown`, `authenticated` or `anonymous`. Never treat `unknown` as signed out; wait for the gate.

## 5. State management

| State                                | Home                      | Notes                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anything from the API                | TanStack Query            | Query keys per feature, e.g. `["fuel", vehicleId, filters]`                                                                                                                                                                  |
| Session (status, user, access token) | `stores/session-store.ts` | Memory only; restored from the refresh cookie on load; cleared when a refresh fails and on sign-out                                                                                                                          |
| Active vehicle id                    | `stores/vehicle-store.ts` | Persisted per device (`automate.active-vehicle`). Read it through `useActiveVehicle()` (`hooks/`), which falls back to the first vehicle if the stored one is gone or archived; the vehicle record itself comes from a query |
| Theme                                | next-themes               | localStorage `automate.theme`, applied pre-paint by `index.html`                                                                                                                                                             |
| Sidebar open/collapsed               | shadcn `SidebarProvider`  | Cookie `sidebar_state`, restored by `AppShell`                                                                                                                                                                               |
| Form state                           | react-hook-form           | Per form                                                                                                                                                                                                                     |
| Local UI state                       | `useState`                | Dialogs, tabs, etc.                                                                                                                                                                                                          |

React Context is used only by libraries (theme, query client, sidebar, tooltip). Don't add app contexts for global state; use a Zustand store.

**QueryClient defaults** (`lib/query-client.ts`):

- `staleTime` 60 s and `gcTime` 5 min.
- Retry up to 2× only for network, timeout, 429 and 5xx errors; never for other 4xx.
- Refetch on window focus and reconnect.
- Mutations never retry.
- Errors:
  - A failed first load renders an in-page `<ErrorState>`.
  - A failed background refetch while data is shown raises a toast.
  - A failed mutation raises a toast, unless the mutation has its own `onError` (forms do).
- `Register.defaultError = ApiError`, so `error` is typed everywhere.

## 6. API integration

The contract is in `@automate/shared` (see `docs/architecture/api-conventions.md`, owned by the API):

- Success: `{ success: true, message, data, meta }`.
- Error: `{ success: false, message, error: { code, details, requestId } }`.

**Layers:**

```
component → feature hook (useQuery/useMutation) → feature service → request<T>() → apiClient (axios)
```

- `apiClient` holds the base URL from env, a 15 s timeout and `withCredentials: true` (for the refresh cookie).
  - **Request interceptor:** adds `Authorization: Bearer <token>`.
  - **Response interceptor:** converts every failure to `ApiError`. On a 401 from a non-auth route it refreshes once and replays the request (§4a).
- `request<T>(config)` returns the envelope's `data`. For a 204 response use `T = void`. When you need `meta` (pagination) or a raw file download, use `apiClient` directly.
- `ApiError` has:
  - `message`: always safe to show. 5xx and unparseable responses get a generic message.
  - `status`: null when there was no response.
  - `code`: an `ErrorCode`; branch on this, never on `message`.
  - `fieldErrors`: filled from `error.details` whenever they're field errors (`VALIDATION_ERROR`, or e.g. a 409 on `email`).
  - `requestId`: for support and logs.

**Pattern** (for when modules are built; no endpoints exist yet):

```ts
// features/garage/services/vehicle-service.ts
import { request } from "@/lib/api-client";
import type { Vehicle } from "@automate/shared"; // once the API exports it

export const vehicleService = {
  list: () => request<Vehicle[]>({ url: "/vehicles" }),
  create: (input: CreateVehicleInput) =>
    request<Vehicle>({ method: "POST", url: "/vehicles", data: input }),
};

// features/garage/hooks/use-vehicles.ts
export const vehicleKeys = { all: ["vehicles"] as const };

export function useVehicles() {
  return useQuery({ queryKey: vehicleKeys.all, queryFn: vehicleService.list });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: vehicleService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
  });
}
```

```tsx
// in a page
const { data, isPending, error, refetch } = useVehicles();
if (isPending) return <LoadingSkeleton />;
if (error) return <ErrorState error={error} onRetry={refetch} />;
if (!data.length) return <EmptyState icon={Car} title="No vehicles yet" action={...} />;
```

## 7. Forms

1. Write a zod schema. Import it from `@automate/shared` when the API exports one; keep form-only schemas in `features/<id>/schemas/`.
2. Set up `useForm({ resolver: zodResolver(schema), defaultValues })`.
3. Render each field with `<FormField control name label render={(field) => <Input {...field} />} />`. It wires up the label, `aria-invalid`, the description and the error message.
4. Submit with `mutateAsync` and catch with `applyServerErrors(form.setError, error)`:
   - each API field error goes onto its field;
   - the overall message goes to `errors.root.server`, rendered by `<FormError>`.
5. Disable the submit button while `form.formState.isSubmitting` is true.

`components/common/form-field.test.tsx` is the working reference for this pattern.

## 8. Formatting (Indian locale)

`utils/format.ts` is the only place that formats values for display. It uses the `en-IN` locale and INR.

| Function           | Example               |
| ------------------ | --------------------- |
| `formatCurrency`   | `₹1,25,000.00`        |
| `formatNumber`     | `12,50,000`           |
| `formatDistance`   | `12,500 km`           |
| `formatVolume`     | `35.42 L`             |
| `formatEfficiency` | `15.5 km/L`           |
| `formatDate`       | `27/11/2026`          |
| `formatDateTime`   | `27/11/2026, 9:30 AM` |

- All of them accept numbers or **decimal strings**. `Intl` formats strings exactly, so money from the API never passes through floating point.
- Missing or invalid input renders `—` instead of throwing.
- Dates are shown in the browser's timezone.

## 9. Errors and feedback

| Layer                                     | Handles                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `AppErrorFallback` (react-error-boundary) | Crashes outside the router: full-screen message plus reload                                   |
| Root `errorElement`                       | Errors outside the shell (login)                                                              |
| Shell `errorElement`                      | Page render errors and failed lazy chunks, shown inside the shell so navigation keeps working |
| `ErrorState`                              | Failed queries in a page, with a retry button                                                 |
| Toasts (sonner)                           | Mutation failures, background refetch failures, success confirmations                         |

Users only ever see `ApiError.message` or fixed copy; stack traces and raw server text are never shown. Errors are logged with `console.error` until Sentry is added.

## 10. Adding a feature module

1. Add an entry to `appModules` in `src/app/modules.ts` with id, title, description, path, icon, `navGroup` and `lazy: () => import("@/features/<id>/<id>-route")`.
2. Create that route file exporting `Component`. Sub-pages go in `children`, add/edit flows in `taskRoutes`, each with its own lazy route file (see `features/garage`).

The route, sidebar link, breadcrumb and page title follow from the registry. To build out one of the existing 12, replace its `route.tsx` body with the real page, and delete `ModulePlaceholder` once all 12 are built.

## 11. Testing

Vitest with jsdom (`pnpm test`). The setup file adds jest-dom matchers and stubs `matchMedia`, `ResizeObserver` and the pointer-capture/scroll APIs Radix Select needs. Before each test every request gets a 404 ("not mocked"; never a 401, which would sign out); after each test it unmounts and clears the shared QueryClient cache, so tests can't leak data into each other. Helpers:

- `test/mock-api.ts`: `mockApi()` swaps axios's network layer, so the real interceptors run against canned replies (one reply, or a function per URL). It also has `ok()`/`fail()` envelope builders, a `testUser` and `testVehicle()`.
- `test/render-app.tsx`: `renderApp(path)` renders the real providers and route tree in a memory router.

Current coverage:

- Indian formatters.
- Env validation.
- API client: envelope unwrapping, auth header and cookies, field errors, 5xx/offline/timeout handling, refresh-and-replay on 401, a single shared refresh, signing out when the refresh fails.
- The form pattern.
- App shell: session restore on load (valid and invalid cookie), all 12 nav links, redirect from `/`, not-found page, signed-in users kept off `/login`.
- Auth pages: sign-in (normalised email, remember-me, return to the requested page), wrong credentials, password reveal, registration validation, duplicate email on its field, successful registration.
- Garage: empty state, cards/filters/active switch, the full wizard (per-step validation, lakh-grouped input, normalised payload, new vehicle becomes active), a registration conflict jumping back to step 1, details + Specifications tab, delete-by-typing-the-plate, edit with the odometer warning. Plate formatting has unit tests; the refresh lock has one too.

Every calculation or formatting rule added later gets a test next to it.

## 12. Bundle budget

The startup chunk holds the core libraries (react-dom, router, query, axios, radix) at about 200 kB gzipped. `vite.config.ts` sets `chunkSizeWarningLimit: 700` (kB, minified) so growth is flagged. Feature-only libraries must be imported from lazy feature routes.

`env.ts` uses `zod/mini` for the same reason: full zod loads with the first form, not at startup.
