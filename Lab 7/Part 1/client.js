// Lab 7 · Part 1 - client for the Student Management API
// Modified from the uploaded file "Step 23". First run the server in another terminal:
//     npm start            (node server.js, port 3002)
// Then run this file:
//     npm run client       (node client.js)
// Node.js 20+ provides global fetch().
//
// It walks through Create, Read, Update and Delete on all four modules and prints each step.
// Everything it creates is deleted again at the end, so it can be run many times.

const BASE = process.env.API_URL || "http://localhost:3002";

// Same idea as the original main(): fetch, check response.ok, then read the JSON.
async function call(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, ok: response.ok, data };
}

function show(step, method, path, { status, data }, pick = (d) => d) {
  console.log(`\n${step}  ${method} ${path}  ->  ${status}`);
  console.log("   ", JSON.stringify(pick(data)));
}

async function main() {
  // The two routes from the original file still work
  let r = await call("GET", "/hello?name=Ali");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  show("1.", "GET", "/hello?name=Ali", r);                                  // { message: 'Hello Ali' }
  show("2.", "GET", "/health", await call("GET", "/health"), (d) => ({ status: d.status, counts: d.counts }));

  // ---- Student: Create, Read, Update ----
  r = await call("POST", "/api/students", { rollNo: "241999", name: "Sara Malik", email: "sara.malik@uni.edu.pk", program: "BSCS", semester: 5, section: "A" });
  show("3. Create student ", "POST", "/api/students", r, (d) => ({ message: d.message, id: d.data.id, rollNo: d.data.rollNo, name: d.data.name, program: d.data.program }));
  const studentId = r.data.data.id;

  show("4. Read student   ", "GET", `/api/students/${studentId}`, await call("GET", `/api/students/${studentId}`), (d) => ({ id: d.data.id, name: d.data.name, rollNo: d.data.rollNo }));
  show("5. Update student ", "PATCH", `/api/students/${studentId}`, await call("PATCH", `/api/students/${studentId}`, { semester: 6 }), (d) => ({ message: d.message, semester: d.data.semester }));
  show("6. Invalid student", "POST", "/api/students", await call("POST", "/api/students", { rollNo: "12", name: "", email: "not-an-email", program: "MBA", semester: 11 }), (d) => ({ error: d.error, fields: d.details.map((x) => x.field) }));
  show("7. Duplicate roll ", "POST", "/api/students", await call("POST", "/api/students", { rollNo: "241999", name: "Someone Else", email: "else@uni.edu.pk", program: "BSCS", semester: 5 }), (d) => d.error);

  // ---- Teacher ----
  r = await call("POST", "/api/teachers", { name: "Nadia Aslam", email: "nadia.aslam@uni.edu.pk", designation: "Lecturer", department: "Computer Science", course: "Computer Networks" });
  show("8. Create teacher ", "POST", "/api/teachers", r, (d) => ({ id: d.data.id, name: d.data.name, course: d.data.course }));
  const teacherId = r.data.data.id;

  // ---- Attendance ----
  r = await call("POST", "/api/attendance", { studentId, teacherId, date: "2026-10-21", status: "late" });
  show("9. Mark attendance", "POST", "/api/attendance", r, (d) => ({ id: d.data.id, studentName: d.data.studentName, course: d.data.course, status: d.data.status }));
  const attendanceId = r.data.data.id;
  show("10. Change status ", "PUT", `/api/attendance/${attendanceId}`, await call("PUT", `/api/attendance/${attendanceId}`, { studentId, teacherId, date: "2026-10-21", status: "present" }), (d) => ({ status: d.data.status }));

  // ---- Marks ----
  r = await call("POST", "/api/marks", { studentId, teacherId, assessment: "quiz", title: "Quiz 1", obtained: 8.5, total: 10 });
  show("11. Add marks     ", "POST", "/api/marks", r, (d) => ({ id: d.data.id, title: d.data.title, percentage: d.data.percentage, grade: d.data.grade }));
  show("12. Too many marks", "POST", "/api/marks", await call("POST", "/api/marks", { studentId, teacherId, assessment: "quiz", title: "Quiz 2", obtained: 12, total: 10 }), (d) => d.details[0].message);

  // ---- Report that combines the modules ----
  show("13. Report        ", "GET", `/api/students/${studentId}/report`, await call("GET", `/api/students/${studentId}/report`),
    (d) => ({ attendance: d.data.attendance.percentage + "%", marks: d.data.marks.percentage + "%", grade: d.data.marks.grade }));

  // ---- Delete (the student has records, so a plain DELETE is refused) ----
  show("14. Delete student", "DELETE", `/api/students/${studentId}`, await call("DELETE", `/api/students/${studentId}`), (d) => d.error);
  show("15. Delete cascade", "DELETE", `/api/students/${studentId}?cascade=true`, await call("DELETE", `/api/students/${studentId}?cascade=true`), (d) => d.message);
  show("16. Delete teacher", "DELETE", `/api/teachers/${teacherId}`, await call("DELETE", `/api/teachers/${teacherId}`), (d) => d.message);
  show("17. Read deleted  ", "GET", `/api/students/${studentId}`, await call("GET", `/api/students/${studentId}`), (d) => d.error);

  return "\nDone: every module was created, read, updated and deleted through the API.";
}

main().then(console.log).catch((error) => { console.error("Start the server first (npm start):", error.message); process.exitCode = 1; });
