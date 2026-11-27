import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { queryClient } from "@/lib/query-client";
import { fail, mockApi } from "@/test/mock-api";

// Routes are lazy chunks transformed on first import; in the parallel full run, a file's first
// render can take over the 1 s default to appear. Waiting longer only matters when it's slow.
configure({ asyncUtilTimeout: 3000 });

// No test talks to a real server: unmocked requests get a 404 (never a 401, which would sign out).
beforeEach(() => {
  mockApi(fail(404, "NOT_FOUND", "Not mocked in this test"));
});

// The app's QueryClient is a singleton: drop cached API data so tests can't leak into each other.
afterEach(() => {
  cleanup();
  queryClient.clear();
});

// jsdom has no matchMedia; the sidebar and theme provider need it. Reports desktop, light mode.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom has no ResizeObserver; Radix (checkbox, popover) measures elements with it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom gaps used by Radix Select and by page scrolling.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
window.scrollTo = vi.fn() as typeof window.scrollTo;
