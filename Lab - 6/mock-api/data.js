/* ==========================================================================
   mock-api/data.js - data and routing rules of the simulated API.
   Shared by the Node mock server (mock-api/server.js) and the browser
   simulator used by the UI (ui/mockFetch.js), so both behave the same.

     /users/1 .. /users/3   valid users          /posts?userId=1..3  valid posts
     /users/50              fetched, but no name and an invalid email
     /users/51              valid user, but one of its posts is invalid
     /users/52              HTTP 500 server error (users and posts)
     /users/53              body that is not valid JSON
     /users/54              very slow answer (for timeouts)
     /users/55              network failure (connection dropped)
     anything else          HTTP 404 with {} (like JSONPlaceholder)
   ========================================================================== */

export const USERS = {
  1: { id: 1, name: "Ali Khan", username: "alikhan", email: "ali@university.edu", phone: "0300-1234567", website: "alikhan.dev", address: { city: "Islamabad" }, company: { name: "CampusFlow" } },
  2: { id: 2, name: "Sara Malik", username: "saram", email: "sara@university.edu", phone: "0321-7654321", website: "sara.pk", address: { city: "Lahore" }, company: { name: "Pixelwise" } },
  3: { id: 3, name: "Usman Raza", username: "usmanr", email: "usman@university.edu", phone: "0333-1112222", website: "usman.io", address: { city: "Multan" }, company: { name: "Nexus Labs" } },
  50: { id: 50, name: "", username: "ghost", email: "ghost-at-nowhere", address: { city: "Unknown" } },
  51: { id: 51, name: "Hina Noor", username: "hinan", email: "hina@university.edu", phone: "0345-9998888", address: { city: "Karachi" }, company: { name: "ByteSized" } },
  54: { id: 54, name: "Slow Sam", username: "slowsam", email: "sam@university.edu", address: { city: "Quetta" }, company: { name: "Snail Mail" } }
};

export const POSTS = [
  { userId: 1, id: 1, title: "Learning async/await", body: "It reads like normal code." },
  { userId: 1, id: 2, title: "Promise.all in practice", body: "Run independent requests together." },
  { userId: 1, id: 3, title: "Handling failed requests", body: "Check response.ok every time." },
  { userId: 2, id: 4, title: "Designing error states", body: "Every request can fail." },
  { userId: 3, id: 5, title: "Fetch API basics", body: "Always check response.ok." },
  { userId: 51, id: 6, title: "My first post", body: "Hello!" },
  { userId: 54, id: 8, title: "Taking my time", body: "Patience." }
];

// A broken post that is only ever listed under user 51 (it claims to belong to user 2)
export const MISFILED_POST = { userId: 2, id: 7, title: "", body: "Listed under user 51 by mistake." };

export const SLOW_DELAY_MS = 2500;

/**
 * Decides the response for a request path.
 * @returns {{ status: number, body: string, slow?: boolean, networkFailure?: boolean }}
 */
export function resolveRoute(pathname, searchParams) {
  const json = (status, value) => ({ status, body: JSON.stringify(value) });
  const userMatch = pathname.match(/\/users\/(\d+)$/);

  if (userMatch) {
    const id = Number(userMatch[1]);
    if (id === 52) return json(500, { error: "Internal Server Error" });
    if (id === 53) return { status: 200, body: "{ broken json" };
    if (id === 55) return { status: 0, body: "", networkFailure: true };
    if (id === 54) return { ...json(200, USERS[54]), slow: true };
    return USERS[id] ? json(200, USERS[id]) : json(404, {});
  }

  if (pathname.endsWith("/posts")) {
    const userId = Number(searchParams.get("userId"));
    if (userId === 52) return json(500, { error: "Internal Server Error" });
    if (userId === 55) return { status: 0, body: "", networkFailure: true };
    const list = POSTS.filter((p) => p.userId === userId);
    return json(200, userId === 51 ? [...list, MISFILED_POST] : list);
  }

  return json(404, {});
}

export const STATUS_TEXT = { 200: "OK", 404: "Not Found", 500: "Internal Server Error" };
