/* ==========================================================================
   lib/modules.js - the four modules of the Student Management System
   --------------------------------------------------------------------------
   Each module is described here once, and the router builds the same five
   CRUD endpoints for all of them from this description:

     schema      fields, types and rules (see validate.js)
     unique      field combinations that may not repeat (409 Conflict)
     check       rules that involve more than one field
     dependents  records in other modules that point to this one
     filters     fields that can be used as ?field=value on the list endpoint
     search      fields searched by ?q=
     sortable    fields allowed in ?sort= (prefix - for descending)
     decorate    read-only fields added to every response (names, %, grade)
   ========================================================================== */

/* Air University style grading scale (lowest percentage for each grade). */
export const GRADE_SCALE = [
  [85, "A"], [80, "A-"], [75, "B+"], [71, "B"], [68, "B-"], [64, "C+"],
  [61, "C"], [58, "C-"], [54, "D+"], [50, "D"], [0, "F"]
];

export const gradeFor = (percent) => GRADE_SCALE.find(([min]) => percent >= min)[1];
export const round1 = (n) => Math.round(n * 10) / 10;

/* Students below this attendance get a warning in their report. */
export const MIN_ATTENDANCE = 75;

const PERSON_NAME = {
  type: "string", required: true, min: 3, max: 60,
  pattern: /^[A-Za-z][A-Za-z .'-]*$/, hint: "may only contain letters, spaces and . ' -"
};

export const MODULES = {
  students: {
    title: "Student",
    schema: {
      rollNo:   { type: "string", required: true, pattern: /^\d{6}$/, hint: "must be exactly 6 digits, e.g. 241854.", label: "Roll number" },
      name:     { ...PERSON_NAME, label: "Name" },
      email:    { type: "email", required: true, max: 80, label: "Email" },
      program:  { type: "enum", required: true, values: ["BSCS", "BSSE", "BSAI", "BSCYS", "BSDS"], label: "Program" },
      semester: { type: "int", required: true, min: 1, max: 8, label: "Semester" },
      section:  { type: "enum", values: ["A", "B", "C", "D"], default: "A", label: "Section" }
    },
    unique: [
      { fields: ["rollNo"], message: (r) => `Roll number ${r.rollNo} is already registered.` },
      { fields: ["email"], message: (r) => `The email ${r.email} is already used by another student.` }
    ],
    dependents: [
      { module: "attendance", field: "studentId" },
      { module: "marks", field: "studentId" }
    ],
    filters: ["program", "semester", "section"],
    search: ["rollNo", "name", "email"],
    sortable: ["id", "rollNo", "name", "program", "semester", "createdAt"],
    defaultSort: "rollNo",
    decorate(student, db) {
      const attendance = db.attendance.all().filter((a) => a.studentId === student.id);
      const marks = db.marks.all().filter((m) => m.studentId === student.id);
      const attended = attendance.filter((a) => a.status === "present" || a.status === "late").length;
      const obtained = marks.reduce((s, m) => s + m.obtained, 0);
      const total = marks.reduce((s, m) => s + m.total, 0);
      return {
        attendancePercent: attendance.length ? round1((attended / attendance.length) * 100) : null,
        marksPercent: total ? round1((obtained / total) * 100) : null
      };
    }
  },

  teachers: {
    title: "Teacher",
    schema: {
      name:        { ...PERSON_NAME, label: "Name" },
      email:       { type: "email", required: true, max: 80, label: "Email" },
      designation: { type: "enum", required: true, values: ["Lecturer", "Assistant Professor", "Associate Professor", "Professor"], label: "Designation" },
      department:  { type: "string", required: true, min: 2, max: 60, label: "Department" },
      course:      { type: "string", required: true, min: 3, max: 60, label: "Course" },
      phone:       { type: "string", pattern: /^03\d{9}$/, hint: "must look like 03XXXXXXXXX (11 digits).", label: "Phone" }
    },
    unique: [
      { fields: ["email"], message: (r) => `The email ${r.email} is already used by another teacher.` }
    ],
    dependents: [
      { module: "attendance", field: "teacherId" },
      { module: "marks", field: "teacherId" }
    ],
    filters: ["designation", "department"],
    search: ["name", "email", "course", "department"],
    sortable: ["id", "name", "designation", "department", "course", "createdAt"],
    defaultSort: "name",
    decorate(teacher, db) {
      return {
        records: {
          attendance: db.attendance.all().filter((a) => a.teacherId === teacher.id).length,
          marks: db.marks.all().filter((m) => m.teacherId === teacher.id).length
        }
      };
    }
  },

  attendance: {
    title: "Attendance record",
    schema: {
      studentId: { type: "ref", ref: "students", required: true, label: "studentId" },
      teacherId: { type: "ref", ref: "teachers", required: true, label: "teacherId" },
      date:      { type: "date", required: true, notFuture: true, label: "Date" },
      status:    { type: "enum", required: true, values: ["present", "absent", "late", "leave"], label: "Status" },
      remarks:   { type: "string", max: 120, label: "Remarks" }
    },
    unique: [
      {
        fields: ["studentId", "teacherId", "date"],
        message: (r, existing) => `Attendance for student ${r.studentId} in this course on ${r.date} is already recorded (record ${existing.id}). Update it with PUT or PATCH instead.`
      }
    ],
    dependents: [],
    filters: ["studentId", "teacherId", "date", "status"],
    search: ["studentName", "rollNo", "course", "status"],
    sortable: ["id", "date", "status", "studentId", "teacherId", "createdAt"],
    defaultSort: "-date",
    decorate(record, db) {
      const s = db.students.get(record.studentId);
      const t = db.teachers.get(record.teacherId);
      return { studentName: s ? s.name : null, rollNo: s ? s.rollNo : null, teacherName: t ? t.name : null, course: t ? t.course : null };
    }
  },

  marks: {
    title: "Marks record",
    schema: {
      studentId:  { type: "ref", ref: "students", required: true, label: "studentId" },
      teacherId:  { type: "ref", ref: "teachers", required: true, label: "teacherId" },
      assessment: { type: "enum", required: true, values: ["quiz", "assignment", "lab", "mid", "final"], label: "Assessment" },
      title:      { type: "string", required: true, min: 2, max: 40, label: "Title" },
      obtained:   { type: "number", required: true, min: 0, label: "Obtained marks" },
      total:      { type: "number", required: true, positive: true, max: 100, label: "Total marks" }
    },
    unique: [
      {
        fields: ["studentId", "teacherId", "title"],
        message: (r, existing) => `Student ${r.studentId} already has marks for "${r.title}" in this course (record ${existing.id}).`
      }
    ],
    check(value) {
      return value.obtained > value.total
        ? [{ field: "obtained", message: `Obtained marks (${value.obtained}) cannot be more than total marks (${value.total}).` }]
        : [];
    },
    dependents: [],
    filters: ["studentId", "teacherId", "assessment"],
    search: ["studentName", "rollNo", "course", "title"],
    sortable: ["id", "title", "assessment", "obtained", "percentage", "studentId", "createdAt"],
    defaultSort: "id",
    decorate(record, db) {
      const s = db.students.get(record.studentId);
      const t = db.teachers.get(record.teacherId);
      const percentage = round1((record.obtained / record.total) * 100);
      return {
        studentName: s ? s.name : null, rollNo: s ? s.rollNo : null,
        teacherName: t ? t.name : null, course: t ? t.course : null,
        percentage, grade: gradeFor(percentage)
      };
    }
  }
};

/* Fields every record has that clients may send back but never change. */
export const READ_ONLY = ["id", "createdAt", "updatedAt", "attendancePercent", "marksPercent", "records",
  "studentName", "rollNo", "teacherName", "course", "percentage", "grade"];
