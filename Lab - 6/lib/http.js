/* ==========================================================================
   lib/http.js - shared fetch helper and error types for Lab 6
   --------------------------------------------------------------------------
   fetchJSON(url, options) asks the API for JSON and turns every way the
   request can fail into a clear error class:

     HttpError         the API answered, but with a non-2xx status (404, 500 ...)
     NetworkError      no answer at all (offline, DNS failure, refused)
     RequestTimeout    no answer within the time limit
     InvalidJSONError  the answer was not valid JSON
   ========================================================================== */

export const API_BASE_URL = "https://jsonplaceholder.typicode.com";
export const DEFAULT_TIMEOUT_MS = 5000;

export class HttpError extends Error {
  constructor(status, statusText, url) {
    super(`Request failed with HTTP ${status}${statusText ? " " + statusText : ""} (${url})`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

export class NetworkError extends Error {
  constructor(url, cause) {
    super(`Could not reach the API (${url}): ${cause?.cause?.code ?? cause?.message ?? "unknown network error"}`, { cause });
    this.name = "NetworkError";
    this.url = url;
  }
}

export class RequestTimeout extends Error {
  constructor(url, ms) {
    super(`The API did not answer within ${ms} ms (${url})`);
    this.name = "RequestTimeout";
    this.url = url;
  }
}

export class InvalidJSONError extends Error {
  constructor(url, cause) {
    super(`The API returned data that is not valid JSON (${url})`, { cause });
    this.name = "InvalidJSONError";
    this.url = url;
  }
}

/**
 * Fetches a URL and returns the parsed JSON body.
 * @param {string} url
 * @param {{ fetchFn?: Function, timeoutMs?: number }} options
 *   fetchFn lets tests or demos pass another fetch-compatible function;
 *   by default the built-in fetch of Node 18+ / browsers is used.
 */
export async function fetchJSON(url, { fetchFn = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof fetchFn !== "function") throw new TypeError("No fetch function is available (Node.js 18+ is required)");

  let response;
  try {
    response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new RequestTimeout(url, timeoutMs);
    throw new NetworkError(url, error);
  }

  if (!response.ok) throw new HttpError(response.status, response.statusText, url);

  try {
    return await response.json();
  } catch (error) {
    throw new InvalidJSONError(url, error);
  }
}
