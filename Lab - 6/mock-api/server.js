/* ==========================================================================
   mock-api/server.js - a small local copy of the JSONPlaceholder API
   --------------------------------------------------------------------------
   Built with node:http only. The routes and data live in mock-api/data.js
   (shared with the browser simulator used by the UI).

   Every response waits ~150 ms so the concurrency of Promise.all is visible.
   Run on its own:  npm run mock-api   (http://localhost:4000)
   ========================================================================== */

import http from "node:http";
import { fileURLToPath } from "node:url";
import { resolveRoute, SLOW_DELAY_MS } from "./data.js";

export const MOCK_DELAY_MS = 150;

function handle(req, res) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  const url = new URL(req.url, "http://localhost");
  const route = resolveRoute(url.pathname, url.searchParams);

  if (route.networkFailure) return req.socket.destroy();      // the client sees "fetch failed"

  const reply = () => {
    res.writeHead(route.status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(route.body);
  };
  return route.slow ? setTimeout(reply, SLOW_DELAY_MS) : reply();
}

/**
 * Starts the mock API. port 0 picks any free port (used by the tests).
 * Resolves with { server, baseUrl }.
 */
export function startMockApi(port = 0) {
  const server = http.createServer((req, res) => setTimeout(() => handle(req, res), MOCK_DELAY_MS));
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

// `npm run mock-api` starts it on port 4000
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { baseUrl } = await startMockApi(Number(process.env.PORT) || 4000);
  console.log(`Mock API running at ${baseUrl}  (try ${baseUrl}/users/1)`);
}
