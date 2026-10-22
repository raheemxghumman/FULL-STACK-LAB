/* ==========================================================================
   public/checks.js - the lab requirements as runnable checks
   --------------------------------------------------------------------------
   Each check sends real requests through transport.request(), then compares
   the status code (and, where it matters, the body) with what the API must
   return. Checks run in order and share the ids of the records they create;
   a final clean-up deletes anything that is left.
   ========================================================================== */

import { request } from "./transport.js";

const PAST_DATE = "2026-10-01";

export function createChecks() {
  const tag = Math.random().toString(36).slice(2, 7);
  const student = {
    rollNo: String(260000 + Math.floor(Math.random() * 9999)), name: "Check Student",
    email: `check.${tag}@uni.edu.pk`, program: "BSSE", semester: 4, section: "B"
  };
  const teacher = {
    name: "Check Teacher", email: `teacher.${tag}@uni.edu.pk`, designation: "Lecturer",
    department: "Computer Science", course: "Requirement Testing", phone: "03001112233"
  };
  const ctx = {};

  /** Sends one request and judges it. verify(r) returns a message when something is wrong. */
  async function call(method, path, body, expected, verify, options) {
    const r = await request(method, path, body, { ...options, source: "checks" });
    let note = "";
    if (r.status !== expected) note = `Expected ${expected}, got ${r.status}${r.body && r.body.error ? `: ${r.body.error}` : ""}`;
    else if (verify) {
      try { note = verify(r) || ""; } catch (err) { note = `Unexpected response: ${err.message}`; }
    }
    return { pass: !note, note, request: `${method} ${path}`, method, expected, status: r.status, ms: r.ms, response: r.body };
  }

  const check = (group, title, run) => ({ group, title, run });
  const att = (over = {}) => ({ studentId: ctx.studentId, teacherId: ctx.teacherId, date: PAST_DATE, status: "present", ...over });

  const checks = [
    /* ---- General HTTP behaviour ---- */
    check("General", "GET /health answers with status \"ok\"", () =>
      call("GET", "/health", undefined, 200, (r) => r.body.status !== "ok" && "status is not ok")),
    check("General", "GET /hello?name=Ali still works (route from the original file)", () =>
      call("GET", "/hello?name=Ali", undefined, 200, (r) => r.body.message !== "Hello Ali" && `message was "${r.body.message}"`)),
    check("General", "An unknown route returns 404 \"Route not found\"", () =>
      call("GET", "/api/courses", undefined, 404, (r) => r.body.error !== "Route not found" && "wrong error text")),
    check("General", "A wrong method returns 405 with an Allow header", () =>
      call("DELETE", "/api/students", undefined, 405, (r) => !String(r.headers.allow || "").includes("GET") && "no Allow header")),
    check("General", "A body that is not valid JSON returns 400", () =>
      call("POST", "/api/students", "{\"name\": ", 400)),
    check("General", "A body that is not sent as JSON returns 415", () =>
      call("POST", "/api/students", "name=Ali", 415, null, { contentType: "text/plain" })),

    /* ---- Student CRUD ---- */
    check("Student", "Create: POST /api/students returns 201 and a Location header", async () => {
      const res = await call("POST", "/api/students", student, 201, (r) =>
        r.headers.location !== `/api/students/${r.body.data.id}` && "Location header missing");
      ctx.studentId = res.response && res.response.data && res.response.data.id;
      return res;
    }),
    check("Student", "Read: GET /api/students/:id returns the new student", () =>
      call("GET", `/api/students/${ctx.studentId}`, undefined, 200, (r) => r.body.data.rollNo !== student.rollNo && "wrong student")),
    check("Student", "Read: GET /api/students?q=<roll no> finds exactly that student", () =>
      call("GET", `/api/students?q=${student.rollNo}`, undefined, 200, (r) => r.body.total !== 1 && `found ${r.body.total}`)),
    check("Student", "Update: PUT replaces the whole record", () =>
      call("PUT", `/api/students/${ctx.studentId}`, { ...student, name: "Check Student Renamed" }, 200, (r) =>
        r.body.data.name !== "Check Student Renamed" && "name did not change")),
    check("Student", "Update: PATCH changes only the fields that are sent", () =>
      call("PATCH", `/api/students/${ctx.studentId}`, { semester: 5 }, 200, (r) =>
        (r.body.data.semester !== 5 || r.body.data.name !== "Check Student Renamed") && "other fields changed")),
    check("Student", "Validation: invalid fields return 422 with a message for each field", () =>
      call("POST", "/api/students", { rollNo: "12", name: "A", email: "not-an-email", program: "MBA", semester: 12 }, 422, (r) =>
        (r.body.details || []).length < 5 && `only ${(r.body.details || []).length} field errors`)),
    check("Student", "A roll number that is already registered returns 409", () =>
      call("POST", "/api/students", { ...student, email: `other.${tag}@uni.edu.pk` }, 409)),

    /* ---- Teacher CRUD ---- */
    check("Teacher", "Create: POST /api/teachers returns 201", async () => {
      const res = await call("POST", "/api/teachers", teacher, 201);
      ctx.teacherId = res.response && res.response.data && res.response.data.id;
      return res;
    }),
    check("Teacher", "Read: GET /api/teachers/:id returns the new teacher", () =>
      call("GET", `/api/teachers/${ctx.teacherId}`, undefined, 200, (r) => r.body.data.course !== teacher.course && "wrong teacher")),
    check("Teacher", "Update: PUT replaces the whole record", () =>
      call("PUT", `/api/teachers/${ctx.teacherId}`, { ...teacher, department: "Software Engineering" }, 200, (r) =>
        r.body.data.department !== "Software Engineering" && "department did not change")),
    check("Teacher", "Update: PATCH changes the designation only", () =>
      call("PATCH", `/api/teachers/${ctx.teacherId}`, { designation: "Assistant Professor" }, 200, (r) =>
        (r.body.data.designation !== "Assistant Professor" || r.body.data.department !== "Software Engineering") && "fields changed unexpectedly")),
    check("Teacher", "Validation: a phone number that is not 03XXXXXXXXX returns 422", () =>
      call("PATCH", `/api/teachers/${ctx.teacherId}`, { phone: "12345" }, 422, (r) =>
        !(r.body.details || []).some((d) => d.field === "phone") && "no error for phone")),

    /* ---- Attendance CRUD ---- */
    check("Attendance", "Create: POST /api/attendance returns 201 with the teacher's course", async () => {
      const res = await call("POST", "/api/attendance", att(), 201, (r) => r.body.data.course !== teacher.course && "course not filled in");
      ctx.attendanceId = res.response && res.response.data && res.response.data.id;
      return res;
    }),
    check("Attendance", "Read: GET /api/attendance?studentId=…&teacherId=… lists it", () =>
      call("GET", `/api/attendance?studentId=${ctx.studentId}&teacherId=${ctx.teacherId}`, undefined, 200, (r) => r.body.total !== 1 && `found ${r.body.total}`)),
    check("Attendance", "The same student, course and date again returns 409", () =>
      call("POST", "/api/attendance", att({ status: "absent" }), 409)),
    check("Attendance", "A date in the future returns 422", () =>
      call("POST", "/api/attendance", att({ date: "2099-01-01" }), 422)),
    check("Attendance", "A student that does not exist returns 422", () =>
      call("POST", "/api/attendance", att({ studentId: 999999 }), 422)),
    check("Attendance", "Update: PATCH changes the status to late", () =>
      call("PATCH", `/api/attendance/${ctx.attendanceId}`, { status: "late" }, 200, (r) => r.body.data.status !== "late" && "status not changed")),
    check("Attendance", "Update: PUT replaces the whole record", () =>
      call("PUT", `/api/attendance/${ctx.attendanceId}`, att({ remarks: "Re-checked by the teacher" }), 200, (r) =>
        (r.body.data.status !== "present" || !r.body.data.remarks) && "record not replaced")),
    check("Attendance", "Delete: DELETE /api/attendance/:id returns 200", async () => {
      const extra = await request("POST", "/api/attendance", att({ date: "2026-10-02", status: "absent" }), { source: "checks" });
      return call("DELETE", `/api/attendance/${extra.body && extra.body.data ? extra.body.data.id : "missing"}`, undefined, 200);
    }),

    /* ---- Marks CRUD ---- */
    check("Marks", "Create: POST /api/marks returns 201 with percentage and grade", async () => {
      const res = await call("POST", "/api/marks", { studentId: ctx.studentId, teacherId: ctx.teacherId, assessment: "quiz", title: "Check Quiz", obtained: 17, total: 20 }, 201, (r) =>
        (r.body.data.percentage !== 85 || r.body.data.grade !== "A") && `got ${r.body.data.percentage}% ${r.body.data.grade}`);
      ctx.marksId = res.response && res.response.data && res.response.data.id;
      return res;
    }),
    check("Marks", "Read: GET /api/marks/:id returns the record", () =>
      call("GET", `/api/marks/${ctx.marksId}`, undefined, 200, (r) => r.body.data.title !== "Check Quiz" && "wrong record")),
    check("Marks", "Obtained marks above the total return 422", () =>
      call("PATCH", `/api/marks/${ctx.marksId}`, { obtained: 25 }, 422)),
    check("Marks", "Update: PUT recalculates the percentage and grade", () =>
      call("PUT", `/api/marks/${ctx.marksId}`, { studentId: ctx.studentId, teacherId: ctx.teacherId, assessment: "quiz", title: "Check Quiz", obtained: 12, total: 20 }, 200, (r) =>
        (r.body.data.percentage !== 60 || r.body.data.grade !== "C-") && `got ${r.body.data.percentage}% ${r.body.data.grade}`)),

    /* ---- Modules working together ---- */
    check("Relations", "GET /api/students/:id/report combines attendance and marks", () =>
      call("GET", `/api/students/${ctx.studentId}/report`, undefined, 200, (r) =>
        (r.body.data.courses.length !== 1 || r.body.data.attendance.total !== 1 || r.body.data.marks.total !== 20) && "report totals are wrong")),
    check("Relations", "Deleting a student who still has records is refused with 409", () =>
      call("DELETE", `/api/students/${ctx.studentId}`, undefined, 409, (r) =>
        (!r.body.related || r.body.related.attendance !== 1 || r.body.related.marks !== 1) && "related counts are wrong")),
    check("Relations", "Delete: DELETE /api/marks/:id returns 200", () =>
      call("DELETE", `/api/marks/${ctx.marksId}`, undefined, 200)),
    check("Relations", "Delete: ?cascade=true deletes the student and the remaining attendance", () =>
      call("DELETE", `/api/students/${ctx.studentId}?cascade=true`, undefined, 200, (r) => r.body.related.attendance !== 1 && "attendance not deleted")),
    check("Relations", "The deleted student now returns 404", () =>
      call("GET", `/api/students/${ctx.studentId}`, undefined, 404)),
    check("Relations", "Their attendance record was deleted with them (404)", () =>
      call("GET", `/api/attendance/${ctx.attendanceId}`, undefined, 404)),
    check("Relations", "Delete: DELETE /api/teachers/:id returns 200", () =>
      call("DELETE", `/api/teachers/${ctx.teacherId}`, undefined, 200))
  ];

  // Removes anything left over when a check in the middle failed.
  async function cleanUp() {
    if (ctx.studentId) await request("DELETE", `/api/students/${ctx.studentId}?cascade=true`, undefined, { source: "checks" });
    if (ctx.teacherId) await request("DELETE", `/api/teachers/${ctx.teacherId}?cascade=true`, undefined, { source: "checks" });
  }

  return { checks, cleanUp };
}
