/* ==========================================================================
   ui/mockFetch.js - a fetch() look-alike that runs entirely in the browser.
   GitHub Pages cannot run the Node mock server, so the UI uses this instead
   when "Simulated API" is selected. It returns real Response objects and
   supports AbortSignal, so the lab code cannot tell it from a real fetch.
   ========================================================================== */

import { resolveRoute, SLOW_DELAY_MS, STATUS_TEXT } from "../mock-api/data.js";

export const MOCK_BASE_URL = "https://simulated-api.lab6";

// Different speeds for the two endpoints make the Promise.all race visible
const BASE_DELAY = { users: 650, posts: 1050 };

function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

export function mockFetch(input, { signal } = {}) {
  const url = new URL(String(input));
  const route = resolveRoute(url.pathname, url.searchParams);
  const kind = url.pathname.endsWith("/posts") ? "posts" : "users";
  const delay = route.slow ? SLOW_DELAY_MS : BASE_DELAY[kind] + Math.round(Math.random() * 250);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      if (route.networkFailure) return reject(new TypeError("Failed to fetch"));
      resolve(new Response(route.body, {
        status: route.status,
        statusText: STATUS_TEXT[route.status] ?? "",
        headers: { "Content-Type": "application/json" }
      }));
    }, delay);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError(signal));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
