/* Page UI for Task 1: renders the biography object and the primitive types table.
   The lab answer itself is in script.js. */
(function () {
  const bio = biography;   // defined in script.js
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const chips = (items) => items.map((t) => '<span class="chip static">' + esc(t) + "</span>").join("");

  // ----- biography card -----
  document.getElementById("profile").innerHTML = `
    <div class="profile-top">
      <div class="avatar" aria-hidden="true">AR</div>
      <div>
        <h3>${esc(bio.name)}</h3>
        <p>${esc(bio.degreeProgram.title)} · ${esc(bio.degreeProgram.university)}, ${esc(bio.degreeProgram.campus)}</p>
      </div>
    </div>
    <dl class="facts">
      <div><dt>Hometown</dt><dd>${esc(bio.address.hometown)}</dd></div>
      <div><dt>Lives in</dt><dd>${esc(bio.address.city)}, ${esc(bio.address.country)}</dd></div>
      <div><dt>Class</dt><dd>${esc(bio.degreeProgram.section)} (${esc(bio.degreeProgram.shift)})</dd></div>
      <div><dt>Semester</dt><dd>${esc(bio.degreeProgram.semester)} · since ${esc(bio.degreeProgram.enrollmentYear)}</dd></div>
      <div><dt>Email</dt><dd>${esc(bio.contact.email)}</dd></div>
      <div><dt>GitHub</dt><dd>${esc(bio.contact.github)}</dd></div>
    </dl>
    <div><span class="label">Courses this semester</span><div class="chips" style="margin-top:6px">${chips(bio.degreeProgram.currentCourses)}</div></div>
    <div><span class="label">Skills</span><div class="chips" style="margin-top:6px">${chips(bio.skills)}</div></div>`;

  // ----- primitive types table (reads the var variables from script.js) -----
  const rows = [
    ["firstName", firstName], ["lastName", lastName], ["birthCity", birthCity],
    ["currentSemester", currentSemester], ["enrollmentYear", enrollmentYear],
    ["isStudent", isStudent], ["isOpenToFreelance", isOpenToFreelance],
    ["middleName", middleName], ["finalCGPA", finalCGPA]
  ];
  const show = (v) => (typeof v === "string" ? '"' + esc(v) + '"' : String(v));
  const typeName = (v) => (v === null ? "null" : typeof v);
  document.getElementById("typesTable").innerHTML =
    "<thead><tr><th>Variable</th><th>Value</th><th>Type</th></tr></thead><tbody>" +
    rows.map(([name, value]) =>
      `<tr><td>var ${name}</td><td>${show(value)}</td><td><span class="chip static">${typeName(value)}</span></td></tr>`
    ).join("") + "</tbody>";
})();
