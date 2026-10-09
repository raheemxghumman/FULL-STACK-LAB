/* ==========================================================================
   Student.js - the Student class is the DEFAULT export of this module
   ========================================================================== */

import { calculateAverage, calculateGPA, calculateGrade as letterGrade } from "./gradeUtils.js";   // named imports, one aliased

export default class Student {
  /**
   * @param {number} id
   * @param {string} name
   * @param {{ code: string, marks: number }[]} courses
   */
  constructor(id, name, courses = []) {
    this.id = id;
    this.name = name;
    this.courses = courses.map(({ code, marks }) => ({ code, marks }));   // own copy, input not shared
  }

  get marks() {
    return this.courses.map((course) => course.marks);
  }

  average() {
    return calculateAverage(this.marks);
  }

  gpa() {
    return calculateGPA(this.marks);
  }

  /** Overall letter grade based on the average. */
  overallGrade() {
    return this.courses.length === 0 ? "N/A" : letterGrade(this.average());
  }

  /** Plain object for the report (no class instance inside JSON). */
  toReportEntry() {
    return {
      id: this.id,
      name: this.name,
      courses: this.courses.map(({ code, marks }) => ({ code, marks, grade: letterGrade(marks) })),
      courseCount: this.courses.length,
      average: this.average(),
      gpa: this.gpa(),
      overallGrade: this.overallGrade()
    };
  }
}
