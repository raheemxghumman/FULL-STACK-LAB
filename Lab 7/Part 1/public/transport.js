/* ==========================================================================
   public/transport.js - how the test UI talks to the API
   --------------------------------------------------------------------------
   Two modes, same requests and same responses:

   server   real HTTP requests with fetch() to the Node server (npm start).
            Used automatically when the page is opened from that server,
            or after "Connect" in the mode menu.
   browser  the API code in ../lib/router.js runs inside this page. Used on
            GitHub Pages, where no Node server can run. Requests still go
            through router.handle() with a method, URL, headers and a JSON
            text body, and responses are copied through JSON like real ones.

   Every request is recorded for the network log panel.
   ========================================================================== */

import { createApi } from "../lib/router.js";

const listeners = new Set();
const log = [];
let seq = 0;
let mode = "browser";
let base = "";
let inPage = null;

export const getMode = () => ({ mode, base });
export const getLog = () => log;
export const onChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn());

async function probe(url) {
  const res = await fetch(url + "/health", { cache: "no-store", signal: AbortSignal.timeout(2500) });
  const body = await res.json();
  if (body.service !== "student-management-api") throw new Error("That server is not the Student Management API.");
  return body;
}

/** Picks the mode on page load. */
export async function init() {
  if (location.protocol.startsWith("http") && ["localhost", "127.0.0.1"].includes(location.hostname)) {
    try {
      await probe(location.origin);
      mode = "server";
      base = location.origin;
      notify();
      return;
    } catch { /* opened from some other local web server: fall back to the page */ }
  }
  useBrowser();
}

/** Switches to a Node server, e.g. http://localhost:3002. Throws if it cannot be reached. */
export async function connect(url) {
  const clean = url.trim().replace(/\/+$/, "");
  await probe(clean);
  mode = "server";
  base = clean;
  notify();
}

/** Runs the API inside the page. The data starts fresh, like a newly started server. */
export function useBrowser() {
  if (!inPage) inPage = createApi();
  mode = "browser";
  base = "";
  notify();
}

/**
 * Sends one request.
 * @param {string} method   GET, POST, PUT, PATCH, DELETE
 * @param {string} path     e.g. /api/students?program=BSCS
 * @param {*} body          object (sent as JSON) or a raw string
 * @param {object} options  contentType: override the Content-Type, source: label for the log
 * @returns {Promise<{status, ok, headers, body, ms}>}
 */
export async function request(method, path, body, { contentType, source = "ui" } = {}) {
  const raw = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
  const headers = raw === undefined ? {} : { "Content-Type": contentType || "application/json" };
  const started = performance.now();
  let result;

  try {
    if (mode === "server") {
      const res = await fetch(base + path, { method, headers, body: raw });
      const text = await res.text();
      const keep = ["location", "allow", "content-type"];
      result = {
        status: res.status,
        headers: Object.fromEntries([...res.headers].filter(([k]) => keep.includes(k))),
        body: text ? JSON.parse(text) : null
      };
    } else {
      // a short pause so loading states are visible, as with a real network
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
      const out = inPage.handle({ method, url: path, headers: { "content-type": headers["Content-Type"] || "" }, body: raw });
      result = {
        status: out.status,
        headers: Object.fromEntries(Object.entries({ "content-type": "application/json; charset=utf-8", ...out.headers }).map(([k, v]) => [k.toLowerCase(), v])),
        body: out.body === null || out.body === undefined ? null : JSON.parse(JSON.stringify(out.body))
      };
    }
  } catch (err) {
    result = { status: 0, headers: {}, body: { error: `Network error: ${err.message}. Is the server still running?` } };
  }

  result.ok = result.status >= 200 && result.status < 300;
  result.ms = Math.round(performance.now() - started);

  log.unshift({ id: ++seq, time: new Date(), method, path, status: result.status, ms: result.ms, request: raw, response: result.body, headers: result.headers, mode, source });
  if (log.length > 300) log.pop();
  notify();
  return result;
}

export function clearLog() {
  log.length = 0;
  notify();
}
