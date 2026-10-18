/* ==========================================================================
   lib/validate.js - rules that decide whether fetched details are valid.
   Each validator returns a list of problems; an empty list means valid.
   ========================================================================== */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * A valid user has: the id that was asked for, a name, a username and a
 * well-formed email address.
 */
export function validateUser(user, expectedId) {
  if (user === null || typeof user !== "object" || Array.isArray(user)) return ["user is not an object"];
  const problems = [];
  if (user.id !== expectedId) problems.push(`user id is ${JSON.stringify(user.id)}, expected ${expectedId}`);
  if (!isNonEmptyString(user.name)) problems.push("user name is missing");
  if (!isNonEmptyString(user.username)) problems.push("username is missing");
  if (!isNonEmptyString(user.email)) problems.push("email is missing");
  else if (!EMAIL_PATTERN.test(user.email)) problems.push(`email "${user.email}" is not a valid address`);
  return problems;
}

/**
 * Valid posts: an array in which every post belongs to the user and has a
 * numeric id, a title and a body. An empty list is valid (the user simply
 * has not posted anything).
 */
export function validatePosts(posts, expectedUserId) {
  if (!Array.isArray(posts)) return ["posts is not an array"];
  const problems = [];
  posts.forEach((post, index) => {
    const where = `post #${index + 1}`;
    if (post === null || typeof post !== "object") return problems.push(`${where} is not an object`);
    if (!Number.isInteger(post.id)) problems.push(`${where} has no id`);
    if (post.userId !== expectedUserId) problems.push(`${where} belongs to user ${post.userId}, not ${expectedUserId}`);
    if (!isNonEmptyString(post.title)) problems.push(`${where} has an empty title`);
    if (typeof post.body !== "string") problems.push(`${where} has no body`);
  });
  return problems;
}

/** The clean user object handed back to callers (only the fields we need). */
export function toUserObject(user) {
  return {
    id: user.id,
    name: user.name.trim(),
    username: user.username.trim(),
    email: user.email.trim().toLowerCase(),
    phone: user.phone ?? null,
    website: user.website ?? null,
    city: user.address?.city ?? null,
    company: user.company?.name ?? null
  };
}

export function isValidUserId(id) {
  return Number.isInteger(id) && id > 0;
}
