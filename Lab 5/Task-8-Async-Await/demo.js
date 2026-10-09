/* Task 8 demo: run with  npm run task8 */
import {
  getJSON, fakeFetch, loadDashboard, loadDashboardSequentially, fetchWithTimeout, classifyError, FAKE_LATENCY_MS
} from "./api.js";

async function timed(fn) {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

async function main() {
  console.log("=== Concurrent dashboard (Promise.all) ===");
  const concurrent = await timed(() => loadDashboard(fakeFetch));
  console.log(concurrent.value);
  const sequential = await timed(() => loadDashboardSequentially(fakeFetch));
  console.log(`\nEach request takes ~${FAKE_LATENCY_MS} ms.`);
  console.log(`Concurrent: ${concurrent.ms} ms   |   Sequential awaits: ${sequential.ms} ms`);

  console.log("\n=== getJSON against every simulated response ===");
  for (const url of ["/courses", "/missing", "/server-error", "/network-down", "/bad-json"]) {
    try {
      const data = await getJSON(url, fakeFetch);
      console.log(`${url.padEnd(14)} 200 OK -> ${Array.isArray(data) ? data.length + " items" : JSON.stringify(data)}`);
    } catch (error) {
      console.log(`${url.padEnd(14)} ${classifyError(error).padEnd(12)} ${error.name}: ${error.message}`);
    }
  }

  console.log("\n=== Dashboard when one service fails ===");
  try {
    await loadDashboard(fakeFetch, { users: "/users", courses: "/server-error", results: "/results" });
  } catch (error) {
    console.log(`Dashboard could not load -> ${classifyError(error)}: ${error.message}`);
  } finally {
    console.log("(finally: the loading spinner would be hidden here)");
  }

  console.log("\n=== fetchWithTimeout ===");
  const timeoutCases = [
    ["/courses", 1000, "fast enough"],
    ["/slow", 500, "too slow -> aborted"],
    ["/slow", 200, "boundary: equal to normal latency"],
    ["/missing", 1000, "HTTP error is not a timeout"],
    ["/network-down", 1000, "network error is not a timeout"]
  ];
  for (const [url, ms, note] of timeoutCases) {
    const start = Date.now();
    try {
      const data = await fetchWithTimeout(url, ms);
      console.log(`${url.padEnd(14)} limit ${String(ms).padEnd(5)} OK in ${Date.now() - start} ms (${note}) -> ${Array.isArray(data) ? data.length + " items" : JSON.stringify(data)}`);
    } catch (error) {
      console.log(`${url.padEnd(14)} limit ${String(ms).padEnd(5)} ${classifyError(error)} after ${Date.now() - start} ms (${note})`);
    }
  }

  console.log("\n=== Invalid arguments ===");
  for (const [label, run] of [["no fetch function", () => getJSON("/users", null)], ["negative timeout", () => fetchWithTimeout("/users", -5)]]) {
    try {
      await run();
    } catch (error) {
      console.log(`${label} -> ${error.name}: ${error.message}`);
    }
  }

  console.log("\nAll timers were cleared in finally, so the program exits right away (no 3-second wait for /slow).");
}

main().catch((error) => {
  console.error("Unexpected failure:", error);
  process.exitCode = 1;
});
