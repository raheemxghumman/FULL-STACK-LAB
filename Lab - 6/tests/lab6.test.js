/* Lab 6 tests (node:test, built into Node.js).  npm test
   Run against the local mock API, so they are fast and do not need internet. */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { fetchUser, InvalidUserError } from "../Task-1-Async-Await/fetchUser.js";
import { getUserProfile, InvalidDetailsError, fetchUserDetails, fetchUserPosts } from "../Task-2-Promise-All/userProfile.js";
import { HttpError, NetworkError, RequestTimeout, InvalidJSONError } from "../lib/http.js";
import { validateUser, validatePosts } from "../lib/validate.js";
import { startMockApi, MOCK_DELAY_MS } from "../mock-api/server.js";

let server;
let baseUrl;
before(async () => ({ server, baseUrl } = await startMockApi()));
after(() => server.close());

describe("Task 1 - fetchUser (async/await)", () => {
  test("returns a clean, valid user object", async () => {
    const user = await fetchUser(1, { baseUrl });
    assert.deepEqual(user, {
      id: 1, name: "Ali Khan", username: "alikhan", email: "ali@university.edu",
      phone: "0300-1234567", website: "alikhan.dev", city: "Islamabad", company: "CampusFlow"
    });
  });

  test("rejects invalid ids before sending a request", async () => {
    for (const id of [0, -1, 1.5, "5", null, undefined]) {
      await assert.rejects(fetchUser(id, { baseUrl }), TypeError);
    }
  });

  test("404 -> HttpError with status", async () => {
    await assert.rejects(fetchUser(99, { baseUrl }), (e) => e instanceof HttpError && e.status === 404);
  });

  test("500 -> HttpError", async () => {
    await assert.rejects(fetchUser(52, { baseUrl }), (e) => e instanceof HttpError && e.status === 500);
  });

  test("invalid JSON -> InvalidJSONError", async () => {
    await assert.rejects(fetchUser(53, { baseUrl }), InvalidJSONError);
  });

  test("fetched but invalid data -> InvalidUserError listing the problems", async () => {
    await assert.rejects(fetchUser(50, { baseUrl }), (e) =>
      e instanceof InvalidUserError && e.problems.length === 2 && e.problems.some((p) => p.includes("email")));
  });

  test("slow API -> RequestTimeout", async () => {
    await assert.rejects(fetchUser(54, { baseUrl, timeoutMs: 400 }), RequestTimeout);
  });

  test("dropped connection / unreachable host -> NetworkError", async () => {
    await assert.rejects(fetchUser(55, { baseUrl }), NetworkError);
    await assert.rejects(fetchUser(1, { baseUrl: "http://127.0.0.1:1" }), NetworkError);
  });
});

describe("Task 2 - getUserProfile (Promise.all)", () => {
  test("accepts the main promise when both details are valid", async () => {
    const profile = await getUserProfile(1, { baseUrl });
    assert.equal(profile.user.name, "Ali Khan");
    assert.equal(profile.postCount, 3);
    assert.deepEqual(profile.posts[0], { id: 1, title: "Learning async/await" });
  });

  test("the two requests run concurrently", async () => {
    const start = Date.now();
    await getUserProfile(2, { baseUrl });
    assert.ok(Date.now() - start < MOCK_DELAY_MS * 2, "both requests should overlap");
  });

  test("rejects with InvalidDetailsError when the user details are invalid", async () => {
    await assert.rejects(getUserProfile(50, { baseUrl }), (e) =>
      e instanceof InvalidDetailsError && e.problems.user.length === 2 && e.problems.posts.length === 0);
  });

  test("rejects with InvalidDetailsError when a post is invalid", async () => {
    await assert.rejects(getUserProfile(51, { baseUrl }), (e) =>
      e instanceof InvalidDetailsError && e.problems.user.length === 0 && e.problems.posts.length === 2);
  });

  test("rejects when either request fails (Promise.all fails fast)", async () => {
    await assert.rejects(getUserProfile(52, { baseUrl }), HttpError);
    await assert.rejects(getUserProfile(99, { baseUrl }), (e) => e instanceof HttpError && e.status === 404);
    await assert.rejects(getUserProfile(55, { baseUrl }), NetworkError);
    await assert.rejects(getUserProfile(54, { baseUrl, timeoutMs: 400 }), RequestTimeout);
  });

  test("rejects an invalid id", async () => {
    await assert.rejects(getUserProfile("abc", { baseUrl }), TypeError);
  });

  test("a user with no posts is still valid", async () => {
    // id 1 exists; ask for posts of a user that has none through the raw fetchers
    assert.deepEqual(await fetchUserPosts(999, { baseUrl }), []);
    assert.equal((await fetchUserDetails(3, { baseUrl })).name, "Usman Raza");
  });
});

describe("validators", () => {
  test("validateUser", () => {
    assert.deepEqual(validateUser({ id: 1, name: "A", username: "a", email: "a@b.co" }, 1), []);
    assert.equal(validateUser({ id: 2, name: "A", username: "a", email: "a@b.co" }, 1).length, 1);
    assert.deepEqual(validateUser(null, 1), ["user is not an object"]);
  });
  test("validatePosts", () => {
    assert.deepEqual(validatePosts([], 1), []);
    assert.deepEqual(validatePosts({}, 1), ["posts is not an array"]);
    assert.equal(validatePosts([{ id: 1, userId: 2, title: "", body: "x" }], 1).length, 2);
  });
});
