/* ==========================================================================
   Task 7 - Promise-Based Multi-Service Registration Engine
   --------------------------------------------------------------------------
   Every service returns a Promise created with `new Promise(...)` and finishes
   later through setTimeout, calling resolve() on success or reject() on failure.

   The chain passes ONE growing "context" object from stage to stage:
     getStudent -> { student }
     getCourse  -> { student, course }
     checkPrerequisites -> same context (verified)
     checkSeats -> { ..., seatsLeft }
     registerStudent -> { ..., confirmation }
   ========================================================================== */

export const DELAY = { fast: 30, normal: 60, slow: 150 };

export function createDatabase() {
  return {
    students: {
      101: { id: 101, name: "Ali Khan", email: "ali@university.edu", phone: "03001234567", completed: ["CS201", "CS301"] },
      102: { id: 102, name: "Sara Malik", email: "sara@university.edu", phone: null, completed: ["CS201", "CS301"] },
      103: { id: 103, name: "Usman Raza", email: "usman@university.edu", phone: "03331112222", completed: ["CS201"] },
      104: { id: 104, name: "Hina Noor", email: "hina@university.edu", phone: "03215556666", completed: ["CS201", "CS301"] }
    },
    courses: {
      CS401: { code: "CS401", title: "Full Stack Web Development", prerequisites: ["CS301"], capacity: 2, registered: [] },
      CS402: { code: "CS402", title: "Cloud Computing", prerequisites: ["CS301"], capacity: 2, registered: [999] }
    },
    auditLog: [],
    auditAvailable: true
  };
}

export class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

/** Resolves with `value` after `ms`, or rejects with `error` if one is given. */
function settleLater(ms, error, value) {
  return new Promise((resolve, reject) => {
    setTimeout(() => (error ? reject(error) : resolve(value)), ms);
  });
}

/* ---------- Part A: registration services ---------- */

export function getStudent(db, studentId) {
  if (!Number.isInteger(studentId)) return Promise.reject(new TypeError(`Student id must be a whole number (got ${JSON.stringify(studentId)})`));
  const student = db.students[studentId];
  return settleLater(DELAY.normal, student ? null : new ServiceError("STUDENT_NOT_FOUND", `Student ${studentId} does not exist`), { student });
}

export function getCourse(db, context, courseCode) {
  if (!context || !context.student) {
    // this is what happens when a previous .then() forgot to return its promise
    return Promise.reject(new TypeError("getCourse received no student: did the previous .then() forget to return?"));
  }
  const course = db.courses[courseCode];
  return settleLater(DELAY.normal, course ? null : new ServiceError("COURSE_NOT_FOUND", `Course ${courseCode} does not exist`), { ...context, course });
}

export function checkPrerequisites(context) {
  const { student, course } = context;
  const missing = course.prerequisites.filter((code) => !student.completed.includes(code));
  const error = missing.length ? new ServiceError("PREREQUISITE_MISSING", `${student.name} has not completed ${missing.join(", ")}`) : null;
  return settleLater(DELAY.fast, error, context);
}

export function checkSeats(context) {
  const { student, course } = context;
  let error = null;
  if (course.registered.includes(student.id)) error = new ServiceError("ALREADY_REGISTERED", `${student.name} is already registered in ${course.code}`);
  else if (course.registered.length >= course.capacity) error = new ServiceError("COURSE_FULL", `${course.code} is full`);
  return settleLater(DELAY.fast, error, { ...context, seatsLeft: course.capacity - course.registered.length });
}

export function registerStudent(context) {
  const { student, course } = context;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (course.registered.length >= course.capacity) return reject(new ServiceError("COURSE_FULL", `${course.code} became full`));
      course.registered.push(student.id);           // registration is the step that is meant to change data
      resolve({ ...context, confirmation: { studentId: student.id, course: course.code, status: "REGISTERED" } });
    }, DELAY.normal);
  });
}

