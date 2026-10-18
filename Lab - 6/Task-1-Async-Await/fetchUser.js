/* ==========================================================================
   Task 1 - async/await function that returns a valid user object
   --------------------------------------------------------------------------
   "Implement an async await function that returns a valid user object on
    successful fetching from an api and returns an error on unsuccessful
    fetching."

   fetchUser(userId)
     success -> resolves with a clean, validated user object
     failure -> rejects with an Error that says what went wrong:
                TypeError         the id itself is invalid (checked before any request)
                HttpError         e.g. 404 when the user does not exist
                NetworkError      the API could not be reached
                RequestTimeout    the API was too slow
                InvalidJSONError  the API sent something that is not JSON
                InvalidUserError  the API answered, but the user data is not valid

   An async function always returns a Promise, so "returning an error" means
   the returned Promise is rejected with that Error. The caller receives it
   with try/catch around `await fetchUser(...)`.
   ========================================================================== */

import { API_BASE_URL, fetchJSON } from "../lib/http.js";
import { validateUser, toUserObject, isValidUserId } from "../lib/validate.js";

export class InvalidUserError extends Error {
  constructor(userId, problems) {
    super(`User ${userId} was fetched but is not valid: ${problems.join("; ")}`);
    this.name = "InvalidUserError";
    this.problems = problems;
  }
}

/**
 * @param {number} userId
 * @param {{ baseUrl?: string, fetchFn?: Function, timeoutMs?: number }} options
 * @returns {Promise<object>} the valid user object
 */
export async function fetchUser(userId, { baseUrl = API_BASE_URL, ...requestOptions } = {}) {
  if (!isValidUserId(userId)) {
    throw new TypeError(`User id must be a positive whole number (got ${JSON.stringify(userId)})`);
  }

  const data = await fetchJSON(`${baseUrl}/users/${userId}`, requestOptions);   // network / HTTP / JSON errors propagate

  const problems = validateUser(data, userId);
  if (problems.length > 0) throw new InvalidUserError(userId, problems);

  return toUserObject(data);
}
