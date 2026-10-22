/* ==========================================================================
   lib/seed.js - starting data, loaded every time the API starts
   --------------------------------------------------------------------------
   Ids are given in insertion order (students 1-8, teachers 1-4), so the
   attendance and marks below can refer to them.
   ========================================================================== */

const students = [
  { rollNo: "241854", name: "Abdul Raheem",  email: "abdul.raheem@uni.edu.pk",  program: "BSCS",  semester: 5, section: "A" },
  { rollNo: "241801", name: "Ayesha Khan",   email: "ayesha.khan@uni.edu.pk",   program: "BSCS",  semester: 5, section: "A" },
  { rollNo: "241812", name: "Hamza Ali",     email: "hamza.ali@uni.edu.pk",     program: "BSCS",  semester: 5, section: "A" },
  { rollNo: "241823", name: "Fatima Zahra",  email: "fatima.zahra@uni.edu.pk",  program: "BSSE",  semester: 5, section: "B" },
  { rollNo: "241836", name: "Usman Tariq",   email: "usman.tariq@uni.edu.pk",   program: "BSSE",  semester: 5, section: "B" },
  { rollNo: "241847", name: "Zainab Ahmed",  email: "zainab.ahmed@uni.edu.pk",  program: "BSAI",  semester: 3, section: "A" },
  { rollNo: "241858", name: "Bilal Hussain", email: "bilal.hussain@uni.edu.pk", program: "BSAI",  semester: 3, section: "A" },
  { rollNo: "241869", name: "Hira Iqbal",    email: "hira.iqbal@uni.edu.pk",    program: "BSCYS", semester: 3, section: "B" }
];

const teachers = [
  { name: "Dr. Sana Javed",    email: "sana.javed@uni.edu.pk",    designation: "Assistant Professor", department: "Computer Science", course: "Full Stack Web Development", phone: "03001234567" },
  { name: "Imran Qadir",       email: "imran.qadir@uni.edu.pk",   designation: "Lecturer",            department: "Computer Science", course: "Database Systems",           phone: "03111234567" },
  { name: "Rabia Saleem",      email: "rabia.saleem@uni.edu.pk",  designation: "Lecturer",            department: "Software Engineering", course: "Operating Systems",      phone: "" },
  { name: "Dr. Kamran Shah",   email: "kamran.shah@uni.edu.pk",   designation: "Associate Professor", department: "Artificial Intelligence", course: "Artificial Intelligence", phone: "03211234567" }
];

/* Attendance for the first two courses over four class days.
   One letter per day: P present, A absent, L late, V leave. */
const DAYS = ["2026-10-14", "2026-10-16", "2026-10-19", "2026-10-21"];
const PATTERNS = {
  1: ["PPPP", "PPPL"],   // Abdul Raheem: course 1, course 2
  2: ["PPLP", "PPPP"],
  3: ["PAPP", "PPAP"],
  4: ["PPPP", "LPPP"],
  5: ["AAPA", "PAAV"],   // Usman: short attendance, shows the warning in his report
  6: ["PPPA", "PPPP"],
  7: ["PLPP", "APPP"],
  8: ["PPPP", "PPVP"]
};
const STATUS = { P: "present", A: "absent", L: "late", V: "leave" };

const attendance = [];
for (const [studentId, perCourse] of Object.entries(PATTERNS)) {
  perCourse.forEach((pattern, course) => {
    [...pattern].forEach((letter, day) => {
      attendance.push({ studentId: Number(studentId), teacherId: course + 1, date: DAYS[day], status: STATUS[letter], remarks: "" });
    });
  });
}

/* Marks: [quiz 1 /10, assignment 1 /10, mid /30] in course 1 and [quiz 1 /10, mid /30] in course 2 */
const SCORES = {
  1: [[9, 10, 27], [8, 24]],
  2: [[10, 9, 28], [9, 26]],
  3: [[7, 8, 21], [6, 19]],
  4: [[8, 9, 25], [9, 23]],
  5: [[4, 5, 12], [3, 11]],
  6: [[9, 8, 24], [7, 22]],
  7: [[6, 7, 18], [8, 20]],
  8: [[10, 10, 29], [9, 27]]
};

const marks = [];
for (const [studentId, [c1, c2]] of Object.entries(SCORES)) {
  const id = Number(studentId);
  marks.push(
    { studentId: id, teacherId: 1, assessment: "quiz",       title: "Quiz 1",       obtained: c1[0], total: 10 },
    { studentId: id, teacherId: 1, assessment: "assignment", title: "Assignment 1", obtained: c1[1], total: 10 },
    { studentId: id, teacherId: 1, assessment: "mid",        title: "Mid Term",     obtained: c1[2], total: 30 },
    { studentId: id, teacherId: 2, assessment: "quiz",       title: "Quiz 1",       obtained: c2[0], total: 10 },
    { studentId: id, teacherId: 2, assessment: "mid",        title: "Mid Term",     obtained: c2[1], total: 30 }
  );
}

export const SEED = { students, teachers, attendance, marks };