/**
 * The full chain. Each .then() RETURNS the next promise, so the chain waits
 * for it and the next stage receives its result. Any rejection skips the
 * remaining .then() steps and goes straight to the caller's .catch().
 */
export function registrationChain(db, studentId, courseCode) {
  return getStudent(db, studentId)
    .then((context) => getCourse(db, context, courseCode))
    .then((context) => checkPrerequisites(context))
    .then((context) => checkSeats(context))
    .then((context) => registerStudent(context));
}

/**
 * The SAME chain with one mistake: the second step does not return.
 * Its callback returns undefined, so the chain moves on immediately with
 * undefined instead of waiting for getCourse, and checkPrerequisites crashes.
 */
export function brokenRegistrationChain(db, studentId, courseCode) {
  return getStudent(db, studentId)
    .then((context) => {
      getCourse(db, context, courseCode);         // <- missing `return`
    })
    .then((context) => checkPrerequisites(context))
    .then((context) => checkSeats(context))
    .then((context) => registerStudent(context));
}

/* ---------- Part B: post-registration services ---------- */

export function sendEmail(student) {
  const error = student.email ? null : new ServiceError("NO_EMAIL", `${student.name} has no email address`);
  return settleLater(DELAY.normal, error, `Email sent to ${student.email}`);
}

export function sendSMS(student) {
  const error = student.phone ? null : new ServiceError("NO_PHONE", `${student.name} has no phone number for SMS`);
  return settleLater(DELAY.fast, error, `SMS sent to ${student.phone}`);
}

export function writeAuditLog(db, confirmation) {
  const error = db.auditAvailable ? null : new ServiceError("AUDIT_DOWN", "Audit service is unavailable");
  if (!error) db.auditLog.push({ ...confirmation, at: new Date().toISOString() });
  return settleLater(DELAY.slow, error, `Audit entry #${db.auditLog.length} written`);
}

/**
 * Starts the three services at the same time and waits for ALL of them to
 * settle. Promise.allSettled is used because these services are independent:
 * one failing (e.g. SMS) must not hide the outcome of the others.
 * (Promise.all would reject on the first failure and lose the other results.)
 */
export function runPostRegistration(db, student, confirmation) {
  const services = [
    { service: "Email", run: sendEmail(student) },
    { service: "SMS", run: sendSMS(student) },
    { service: "Audit", run: writeAuditLog(db, confirmation) }
  ];
  return Promise.allSettled(services.map(({ run }) => run)).then((outcomes) =>
    outcomes.map((outcome, i) => ({
      service: services[i].service,
      status: outcome.status,
      ...(outcome.status === "fulfilled" ? { detail: outcome.value } : { reason: outcome.reason.message })
    }))
  );
}

/* ---------- Part C: two course servers ---------- */

/** One course server: answers after `ms`, or fails if `fail` is true. */
export function fetchCourseFromServer(serverName, courseCode, { ms, fail }) {
  const error = fail ? new ServiceError("SERVER_ERROR", `${serverName} could not return ${courseCode}`) : null;
  return settleLater(ms, error, { server: serverName, code: courseCode, title: "Full Stack Web Development", seats: 40 });
}

/**
 * Promise.any: resolves with the FIRST SUCCESSFUL answer and ignores servers
 * that fail, rejecting only if every server fails (AggregateError).
 * Promise.race would settle with whichever server answers first, so a fast
 * failure from one server would reject the whole lookup even though the other
 * server was about to succeed. That is why any() is the right choice here.
 */
export function getCourseFromFastestServer(courseCode, primary, mirror) {
  return Promise.any([
    fetchCourseFromServer("Primary server", courseCode, primary),
    fetchCourseFromServer("Mirror server", courseCode, mirror)
  ]);
}

/** Same lookup with race(), only used in the demo to show why it is the wrong tool. */
export function getCourseWithRace(courseCode, primary, mirror) {
  return Promise.race([
    fetchCourseFromServer("Primary server", courseCode, primary),
    fetchCourseFromServer("Mirror server", courseCode, mirror)
  ]);
}
