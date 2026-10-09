/* ==========================================================================
   Task 6 - Legacy Course Registration Service Using Callbacks
   --------------------------------------------------------------------------
   Load Student -> Check Prerequisites -> Check Available Seats -> Register Course

   Every operation:
     - is asynchronous (setTimeout),
     - uses the error-first convention  callback(error, value),
     - calls its callback EXACTLY ONCE: each branch ends with `return callback(...)`,
       and the callback is called outside any try block so an error thrown by
       the caller's callback can never make us call it a second time.
   No Promises and no async/await are used anywhere in this file.
   ========================================================================== */

export const DELAY_MS = 50;

/** Fresh copy of the legacy system's data (so each run/test starts clean). */
export function createRegistry() {
  return {
    students: {
      101: { id: 101, name: "Ali Khan", completedCourses: ["CS201", "CS301"] },
      102: { id: 102, name: "Sara Malik", completedCourses: ["CS201"] },
      103: { id: 103, name: "Usman Raza", completedCourses: ["CS201", "CS301", "MT101"] },
      104: { id: 104, name: "Hina Noor", completedCourses: ["CS301"] },
      105: { id: 105, name: "Bilal Ahmed", completedCourses: ["CS301"] }
    },
    courses: {
      CS401: { code: "CS401", title: "Full Stack Web Development", prerequisites: ["CS301"], capacity: 3, registered: [103] },
      CS402: { code: "CS402", title: "Cloud Computing", prerequisites: ["CS301"], capacity: 1, registered: [103] },
      MT201: { code: "MT201", title: "Linear Algebra", prerequisites: [], capacity: 40, registered: [] }
    }
  };
}

/** Error with a machine-readable code, so callers can tell failures apart. */
export class RegistrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RegistrationError";
    this.code = code;
  }
}

function isFunction(value) {
  return typeof value === "function";
}

/* ---------- Stage 1: load the student ---------- */
export function loadStudent(registry, studentId, callback) {
  if (!isFunction(callback)) throw new TypeError("callback must be a function");
  setTimeout(() => {
    if (!Number.isInteger(studentId)) {
      return callback(new TypeError(`Student id must be a whole number (got ${JSON.stringify(studentId)})`));
    }
    const student = registry.students[studentId];
    if (!student) return callback(new RegistrationError("STUDENT_NOT_FOUND", `Student ${studentId} does not exist`));
    return callback(null, student);
  }, DELAY_MS);
}

/* ---------- Stage 2: check prerequisites ---------- */
export function checkPrerequisites(registry, student, courseCode, callback) {
  if (!isFunction(callback)) throw new TypeError("callback must be a function");
  setTimeout(() => {
    const course = registry.courses[courseCode];
    if (!course) return callback(new RegistrationError("COURSE_NOT_FOUND", `Course ${courseCode} does not exist`));
    const missing = course.prerequisites.filter((code) => !student.completedCourses.includes(code));
    if (missing.length > 0) {
      return callback(new RegistrationError("PREREQUISITE_MISSING", `${student.name} has not completed ${missing.join(", ")} required for ${courseCode}`));
    }
    return callback(null, course);
  }, DELAY_MS);
}

/* ---------- Stage 3: check seats (and that the student is not already in) ---------- */
export function checkSeats(student, course, callback) {
  if (!isFunction(callback)) throw new TypeError("callback must be a function");
  setTimeout(() => {
    if (course.registered.includes(student.id)) {
      return callback(new RegistrationError("ALREADY_REGISTERED", `${student.name} is already registered in ${course.code}`));
    }
    const seatsLeft = course.capacity - course.registered.length;
    if (seatsLeft <= 0) return callback(new RegistrationError("COURSE_FULL", `${course.code} is full (${course.capacity} seats)`));
    return callback(null, seatsLeft);
  }, DELAY_MS);
}

/* ---------- Stage 4: register (the only step that changes data, by design) ---------- */
export function registerCourse(student, course, callback) {
  if (!isFunction(callback)) throw new TypeError("callback must be a function");
  setTimeout(() => {
    // re-check right before writing: another request may have taken the last seat
    if (course.registered.includes(student.id)) {
      return callback(new RegistrationError("ALREADY_REGISTERED", `${student.name} is already registered in ${course.code}`));
    }
    if (course.registered.length >= course.capacity) {
      return callback(new RegistrationError("COURSE_FULL", `${course.code} became full`));
    }
    course.registered.push(student.id);
    return callback(null, { studentId: student.id, course: course.code, status: "REGISTERED" });
  }, DELAY_MS);
}

/**
 * The whole workflow. Each stage only starts inside the previous stage's
 * callback, and the first error stops everything ("return done(error)").
 *
 * Notice the shape: every new dependent step adds another level of
 * indentation, and every level repeats the same "if (error) return done(error)"
 * check. This is the "pyramid of doom" explained in the README.
 */
export function registerStudentForCourse(registry, studentId, courseCode, done) {
  if (!isFunction(done)) throw new TypeError("done must be a function");

  loadStudent(registry, studentId, (loadError, student) => {
    if (loadError) return done(loadError);

    checkPrerequisites(registry, student, courseCode, (prereqError, course) => {
      if (prereqError) return done(prereqError);

      checkSeats(student, course, (seatError) => {
        if (seatError) return done(seatError);

        registerCourse(student, course, (registerError, confirmation) => {
          if (registerError) return done(registerError);
          return done(null, confirmation);
        });
      });
    });
  });
}
