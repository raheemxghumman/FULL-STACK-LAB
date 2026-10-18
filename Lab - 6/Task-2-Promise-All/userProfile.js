/* ==========================================================================
   Task 2 - Promise.all over two asynchronous operations
   --------------------------------------------------------------------------
   "Use Promise.all to catch multiple promises returned by two asynchronous
    operations and then reject or accept the main promise (promise of
    Promise.all) based on if the details fetched by both the async functions
    are valid or not."

   Two independent async functions:
     fetchUserDetails(userId)   GET /users/:id
     fetchUserPosts(userId)     GET /posts?userId=:id

   getUserProfile(userId) starts BOTH at the same time and waits for them with
   Promise.all. Then it decides the main promise:
     resolve -> both requests succeeded AND both sets of details are valid
     reject  -> either request failed (Promise.all rejects on the first failure)
                or at least one set of details is invalid (InvalidDetailsError
                lists every problem from both)
   ========================================================================== */

import { API_BASE_URL, fetchJSON } from "../lib/http.js";
import { validateUser, validatePosts, toUserObject, isValidUserId } from "../lib/validate.js";

export class InvalidDetailsError extends Error {
  constructor(userId, problems) {
    super(`Details for user ${userId} are not valid: ${[...problems.user, ...problems.posts].join("; ")}`);
    this.name = "InvalidDetailsError";
    this.problems = problems;          // { user: [...], posts: [...] }
  }
}

/* ---------- the two asynchronous operations ---------- */

/** Async operation 1: the user's details (raw API data, validated later). */
export async function fetchUserDetails(userId, { baseUrl = API_BASE_URL, ...requestOptions } = {}) {
  return fetchJSON(`${baseUrl}/users/${userId}`, requestOptions);
}

/** Async operation 2: the user's posts (raw API data, validated later). */
export async function fetchUserPosts(userId, { baseUrl = API_BASE_URL, ...requestOptions } = {}) {
  return fetchJSON(`${baseUrl}/posts?userId=${userId}`, requestOptions);
}

/* ---------- the main promise ---------- */

/**
 * Resolves with { user, posts, postCount, fetchedInMs } when both operations
 * succeed with valid details; rejects with the reason otherwise.
 * @param {number} userId
 * @param {{ baseUrl?: string, fetchFn?: Function, timeoutMs?: number }} options
 * @returns {Promise<object>}
 */
export function getUserProfile(userId, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isValidUserId(userId)) {
      reject(new TypeError(`User id must be a positive whole number (got ${JSON.stringify(userId)})`));
      return;
    }

    const startedAt = Date.now();

    // Both requests start here, at the same time; Promise.all waits for both.
    Promise.all([fetchUserDetails(userId, options), fetchUserPosts(userId, options)])
      .then(([userData, postsData]) => {
        const problems = {
          user: validateUser(userData, userId),
          posts: validatePosts(postsData, userId)
        };

        if (problems.user.length > 0 || problems.posts.length > 0) {
          reject(new InvalidDetailsError(userId, problems));       // fetched, but not valid -> reject
          return;
        }

        resolve({                                                    // both valid -> accept
          user: toUserObject(userData),
          posts: postsData.map(({ id, title }) => ({ id, title })),
          postCount: postsData.length,
          fetchedInMs: Date.now() - startedAt
        });
      })
      .catch(reject);   // a failed request (404, network, timeout, bad JSON) rejects the main promise
  });
}
