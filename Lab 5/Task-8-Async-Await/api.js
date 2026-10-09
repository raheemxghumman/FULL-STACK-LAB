/* ==========================================================================
   Task 8 - Concurrent Academic API Aggregator with async/await
   --------------------------------------------------------------------------
   getJSON(url, fetchImplementation)   fetch + response.ok + JSON, with clear errors
   fakeFetch(url, options)             a fetch() look-alike for reproducible tests
   loadDashboard(fetchImplementation)  /users, /courses, /results fetched CONCURRENTLY
   fetchWithTimeout(url, ms)           AbortController + setTimeout + clearTimeout in finally

   Error classes let the caller tell the failure kinds apart:
     HttpError         the server answered with a non-2xx status (404, 500 ...)
     NetworkError      the request never got a response (DNS, refused, offline)
     InvalidJSONError  the response body was not valid JSON
     TimeoutError      we aborted the request because it took too long
   ========================================================================== */

export class HttpError extends Error {
  constructor(status, statusText, url) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}
export class NetworkError extends Error {
  constructor(url, cause) {
    super(`Network failure while requesting ${url}: ${cause?.message ?? "unknown error"}`, { cause });
    this.name = "NetworkError";
    this.url = url;
  }
}
export class InvalidJSONError extends Error {
  constructor(url, cause) {
    super(`Response from ${url} is not valid JSON`, { cause });
    this.name = "InvalidJSONError";
    this.url = url;
  }
}
export class TimeoutError extends Error {
  constructor(url, ms) {
    super(`Request to ${url} was aborted after ${ms} ms`);
    this.name = "TimeoutError";
    this.url = url;
    this.timeoutMs = ms;
  }
}

/* ---------- fake server data ---------- */

const DATA = {
  "/users": [
    { id: 1, name: "Ali", role: "student", department: "CS" },
    { id: 2, name: "Sara", role: "student", department: "CS" },
    { id: 3, name: "Usman", role: "student", department: "SE" },
    { id: 4, name: "Hina", role: "student", department: "AI" },
    { id: 5, name: "Ahmed", role: "student", department: "SE" },
    { id: 6, name: "Zoya", role: "student", department: "AI" },
    { id: 90, name: "Ms Warda Aslam", role: "faculty", department: "CS" }
  ],
  "/courses": [
    { code: "CS301", title: "Full Stack Web Development" },
    { code: "CS302", title: "Operating Systems" },
    { code: "MT201", title: "Linear Algebra" }
  ],
  "/results": [
    { studentId: 1, course: "CS301", marks: 82 }, { studentId: 1, course: "CS302", marks: 76 },
    { studentId: 2, course: "CS301", marks: 91 }, { studentId: 2, course: "CS302", marks: 88 },
    { studentId: 3, course: "CS301", marks: 47 }, { studentId: 3, course: "MT201", marks: 41 },
    { studentId: 4, course: "CS301", marks: 73 }, { studentId: 4, course: "MT201", marks: 69 },
    { studentId: 5, course: "CS302", marks: 64 }, { studentId: 5, course: "MT201", marks: 58 },
    { studentId: 6, course: "CS301", marks: 91 }, { studentId: 6, course: "CS302", marks: 94 }
  ]
};

// How each special URL behaves. Normal data URLs answer 200 after FAKE_LATENCY_MS.
export const FAKE_LATENCY_MS = 200;
const ROUTES = {
  "/missing": { status: 404 },
  "/server-error": { status: 500 },
  "/network-down": { network: true },
  "/bad-json": { status: 200, body: "{ this is not json" },
  "/slow": { status: 200, delay: 3000, body: JSON.stringify({ message: "finally answered" }) }
};
const STATUS_TEXT = { 200: "OK", 404: "Not Found", 500: "Internal Server Error" };

function makeAbortError() {
  const error = new Error("This operation was aborted");
  error.name = "AbortError";
  return error;
}

/**
 * Async stand-in for fetch(). Returns an object shaped like a real Response:
 * { ok, status, statusText, url, json(), text() }.
 * Supports options.signal (AbortController) like the real fetch.
 */
