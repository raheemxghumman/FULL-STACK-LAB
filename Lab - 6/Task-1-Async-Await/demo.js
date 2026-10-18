/* Task 1 demo:  npm run task1
   Part 1 uses the real JSONPlaceholder API; part 2 uses the local mock API
   for the failures the real API cannot produce. */
import { fetchUser } from "./fetchUser.js";
import { API_BASE_URL } from "../lib/http.js";
import { startMockApi } from "../mock-api/server.js";

// Shows what fetchUser gives back: the user object, or the error it returned.
async function tryFetch(label, userId, options = {}) {
  try {
    const user = await fetchUser(userId, options);
    console.log(`✔ ${label}\n  ->`, user);
  } catch (error) {
    console.log(`✘ ${label}\n  -> ${error.name}: ${error.message}`);
  }
}

console.log(`=== Real API: ${API_BASE_URL} ===\n`);
await tryFetch("user 1 (valid)", 1);
await tryFetch("user 10 (last valid id)", 10);
await tryFetch("user 11 (does not exist -> 404)", 11);
await tryFetch("id 0 (invalid id, rejected before any request)", 0);
await tryFetch('id "5" (a string is not a valid id)', "5");
await tryFetch("unreachable host (network failure)", 1, { baseUrl: "http://127.0.0.1:1" });

const { server, baseUrl } = await startMockApi();
console.log(`\n=== Local mock API: ${baseUrl} ===\n`);
try {
  await tryFetch("user 2 (valid)", 2, { baseUrl });
  await tryFetch("user 50 (fetched, but no name and a bad email)", 50, { baseUrl });
  await tryFetch("user 52 (server error 500)", 52, { baseUrl });
  await tryFetch("user 53 (response is not JSON)", 53, { baseUrl });
  await tryFetch("user 54 (slower than the 1 s limit)", 54, { baseUrl, timeoutMs: 1000 });
  await tryFetch("user 55 (connection dropped)", 55, { baseUrl });
} finally {
  server.close();
}
