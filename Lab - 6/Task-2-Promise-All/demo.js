/* Task 2 demo:  npm run task2 */
import { getUserProfile, fetchUserDetails, fetchUserPosts } from "./userProfile.js";
import { API_BASE_URL } from "../lib/http.js";
import { startMockApi, MOCK_DELAY_MS } from "../mock-api/server.js";

// The main promise is consumed with .then / .catch, so it is clear when it is
// accepted (resolved) and when it is rejected.
function show(label, userId, options = {}) {
  return getUserProfile(userId, options)
    .then((profile) => {
      console.log(`✔ ACCEPTED  ${label}`);
      console.log(`  user: ${profile.user.name} <${profile.user.email}> from ${profile.user.city}`);
      console.log(`  posts: ${profile.postCount} (${profile.posts.slice(0, 2).map((p) => `"${p.title}"`).join(", ")}${profile.postCount > 2 ? ", ..." : ""})`);
      console.log(`  both requests together took ${profile.fetchedInMs} ms`);
    })
    .catch((error) => {
      console.log(`✘ REJECTED  ${label}\n  ${error.name}: ${error.message}`);
      if (error.problems) {
        console.log(`  user problems:  ${error.problems.user.length ? error.problems.user.join("; ") : "none"}`);
        console.log(`  posts problems: ${error.problems.posts.length ? error.problems.posts.join("; ") : "none"}`);
      }
    });
}

console.log(`=== Real API: ${API_BASE_URL} ===\n`);
await show("user 1: valid details + valid posts", 1);
await show("user 7: valid details + valid posts", 7);
await show("user 11: /users/11 is 404, so Promise.all rejects", 11);
await show("invalid id -1", -1);

const { server, baseUrl } = await startMockApi();
console.log(`\n=== Local mock API: ${baseUrl} (each response takes ${MOCK_DELAY_MS} ms) ===\n`);
try {
  await show("user 2: both valid", 2, { baseUrl });
  await show("user 50: details fetched but invalid (no name, bad email)", 50, { baseUrl });
  await show("user 51: details valid, but one of the posts is invalid", 51, { baseUrl });
  await show("user 52: the server fails (500)", 52, { baseUrl });
  await show("user 54: slower than a 1 s timeout", 54, { baseUrl, timeoutMs: 1000 });
  await show("user 55: connection dropped", 55, { baseUrl });

  console.log("\n=== Why Promise.all: the two requests run at the same time ===");
  let start = Date.now();
  await Promise.all([fetchUserDetails(1, { baseUrl }), fetchUserPosts(1, { baseUrl })]);
  const together = Date.now() - start;
  start = Date.now();
  await fetchUserDetails(1, { baseUrl });
  await fetchUserPosts(1, { baseUrl });
  const oneAfterAnother = Date.now() - start;
  console.log(`Promise.all: ${together} ms   |   one after another: ${oneAfterAnother} ms`);
} finally {
  server.close();
}