export function fakeFetch(url, options = {}) {
  const { signal } = options;
  const route = ROUTES[url] ?? (DATA[url] ? { status: 200, body: JSON.stringify(DATA[url]) } : { status: 404 });
  const delay = route.delay ?? FAKE_LATENCY_MS;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(makeAbortError());

    const onAbort = () => {
      clearTimeout(timer);
      reject(makeAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      if (route.network) return reject(new TypeError("fetch failed (connection refused)"));
      const body = route.body ?? JSON.stringify({ error: STATUS_TEXT[route.status] });
      resolve({
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        statusText: STATUS_TEXT[route.status] ?? "",
        url,
        text: async () => body,
        json: async () => JSON.parse(body)       // throws SyntaxError for invalid JSON, like the real one
      });
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/* ---------- getJSON ---------- */

/**
 * 1. calls fetchImplementation(url)
 * 2. checks response.ok
 * 3. throws HttpError for unsuccessful status codes
 * 4. parses and returns the JSON
 * 5. turns network and parsing failures into clear error types
 * The optional third argument is passed to fetch (used for the abort signal).
 */
export async function getJSON(url, fetchImplementation = fakeFetch, options = {}) {
  if (typeof fetchImplementation !== "function") throw new TypeError("fetchImplementation must be a function");

  let response;
  try {
    response = await fetchImplementation(url, options);
  } catch (error) {
    if (error?.name === "AbortError") throw error;          // let fetchWithTimeout decide what it means
    throw new NetworkError(url, error);
  }

  if (!response.ok) throw new HttpError(response.status, response.statusText, url);

  try {
    return await response.json();
  } catch (error) {
    throw new InvalidJSONError(url, error);
  }
}

/* ---------- fetchWithTimeout ---------- */

/**
 * Aborts the request if it takes longer than `milliseconds`.
 * The timer is always cleared in `finally`, whether the request succeeded,
 * failed, or timed out, so no stray timer keeps the program alive.
 */
export async function fetchWithTimeout(url, milliseconds, fetchImplementation = fakeFetch) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new RangeError("milliseconds must be a positive number");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await getJSON(url, fetchImplementation, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new TimeoutError(url, milliseconds);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Names the kind of failure so the dashboard can show a sensible message. */
export function classifyError(error) {
  if (error instanceof TimeoutError) return "TIMEOUT";
  if (error instanceof HttpError) return `HTTP_${error.status}`;
  if (error instanceof NetworkError) return "NETWORK";
  if (error instanceof InvalidJSONError) return "INVALID_JSON";
  return "UNKNOWN";
}

/* ---------- dashboard ---------- */

const round2 = (n) => Math.round(n * 100) / 100;

/** Pure function: turns the three data sets into dashboard statistics. */
export function buildDashboard(users, courses, results) {
  if (!Array.isArray(users) || !Array.isArray(courses) || !Array.isArray(results)) {
    throw new TypeError("users, courses and results must all be arrays");
  }
  const students = users.filter((u) => u.role === "student");
  const validResults = results.filter((r) => typeof r.marks === "number" && r.marks >= 0 && r.marks <= 100);

  // average per student
  const perStudent = students.map((student) => {
    const marks = validResults.filter((r) => r.studentId === student.id).map((r) => r.marks);
    const average = marks.length ? round2(marks.reduce((a, b) => a + b, 0) / marks.length) : null;
    return { id: student.id, name: student.name, department: student.department, average, failed: average !== null && average < 50 };
  });
  const graded = perStudent.filter((s) => s.average !== null);
  const best = graded.reduce((top, s) => (top === null || s.average > top.average ? s : top), null);

  const departments = graded.reduce((acc, s) => {
    const d = acc[s.department] ?? { students: 0, total: 0, failed: 0 };
    acc[s.department] = { students: d.students + 1, total: d.total + s.average, failed: d.failed + (s.failed ? 1 : 0) };
    return acc;
  }, {});

  return {
    totalStudents: students.length,
    totalCourses: courses.length,
    overallAverageMarks: validResults.length ? round2(validResults.reduce((sum, r) => sum + r.marks, 0) / validResults.length) : 0,
    highestPerformingStudent: best ? { name: best.name, average: best.average } : null,
    failedStudents: graded.filter((s) => s.failed).length,
    departmentStatistics: Object.fromEntries(
      Object.entries(departments).map(([name, d]) => [name, { students: d.students, averageMarks: round2(d.total / d.students), failed: d.failed }])
    )
  };
}

/**
 * The three requests do not depend on each other, so they are started
 * together and awaited with Promise.all (total time is about one request,
 * not three). If any of them fails, Promise.all rejects with that error.
 */
export async function loadDashboard(fetchImplementation = fakeFetch, urls = { users: "/users", courses: "/courses", results: "/results" }) {
  const [users, courses, results] = await Promise.all([
    getJSON(urls.users, fetchImplementation),
    getJSON(urls.courses, fetchImplementation),
    getJSON(urls.results, fetchImplementation)
  ]);
  return buildDashboard(users, courses, results);
}

/** The slow way, for comparison only: each await waits before the next request starts. */
export async function loadDashboardSequentially(fetchImplementation = fakeFetch) {
  const users = await getJSON("/users", fetchImplementation);
  const courses = await getJSON("/courses", fetchImplementation);
  const results = await getJSON("/results", fetchImplementation);
  return buildDashboard(users, courses, results);
}
