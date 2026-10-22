/* ==========================================================================
   public/app.js - test UI for the Student Management System API
   --------------------------------------------------------------------------
   Every screen reads and writes through the API (transport.request), never
   through local variables, so what you see is exactly what the API returns.

   Views (hash routes)
     #dashboard   GET /api/stats and GET /api
     #students    CRUD table + report        (edit uses PUT)
     #teachers    CRUD table                 (edit uses PUT)
     #attendance  class register + CRUD table (status change uses PATCH)
     #marks       CRUD table                 (edit uses PATCH with changed fields only)
     #tester      send any request
     #checks      run the lab requirements as automated checks
   ========================================================================== */

import * as T from "./transport.js";
import { createChecks } from "./checks.js";
import { MODULES, gradeFor } from "../lib/modules.js";
import { todayISO } from "../lib/validate.js";

/* ---------- small helpers ------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const values = (module, field) => MODULES[module].schema[field].values;

const STATUS_TEXT = {
  0: "Network error", 200: "OK", 201: "Created", 204: "No Content", 302: "Found", 400: "Bad Request", 404: "Not Found",
  405: "Method Not Allowed", 409: "Conflict", 413: "Payload Too Large", 415: "Unsupported Media Type",
  422: "Unprocessable Entity", 500: "Internal Server Error"
};

const methodBadge = (m) => `<span class="m-badge m-${m.toLowerCase()}">${m}</span>`;
const statusPill = (s) => `<span class="s-pill s-${s >= 500 || s === 0 ? "5xx" : s >= 400 ? "4xx" : s >= 300 ? "3xx" : "2xx"}">${s} ${STATUS_TEXT[s] || ""}</span>`;

function pctBadge(v) {
  if (v === null || v === undefined) return '<span class="text-body-tertiary">—</span>';
  const tone = v < 50 ? "danger" : v < 75 ? "warning" : "success";
  return `<div class="pct"><div class="pct-bar"><span class="bg-${tone}" style="width:${Math.min(100, v)}%"></span></div><span class="pct-num text-${tone}-emphasis">${v}%</span></div>`;
}
const gradeBadge = (g) => g ? `<span class="grade grade-${g.replace("+", "p").replace("-", "m")}">${g}</span>` : "—";
const STATUS_ICON = { present: "bi-check-circle-fill", absent: "bi-x-circle-fill", late: "bi-clock-fill", leave: "bi-airplane-fill" };
const statusBadge = (s) => `<span class="att att-${s}"><i class="bi ${STATUS_ICON[s]}"></i>${cap(s)}</span>`;
const initials = (name) => String(name).replace(/^(Dr|Mr|Ms|Mrs)\.\s*/i, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const avatar = (name, hue) => `<span class="avatar" style="--h:${hue}">${esc(initials(name))}</span>`;

/** Highlights a JSON value for the code panes. */
function jsonHTML(value) {
  if (value === null || value === undefined) return '<span class="j-null">(no body)</span>';
  return esc(JSON.stringify(value, null, 2)).replace(
    /(&quot;(?:\\.|[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/g,
    (m, str, colon, lit, num) => str ? `<span class="${colon ? "j-key" : "j-str"}">${str}</span>${colon || ""}` : lit ? `<span class="j-lit">${lit}</span>` : `<span class="j-num">${num}</span>`
  );
}

function toast(title, body = "", variant = "success") {
  const icons = { success: "bi-check-circle-fill", danger: "bi-x-octagon-fill", warning: "bi-exclamation-triangle-fill", info: "bi-info-circle-fill" };
  const el = document.createElement("div");
  el.className = "toast border-0 shadow";
  el.setAttribute("role", variant === "danger" ? "alert" : "status");
  el.innerHTML = `<div class="toast-header"><i class="bi ${icons[variant]} text-${variant} me-2"></i><strong class="me-auto">${title}</strong>
    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button></div>${body ? `<div class="toast-body">${body}</div>` : ""}`;
  $("#toastHolder").appendChild(el);
  el.addEventListener("hidden.bs.toast", () => el.remove());
  new bootstrap.Toast(el, { delay: variant === "danger" ? 6000 : 3500 }).show();
}

const resultToast = (r, fallback) => toast(`${r.status} ${STATUS_TEXT[r.status] || ""}`, esc(r.body && (r.body.message || r.body.error) || fallback), r.ok ? "success" : r.status >= 500 || r.status === 0 ? "danger" : "warning");

async function withBusy(button, task) {
  const html = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${button.dataset.busy || "Working"}…`;
  try { return await task(); } finally { button.disabled = false; button.innerHTML = html; }
}

const api = (method, path, body, opts) => T.request(method, path, body, opts);
const hint = (el, method, path, r, extra = "") =>
  (el.innerHTML = `${methodBadge(method)} <span class="font-mono">${esc(path)}</span> <i class="bi bi-arrow-right mx-1"></i>${statusPill(r.status)} <span class="ms-1">${r.ms} ms${extra}</span>`);

/* Students and teachers, kept for the drop-downs and names. Refreshed after every change. */
const refs = { students: [], teachers: [] };
async function loadRefs() {
  const [s, t] = await Promise.all([api("GET", "/api/students?sort=name"), api("GET", "/api/teachers?sort=name")]);
  refs.students = s.ok ? s.body.data : [];
  refs.teachers = t.ok ? t.body.data : [];
}
const studentOptions = () => refs.students.map((s) => [s.id, `${s.name} (${s.rollNo})`]);
const teacherOptions = () => refs.teachers.map((t) => [t.id, `${t.course} · ${t.name}`]);

/* ---------- navigation ----------------------------------------------------- */

const VIEWS = {
  dashboard: { title: "Dashboard", eyebrow: "Overview", icon: "bi-grid-1x2-fill", load: loadDashboard },
  students: { title: "Students", eyebrow: "Module 1 · Create, Read, Update, Delete", icon: "bi-people-fill", load: () => openTable("students") },
  teachers: { title: "Teachers", eyebrow: "Module 2 · Create, Read, Update, Delete", icon: "bi-person-workspace", load: () => openTable("teachers") },
  attendance: { title: "Attendance", eyebrow: "Module 3 · Create, Read, Update, Delete", icon: "bi-calendar2-check-fill", load: loadAttendanceView },
  marks: { title: "Marks", eyebrow: "Module 4 · Create, Read, Update, Delete", icon: "bi-clipboard2-data-fill", load: () => openTable("marks") },
  tester: { title: "API tester", eyebrow: "Send any request", icon: "bi-terminal-fill", load: () => {} },
  checks: { title: "Requirement checks", eyebrow: "Automated testing of the lab tasks", icon: "bi-patch-check-fill", load: () => {} }
};
let current = "dashboard";

$$("[data-nav]").forEach((nav) => {
  nav.innerHTML = Object.entries(VIEWS).map(([key, v], i) =>
    `${i === 5 ? '<div class="nav-label">Testing</div>' : i === 1 ? '<div class="nav-label">Modules</div>' : ""}
     <a class="nav-item-link" href="#${key}" data-link="${key}"><i class="bi ${v.icon}"></i><span>${v.title}</span></a>`).join("");
});

async function show(view) {
  if (!VIEWS[view]) view = "dashboard";
  current = view;
  $$(".view").forEach((s) => (s.hidden = s.dataset.view !== view));
  $$("[data-link]").forEach((a) => {
    a.classList.toggle("active", a.dataset.link === view);
    if (a.dataset.link === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $("#viewTitle").textContent = VIEWS[view].title;
  $("#viewEyebrow").textContent = VIEWS[view].eyebrow;
  document.title = `${VIEWS[view].title} · Student Management API`;
  bootstrap.Offcanvas.getInstance($("#mobileNav"))?.hide();
  await VIEWS[view].load();
}
window.addEventListener("hashchange", () => show(location.hash.slice(1)));

/* ---------- mode (live server or in-page API) ------------------------------ */

function renderMode() {
  const { mode, base } = T.getMode();
  const pill = $("#modePill");
  pill.classList.toggle("is-live", mode === "server");
  $("#modeLabel").textContent = mode === "server" ? `Live server · ${base.replace(/^https?:\/\//, "")}` : "In-page API (no server)";
  $("#modeHelp").innerHTML = mode === "server"
    ? `Requests go over HTTP to <strong>${esc(base)}</strong>. The data lives in that Node process and is lost when it stops.`
    : `No Node server is connected, so <code>lib/router.js</code> runs inside this page and the data lives in this tab. Run <code>npm start</code> and connect to use the real server.`;
}
T.onChange(renderMode);
T.onChange(renderLog);

$("#connectBtn").addEventListener("click", async (e) => {
  try {
    await withBusy(e.currentTarget, () => T.connect($("#serverUrl").value));
    toast("Connected", `Requests now go to ${esc(T.getMode().base)}.`);
    await loadRefs();
    show(current);
  } catch (err) {
    toast("Could not connect", `${esc(err.message)}. Start it with <code>npm start</code> in Lab 7/Part 1.`, "danger");
  }
});
$("#browserBtn").addEventListener("click", async () => {
  T.useBrowser();
  toast("Using the in-page API", "The same router code now runs inside this page.", "info");
  await loadRefs();
  show(current);
});
$("#resetBtn").addEventListener("click", async (e) => {
  const r = await withBusy(e.currentTarget, () => api("POST", "/api/reset"));
  resultToast(r);
  await loadRefs();
  show(current);
});

/* ---------- network log ---------------------------------------------------- */

function renderLog() {
  const log = T.getLog();
  $("#logCount").textContent = log.length;
  $("#logList").innerHTML = log.length ? log.map((e) => `
    <details class="log-item">
      <summary>
        ${methodBadge(e.method)}<span class="font-mono log-path">${esc(e.path)}</span>
        <span class="ms-auto d-flex align-items-center gap-2">${statusPill(e.status)}<span class="small text-body-secondary">${e.ms} ms</span></span>
      </summary>
      <div class="log-detail">
        <div class="small text-body-secondary mb-1">${e.time.toLocaleTimeString()} · ${e.mode === "server" ? "HTTP to the Node server" : "in-page API"} · from ${e.source === "checks" ? "requirement checks" : "the UI"}</div>
        ${e.request ? `<div class="small fw-semibold">Request body</div><pre class="code-view small">${jsonHTML(tryParse(e.request))}</pre>` : ""}
        <div class="small fw-semibold">Response body</div><pre class="code-view small">${jsonHTML(e.response)}</pre>
      </div>
    </details>`).join("") : '<p class="text-body-secondary small p-3 mb-0">No requests yet.</p>';
}
const tryParse = (s) => { try { return JSON.parse(s); } catch { return s; } };
$("#clearLog").addEventListener("click", T.clearLog);

/* ---------- dashboard ------------------------------------------------------ */

async function loadDashboard() {
  const r = await api("GET", "/api/stats");
  if (!r.ok) return;
  const s = r.body.data;
  const att = s.attendance;
  const programs = Object.entries(s.byProgram).map(([p, n]) => `${p} ${n}`).join(" · ");
  const cards = [
    { label: "Students", value: s.counts.students, sub: programs || "No students", icon: "bi-people-fill", tone: "indigo", link: "students" },
    { label: "Teachers", value: s.counts.teachers, sub: `${refs.teachers.length ? new Set(refs.teachers.map((t) => t.department)).size : 0} departments`, icon: "bi-person-workspace", tone: "teal", link: "teachers" },
    { label: "Attendance records", value: s.counts.attendance, sub: att.percentage === null ? "None yet" : `${att.percentage}% attended (present + late)`, icon: "bi-calendar2-check-fill", tone: "amber", link: "attendance" },
    { label: "Marks records", value: s.counts.marks, sub: s.averageMarks === null ? "None yet" : `Average ${s.averageMarks}% · grade ${gradeFor(s.averageMarks)}`, icon: "bi-clipboard2-data-fill", tone: "rose", link: "marks" }
  ];
  $("#statCards").innerHTML = cards.map((c) => `
    <div class="col-sm-6 col-xl-3">
      <a class="card stat-card tone-${c.tone}" href="#${c.link}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div></div>
            <span class="stat-icon"><i class="bi ${c.icon}"></i></span>
          </div>
          <div class="stat-sub">${esc(c.sub)}</div>
        </div>
      </a>
    </div>`).join("");

  const total = Object.values(att.byStatus).reduce((a, b) => a + b, 0);
  $("#attSummary").textContent = total ? `${total} records · latest class ${att.latestDate}` : "No attendance recorded yet.";
  $("#attBar").innerHTML = Object.entries(att.byStatus).map(([k, n]) => n ? `<span class="seg att-bg-${k}" style="flex:${n}" title="${cap(k)}: ${n}"></span>` : "").join("");
  $("#attLegend").innerHTML = Object.entries(att.byStatus).map(([k, n]) =>
    `<span class="d-inline-flex align-items-center gap-1"><span class="legend-dot att-bg-${k}"></span>${cap(k)} <strong>${n}</strong> <span class="text-body-secondary">(${total ? Math.round((n / total) * 100) : 0}%)</span></span>`).join("");

  const person = (p, right) => `
    <li><button class="person-row" type="button" data-report="${p.id}">${avatar(p.name, (p.id * 47) % 360)}
      <span class="min-w-0 text-start"><span class="d-block fw-semibold text-truncate">${esc(p.name)}</span><span class="small text-body-secondary">${esc(p.rollNo)}</span></span>
      <span class="ms-auto">${right}</span></button></li>`;
  $("#lowList").innerHTML = s.lowAttendance.length ? s.lowAttendance.map((p) => person(p, `<span class="badge text-bg-warning">${p.attendancePercent}%</span>`)).join("") : '<li class="small text-body-secondary">Everyone is above 75%.</li>';
  $("#topList").innerHTML = s.topStudents.length ? s.topStudents.map((p) => person(p, `${gradeBadge(p.grade)} <span class="small ms-1">${p.marksPercent}%</span>`)).join("") : '<li class="small text-body-secondary">No marks yet.</li>';

}

// GET /api lists every route; it fills the endpoint card and the tester's path suggestions
async function loadEndpoints() {
  const index = await api("GET", "/api");
  if (!index.ok) return;
  $("#endpointList").innerHTML = index.body.endpoints.map((e) =>
    `<div class="endpoint">${methodBadge(e.method)}<span class="font-mono">${esc(e.path)}</span><span class="endpoint-desc">${esc(e.description)}</span></div>`).join("");
  $("#tPaths").innerHTML = [...new Set(index.body.endpoints.map((e) => e.path.replace(":id", "1")))].map((p) => `<option value="${esc(p)}">`).join("");
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-report]");
  if (b) openReport(Number(b.dataset.report));
});

/* ---------- tables for the four modules ------------------------------------ */

const sel = (key, label, options) => ({ key, type: "select", label, options });
const TABLES = {
  students: {
    newLabel: "New student",
    filters: () => [
      { key: "q", type: "search", placeholder: "Search name, roll no or email" },
      sel("program", "All programs", values("students", "program")),
      sel("semester", "All semesters", [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, `Semester ${n}`])),
      sel("sort", null, [["rollNo", "Roll no"], ["name", "Name A–Z"], ["-name", "Name Z–A"], ["-semester", "Semester (high first)"]])
    ],
    head: ["Roll no", "Student", "Program", "Sem · Sec", "Attendance", "Marks", ""],
    row: (s) => `
      <td class="font-mono fw-semibold">${esc(s.rollNo)}</td>
      <td><div class="d-flex align-items-center gap-2">${avatar(s.name, (s.id * 47) % 360)}<div class="min-w-0"><div class="fw-semibold">${esc(s.name)}</div><div class="small text-body-secondary text-truncate">${esc(s.email)}</div></div></div></td>
      <td><span class="badge rounded-pill text-bg-light border">${esc(s.program)}</span></td>
      <td>${s.semester} · ${esc(s.section)}</td>
      <td>${pctBadge(s.attendancePercent)}</td>
      <td>${pctBadge(s.marksPercent)}</td>
      <td class="text-end text-nowrap">${actions(s.id, true)}</td>`
  },
  teachers: {
    newLabel: "New teacher",
    filters: () => [
      { key: "q", type: "search", placeholder: "Search name, course or department" },
      sel("designation", "All designations", values("teachers", "designation")),
      sel("sort", null, [["name", "Name A–Z"], ["course", "Course A–Z"], ["department", "Department"], ["-createdAt", "Newest first"]])
    ],
    head: ["Teacher", "Designation", "Department", "Course", "Phone", "Records", ""],
    row: (t) => `
      <td><div class="d-flex align-items-center gap-2">${avatar(t.name, (t.id * 83 + 160) % 360)}<div class="min-w-0"><div class="fw-semibold">${esc(t.name)}</div><div class="small text-body-secondary text-truncate">${esc(t.email)}</div></div></div></td>
      <td>${esc(t.designation)}</td>
      <td>${esc(t.department)}</td>
      <td class="fw-semibold">${esc(t.course)}</td>
      <td class="font-mono small">${esc(t.phone) || '<span class="text-body-tertiary">—</span>'}</td>
      <td class="small"><span title="Attendance records"><i class="bi bi-calendar2-check me-1"></i>${t.records.attendance}</span> <span class="ms-2" title="Marks records"><i class="bi bi-clipboard2-data me-1"></i>${t.records.marks}</span></td>
      <td class="text-end text-nowrap">${actions(t.id)}</td>`
  },
  attendance: {
    newLabel: "New record",
    filters: () => [
      { key: "q", type: "search", placeholder: "Search student or course" },
      sel("teacherId", "All courses", teacherOptions()),
      { key: "date", type: "date" },
      sel("status", "Any status", values("attendance", "status").map((s) => [s, cap(s)])),
      sel("sort", null, [["-date", "Newest date"], ["date", "Oldest date"], ["status", "Status"]])
    ],
    head: ["Date", "Student", "Course", "Status (PATCH)", "Remarks", ""],
    row: (a) => `
      <td class="font-mono text-nowrap">${esc(a.date)}</td>
      <td><div class="fw-semibold">${esc(a.studentName)}</div><div class="small text-body-secondary font-mono">${esc(a.rollNo)}</div></td>
      <td>${esc(a.course)}</td>
      <td><select class="form-select form-select-sm status-select att-${a.status}" data-patch-status="${a.id}" aria-label="Status">${values("attendance", "status").map((s) => `<option value="${s}" ${s === a.status ? "selected" : ""}>${cap(s)}</option>`).join("")}</select></td>
      <td class="small text-body-secondary">${esc(a.remarks) || "—"}</td>
      <td class="text-end text-nowrap">${actions(a.id)}</td>`
  },
  marks: {
    newLabel: "Add marks",
    filters: () => [
      { key: "q", type: "search", placeholder: "Search student, course or title" },
      sel("studentId", "All students", studentOptions()),
      sel("teacherId", "All courses", teacherOptions()),
      sel("assessment", "All assessments", values("marks", "assessment").map((s) => [s, cap(s)])),
      sel("sort", null, [["id", "Order added"], ["-percentage", "Highest %"], ["percentage", "Lowest %"], ["title", "Title"]])
    ],
    head: ["Student", "Course", "Assessment", "Marks", "Percentage", "Grade", ""],
    row: (m) => `
      <td><div class="fw-semibold">${esc(m.studentName)}</div><div class="small text-body-secondary font-mono">${esc(m.rollNo)}</div></td>
      <td>${esc(m.course)}</td>
      <td><div class="fw-semibold">${esc(m.title)}</div><span class="badge text-bg-light border">${cap(m.assessment)}</span></td>
      <td class="font-mono">${m.obtained} / ${m.total}</td>
      <td>${pctBadge(m.percentage)}</td>
      <td>${gradeBadge(m.grade)}</td>
      <td class="text-end text-nowrap">${actions(m.id)}</td>`
  }
};

function actions(id, report = false) {
  return `${report ? `<button class="btn btn-sm btn-light" type="button" data-report="${id}" title="Report"><i class="bi bi-file-earmark-bar-graph"></i><span class="visually-hidden">Report</span></button>` : ""}
    <button class="btn btn-sm btn-light" type="button" data-edit="${id}" title="Edit"><i class="bi bi-pencil"></i><span class="visually-hidden">Edit</span></button>
    <button class="btn btn-sm btn-light text-danger" type="button" data-delete="${id}" title="Delete"><i class="bi bi-trash3"></i><span class="visually-hidden">Delete</span></button>`;
}

const filterState = { students: {}, teachers: {}, attendance: {}, marks: {} };
const rowsCache = { students: [], teachers: [], attendance: [], marks: [] };

function renderToolbar(module) {
  const state = filterState[module];
  const box = $(`#${module}Toolbar`);
  box.innerHTML = TABLES[module].filters().map((f) => {
    const v = state[f.key] ?? "";
    if (f.type === "search") return `<div class="toolbar-search"><i class="bi bi-search"></i><input type="search" class="form-control form-control-sm" data-filter="q" value="${esc(v)}" placeholder="${esc(f.placeholder)}" aria-label="${esc(f.placeholder)}"></div>`;
    if (f.type === "date") return `<input type="date" class="form-control form-control-sm w-auto" data-filter="${f.key}" value="${esc(v)}" aria-label="Date">`;
    const opts = f.options.map((o) => (Array.isArray(o) ? o : [o, o]));
    return `<select class="form-select form-select-sm w-auto" data-filter="${f.key}" aria-label="${esc(f.label || "Sort")}">
      ${f.label ? `<option value="">${esc(f.label)}</option>` : ""}${opts.map(([val, text]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select>`;
  }).join("") + `<button class="btn btn-sm btn-primary ms-auto" type="button" data-new="${module}"><i class="bi bi-plus-lg me-1"></i>${TABLES[module].newLabel}</button>`;
}

// Opening a view rebuilds its filters (drop-downs may have new students or courses), then loads the rows
async function openTable(module) {
  await loadRefs();
  renderToolbar(module);
  await loadTable(module);
}

async function loadTable(module) {
  const query = new URLSearchParams(Object.entries(filterState[module]).filter(([, v]) => v !== "" && v !== undefined)).toString();
  const path = `/api/${module}${query ? "?" + query : ""}`;
  const r = await api("GET", path);
  const body = $(`#${module}Body`);
  $(`#${module}Head`).innerHTML = `<tr>${TABLES[module].head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr>`;
  if (!r.ok) {
    body.innerHTML = `<tr><td colspan="9" class="text-danger small">${esc(r.body && r.body.error)}</td></tr>`;
  } else {
    rowsCache[module] = r.body.data;
    body.innerHTML = r.body.data.length
      ? r.body.data.map((row) => `<tr data-row="${row.id}">${TABLES[module].row(row)}</tr>`).join("")
      : `<tr><td colspan="9" class="empty-row"><i class="bi bi-inbox"></i>No ${module} match these filters.</td></tr>`;
  }
  hint($(`#${module}Hint`), "GET", path, r, r.ok ? ` · showing ${r.body.count} of ${r.body.total}` : "");
}

// Filters: typing waits a moment, selects apply at once
let filterTimer;
document.addEventListener("input", (e) => {
  const f = e.target.closest("[data-filter]");
  if (!f) return;
  const module = f.closest(".view").dataset.view;
  filterState[module][f.dataset.filter] = f.value;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => loadTable(module), f.type === "search" ? 250 : 0);
});

document.addEventListener("click", (e) => {
  const view = e.target.closest(".view");
  const module = view && view.dataset.view;
  const add = e.target.closest("[data-new]");
  if (add) return openForm(add.dataset.new);
  const edit = e.target.closest("[data-edit]");
  if (edit && TABLES[module]) return openForm(module, rowsCache[module].find((r) => r.id === Number(edit.dataset.edit)));
  const del = e.target.closest("[data-delete]");
  if (del && TABLES[module]) return confirmDelete(module, rowsCache[module].find((r) => r.id === Number(del.dataset.delete)));
});

// Inline status change in the attendance table: PATCH with one field
document.addEventListener("change", async (e) => {
  const s = e.target.closest("[data-patch-status]");
  if (!s) return;
  s.disabled = true;
  const r = await api("PATCH", `/api/attendance/${s.dataset.patchStatus}`, { status: s.value });
  resultToast(r);
  await loadTable("attendance");
});

/* ---------- create / edit form --------------------------------------------- */

const f = (name, label, type, extra = {}) => ({ name, label, type, col: "col-md-6", ...extra });
const FORMS = {
  students: () => [
    f("rollNo", "Roll number", "text", { placeholder: "241854", mono: true }),
    f("name", "Full name", "text", { placeholder: "Abdul Raheem" }),
    f("email", "Email", "email", { placeholder: "name@uni.edu.pk", col: "col-12" }),
    f("program", "Program", "select", { options: values("students", "program"), col: "col-md-4" }),
    f("semester", "Semester", "select", { options: [1, 2, 3, 4, 5, 6, 7, 8], number: true, col: "col-md-4" }),
    f("section", "Section", "select", { options: values("students", "section"), col: "col-md-4" })
  ],
  teachers: () => [
    f("name", "Full name", "text", { placeholder: "Dr. Sana Javed" }),
    f("email", "Email", "email", { placeholder: "name@uni.edu.pk" }),
    f("designation", "Designation", "select", { options: values("teachers", "designation") }),
    f("department", "Department", "text", { placeholder: "Computer Science" }),
    f("course", "Course taught", "text", { placeholder: "Full Stack Web Development" }),
    f("phone", "Phone (optional)", "text", { placeholder: "03001234567", mono: true })
  ],
  attendance: () => [
    f("studentId", "Student", "select", { options: studentOptions(), number: true }),
    f("teacherId", "Course", "select", { options: teacherOptions(), number: true }),
    f("date", "Date", "date"),
    f("status", "Status", "select", { options: values("attendance", "status").map((s) => [s, cap(s)]) }),
    f("remarks", "Remarks (optional)", "text", { col: "col-12", placeholder: "e.g. came 10 minutes late" })
  ],
  marks: () => [
    f("studentId", "Student", "select", { options: studentOptions(), number: true }),
    f("teacherId", "Course", "select", { options: teacherOptions(), number: true }),
    f("assessment", "Assessment", "select", { options: values("marks", "assessment").map((s) => [s, cap(s)]), col: "col-md-4" }),
    f("title", "Title", "text", { placeholder: "Quiz 2", col: "col-md-8" }),
    f("obtained", "Obtained", "number", { number: true, step: "0.5", col: "col-md-4" }),
    f("total", "Total", "number", { number: true, step: "0.5", col: "col-md-4" }),
    { name: "_preview", type: "preview", col: "col-md-4" }
  ]
};
// Students and teachers are replaced with PUT; marks are changed with PATCH (only the fields you edit)
const EDIT_METHOD = { students: "PUT", teachers: "PUT", attendance: "PUT", marks: "PATCH" };

const recordModal = new bootstrap.Modal($("#recordModal"));
let formState = null;

function fieldHTML(field, value) {
  if (field.type === "preview") return `<div class="${field.col}"><div class="form-label">Result</div><div class="preview-box" id="marksPreview">—</div></div>`;
  const id = `fld-${field.name}`;
  let control;
  if (field.type === "select") {
    const opts = field.options.map((o) => (Array.isArray(o) ? o : [o, o]));
    control = `<select class="form-select" id="${id}" name="${field.name}"><option value="">Choose…</option>${opts.map(([v, t]) =>
      `<option value="${esc(v)}" ${String(v) === String(value ?? "") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  } else {
    control = `<input class="form-control ${field.mono ? "font-mono" : ""}" id="${id}" name="${field.name}" type="${field.type === "email" ? "text" : field.type}" ${field.step ? `step="${field.step}"` : ""} value="${esc(value ?? "")}" placeholder="${esc(field.placeholder || "")}" autocomplete="off">`;
  }
  return `<div class="${field.col}"><label class="form-label" for="${id}">${esc(field.label)}</label>${control}<div class="invalid-feedback" data-feedback="${field.name}"></div></div>`;
}

async function openForm(module, record = null) {
  await loadRefs();
  const fields = FORMS[module]();
  const editing = Boolean(record);
  const method = editing ? EDIT_METHOD[module] : "POST";
  const path = editing ? `/api/${module}/${record.id}` : `/api/${module}`;
  formState = { module, record, fields, method, path };

  const defaults = { attendance: { date: todayISO(), status: "present" }, students: { section: "A" }, marks: { total: 10 } };
  const data = record || defaults[module] || {};
  $("#recordModalTitle").textContent = `${editing ? "Edit" : "New"} ${MODULES[module].title.toLowerCase()}${editing ? ` #${record.id}` : ""}`;
  $("#recordModalRequest").innerHTML = `${methodBadge(method)} ${esc(path)}${method === "PATCH" ? ' <span class="text-body-secondary">(only changed fields are sent)</span>' : method === "PUT" ? ' <span class="text-body-secondary">(the whole record is sent)</span>' : ""}`;
  $("#recordFields").innerHTML = fields.map((fl) => fieldHTML(fl, data[fl.name])).join("");
  $("#recordError").classList.add("d-none");
  $("#recordSave").textContent = editing ? `Save (${method})` : "Create (POST)";
  if (module === "marks") updatePreview();
  recordModal.show();
}

function readForm() {
  const out = {};
  for (const fl of formState.fields) {
    if (fl.type === "preview") continue;
    const el = $(`#fld-${fl.name}`);
    const raw = el.value;
    // Numbers are sent as numbers; anything else is sent exactly as typed so the API can judge it.
    out[fl.name] = fl.number && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  }
  return out;
}

function updatePreview() {
  const box = $("#marksPreview");
  if (!box) return;
  const o = Number($("#fld-obtained").value), t = Number($("#fld-total").value);
  if (!t || Number.isNaN(o)) { box.innerHTML = "—"; return; }
  const pct = Math.round((o / t) * 1000) / 10;
  box.innerHTML = o > t ? '<span class="text-danger small">more than total</span>' : `${pct}% ${gradeBadge(gradeFor(pct))}`;
}
$("#recordForm").addEventListener("input", (e) => {
  e.target.classList.remove("is-invalid");
  if (formState && formState.module === "marks") updatePreview();
});

$("#recordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { module, record, method, path } = formState;
  let body = readForm();
  if (method === "PATCH") {
    body = Object.fromEntries(Object.entries(body).filter(([k, v]) => String(v) !== String(record[k] ?? "")));
    if (!Object.keys(body).length) { recordModal.hide(); toast("Nothing changed", "No request was sent.", "info"); return; }
  }
  $$("#recordFields .is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  $("#recordError").classList.add("d-none");

  const r = await withBusy($("#recordSave"), () => api(method, path, body));
  if (r.ok) {
    recordModal.hide();
    resultToast(r);
    await loadRefs();
    loadView(module);
    return;
  }
  // 422 / 409: put each message under its field
  const details = (r.body && r.body.details) || [];
  details.forEach((d) => {
    const input = $(`#fld-${d.field}`);
    if (input) { input.classList.add("is-invalid"); $(`[data-feedback="${d.field}"]`).textContent = d.message; }
  });
  const box = $("#recordError");
  box.innerHTML = `${statusPill(r.status)} <span class="ms-1">${esc(r.body && r.body.error)}</span>${details.filter((d) => !$(`#fld-${d.field}`)).map((d) => `<div class="mt-1">• ${esc(d.message)}</div>`).join("")}`;
  box.classList.remove("d-none");
  ($("#recordFields .is-invalid") || box).focus?.();
});

const loadView = (module) => (module === "attendance" ? loadAttendanceView() : loadTable(module));

/* ---------- delete with confirmation (and cascade on 409) ------------------ */

const confirmModal = new bootstrap.Modal($("#confirmModal"));
let pendingDelete = null;

function labelOf(module, r) {
  if (module === "students") return `${r.name} (${r.rollNo})`;
  if (module === "teachers") return `${r.name}, ${r.course}`;
  if (module === "attendance") return `${r.studentName} · ${r.course} · ${r.date}`;
  return `${r.studentName} · ${r.course} · ${r.title}`;
}

function confirmDelete(module, record) {
  pendingDelete = { module, record, cascade: false };
  $("#confirmTitle").textContent = `Delete this ${MODULES[module].title.toLowerCase()}?`;
  $("#confirmBody").innerHTML = `<p class="mb-0"><strong>${esc(labelOf(module, record))}</strong> will be removed.</p>`;
  $("#confirmRequest").innerHTML = `${methodBadge("DELETE")} /api/${module}/${record.id}`;
  $("#confirmYes").textContent = "Delete";
  confirmModal.show();
}

$("#confirmYes").addEventListener("click", async (e) => {
  const { module, record, cascade } = pendingDelete;
  const path = `/api/${module}/${record.id}${cascade ? "?cascade=true" : ""}`;
  const r = await withBusy(e.currentTarget, () => api("DELETE", path));
  if (r.status === 409 && !cascade) {
    // The API refused because related records exist: offer the cascade delete
    pendingDelete.cascade = true;
    $("#confirmBody").innerHTML = `<div class="alert alert-warning small mb-2">${statusPill(409)} ${esc(r.body.error)}</div>
      <p class="mb-0">Delete <strong>${esc(labelOf(module, record))}</strong> together with these records?</p>`;
    $("#confirmRequest").innerHTML = `${methodBadge("DELETE")} ${esc(path)}?cascade=true`;
    $("#confirmYes").textContent = "Delete everything";
    return;
  }
  confirmModal.hide();
  resultToast(r);
  await loadRefs();
  loadView(module);
});

/* ---------- student report ------------------------------------------------- */

const reportPanel = new bootstrap.Offcanvas($("#reportPanel"));

async function openReport(id) {
  const path = `/api/students/${id}/report`;
  $("#reportBody").innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
  reportPanel.show();
  const r = await api("GET", path);
  $("#reportRequest").innerHTML = `${methodBadge("GET")} ${esc(path)} ${statusPill(r.status)}`;
  if (!r.ok) { $("#reportBody").innerHTML = `<div class="alert alert-danger">${esc(r.body.error)}</div>`; return; }
  const { student: s, attendance: a, marks: m, courses, warnings } = r.body.data;
  $("#reportTitle").textContent = s.name;
  const ring = (pct, label, tone) => `<div class="ring" style="--p:${pct ?? 0};--c:var(--bs-${tone})"><div><strong>${pct ?? "—"}${pct === null ? "" : "%"}</strong><span>${label}</span></div></div>`;
  $("#reportBody").innerHTML = `
    <div class="d-flex align-items-center gap-3 mb-3">${avatar(s.name, (s.id * 47) % 360)}
      <div><div class="fw-bold">${esc(s.name)}</div><div class="small text-body-secondary">${esc(s.rollNo)} · ${esc(s.program)} · Semester ${s.semester}${esc(s.section)} · ${esc(s.email)}</div></div></div>
    ${warnings.map((w) => `<div class="alert alert-warning py-2 small"><i class="bi bi-exclamation-triangle me-1"></i>${esc(w)}</div>`).join("")}
    <div class="d-flex gap-3 mb-3">
      ${ring(a.percentage, "attendance", a.percentage !== null && a.percentage < 75 ? "warning" : "success")}
      ${ring(m.percentage, `marks · ${m.grade || "—"}`, m.percentage !== null && m.percentage < 50 ? "danger" : "primary")}
      <div class="small align-self-center">
        ${["present", "late", "absent", "leave"].map((k) => `<div class="d-flex gap-2"><span class="legend-dot att-bg-${k} mt-1"></span>${cap(k)} <strong class="ms-auto">${a[k]}</strong></div>`).join("")}
      </div>
    </div>
    <h3 class="h6 fw-bold">Courses</h3>
    ${courses.length ? courses.map((c) => `
      <div class="report-course">
        <div class="d-flex justify-content-between gap-2"><div><div class="fw-semibold">${esc(c.course)}</div><div class="small text-body-secondary">${esc(c.teacher)}</div></div>
          <div class="text-end">${gradeBadge(c.marks.grade)}<div class="small text-body-secondary">${c.marks.obtained}/${c.marks.total}</div></div></div>
        <div class="small mt-2">Attendance ${pctBadge(c.attendance.percentage)}</div>
        <div class="small mt-1">Marks ${pctBadge(c.marks.percentage)}</div>
        ${c.marks.assessments.length ? `<div class="d-flex flex-wrap gap-1 mt-2">${c.marks.assessments.map((x) => `<span class="badge text-bg-light border fw-normal">${esc(x.title)} ${x.obtained}/${x.total}</span>`).join("")}</div>` : ""}
      </div>`).join("") : '<p class="small text-body-secondary">No attendance or marks yet.</p>'}`;
}

/* ---------- attendance: class register + table ----------------------------- */

let register = { rows: new Map() };

async function loadAttendanceView() {
  await loadRefs();
  const course = $("#regCourse");
  const keep = course.value;
  course.innerHTML = teacherOptions().map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("");
  if (keep && refs.teachers.some((t) => String(t.id) === keep)) course.value = keep;
  else if (refs.teachers.length) {
    // start on the course that has the most attendance, so the register opens with data
    course.value = refs.teachers.reduce((best, t) => (t.records.attendance > best.records.attendance ? t : best)).id;
  }
  if (!$("#regDate").value) {
    const stats = await api("GET", "/api/stats");
    $("#regDate").value = (stats.ok && stats.body.data.attendance.latestDate) || todayISO();
  }
  renderToolbar("attendance");
  await Promise.all([loadRegister(), loadTable("attendance")]);
}

async function loadRegister() {
  const teacherId = $("#regCourse").value, date = $("#regDate").value;
  if (!teacherId || !date) { $("#register").innerHTML = '<p class="small text-body-secondary mb-0">Add a teacher first, then pick a date.</p>'; return; }
  const path = `/api/attendance?teacherId=${teacherId}&date=${date}`;
  const r = await api("GET", path);
  register = { teacherId: Number(teacherId), date, rows: new Map((r.ok ? r.body.data : []).map((a) => [a.studentId, a])) };
  const statuses = ["present", "late", "absent", "leave"];
  $("#register").innerHTML = refs.students.length ? refs.students.slice().sort((a, b) => a.rollNo.localeCompare(b.rollNo)).map((s) => {
    const existing = register.rows.get(s.id);
    const chosen = existing ? existing.status : "";
    return `<div class="reg-row" data-student="${s.id}">
      <div class="d-flex align-items-center gap-2 min-w-0">${avatar(s.name, (s.id * 47) % 360)}<div class="min-w-0"><div class="fw-semibold text-truncate">${esc(s.name)}</div><div class="small text-body-secondary font-mono">${esc(s.rollNo)}${existing ? ` · record #${existing.id}` : ""}</div></div></div>
      <div class="btn-group btn-group-sm reg-choices" role="group" aria-label="Status for ${esc(s.name)}">
        ${statuses.map((st) => `<input type="radio" class="btn-check" name="reg-${s.id}" id="reg-${s.id}-${st}" value="${st}" ${chosen === st ? "checked" : ""}><label class="btn reg-${st}" for="reg-${s.id}-${st}">${cap(st)}</label>`).join("")}
        <input type="radio" class="btn-check" name="reg-${s.id}" id="reg-${s.id}-none" value="" ${chosen ? "" : "checked"}><label class="btn reg-none" for="reg-${s.id}-none" title="Not marked">–</label>
      </div></div>`;
  }).join("") : '<p class="small text-body-secondary mb-0">No students yet.</p>';
  $("#regInfo").innerHTML = `${register.rows.size} of ${refs.students.length} students already marked · loaded with ${methodBadge("GET")} <span class="font-mono">${esc(path)}</span>`;
}

$("#regCourse").addEventListener("change", loadRegister);
$("#regDate").addEventListener("change", loadRegister);
$("#regAllPresent").addEventListener("click", () => $$('#register input[value="present"]').forEach((i) => (i.checked = true)));

$("#regSave").addEventListener("click", async (e) => {
  const ops = [];
  $$("#register .reg-row").forEach((row) => {
    const studentId = Number(row.dataset.student);
    const chosen = ($("input:checked", row) || {}).value || "";
    const existing = register.rows.get(studentId);
    if (!existing && chosen) ops.push(["POST", "/api/attendance", { studentId, teacherId: register.teacherId, date: register.date, status: chosen }]);
    else if (existing && chosen && chosen !== existing.status) ops.push(["PATCH", `/api/attendance/${existing.id}`, { status: chosen }]);
    else if (existing && !chosen) ops.push(["DELETE", `/api/attendance/${existing.id}`]);
  });
  if (!ops.length) { toast("Nothing to save", "The register already matches the API.", "info"); return; }
  const results = await withBusy(e.currentTarget, () => Promise.all(ops.map(([m, p, b]) => api(m, p, b))));
  const count = (m) => ops.filter((o, i) => o[0] === m && results[i].ok).length;
  const failed = results.filter((r) => !r.ok);
  toast(failed.length ? "Saved with problems" : "Register saved",
    `${count("POST")} created (POST) · ${count("PATCH")} updated (PATCH) · ${count("DELETE")} removed (DELETE)${failed.length ? `<br>${failed.map((r) => esc(r.body.error)).join("<br>")}` : ""}`,
    failed.length ? "warning" : "success");
  await loadRefs();
  await Promise.all([loadRegister(), loadTable("attendance")]);
});

/* ---------- API tester ----------------------------------------------------- */

const EXAMPLES = [
  ["List students", "GET", "/api/students"],
  ["Filter, sort and paginate", "GET", "/api/students?program=BSCS&sort=-name&limit=2"],
  ["Student report", "GET", "/api/students/5/report"],
  ["Create a student (201)", "POST", "/api/students", { rollNo: "241990", name: "Sara Malik", email: "sara.malik@uni.edu.pk", program: "BSCS", semester: 5, section: "A" }],
  ["Invalid student (422)", "POST", "/api/students", { rollNo: "12", name: "", email: "sara@", program: "MBA", semester: 11 }],
  ["Replace a teacher (PUT)", "PUT", "/api/teachers/3", { name: "Rabia Saleem", email: "rabia.saleem@uni.edu.pk", designation: "Assistant Professor", department: "Software Engineering", course: "Operating Systems", phone: "03331234567" }],
  ["Change one attendance status (PATCH)", "PATCH", "/api/attendance/1", { status: "late" }],
  ["Duplicate attendance (409)", "POST", "/api/attendance", { studentId: 1, teacherId: 1, date: "2026-10-21", status: "present" }],
  ["Marks above total (422)", "POST", "/api/marks", { studentId: 1, teacherId: 1, assessment: "quiz", title: "Quiz 9", obtained: 12, total: 10 }],
  ["Delete a student with records (409)", "DELETE", "/api/students/2"],
  ["Delete with cascade (200)", "DELETE", "/api/students/2?cascade=true"],
  ["Dashboard numbers", "GET", "/api/stats"],
  ["Every endpoint", "GET", "/api"],
  ["Original route: hello", "GET", "/hello?name=Ali"],
  ["Wrong method (405)", "PUT", "/health"],
  ["Unknown route (404)", "GET", "/api/courses"]
];

$("#tExamples").innerHTML = EXAMPLES.map(([label, m], i) =>
  `<li><button class="dropdown-item d-flex gap-2 align-items-center" type="button" data-example="${i}">${methodBadge(m)}<span>${esc(label)}</span></button></li>`).join("");
$("#tExamples").addEventListener("click", (e) => {
  const b = e.target.closest("[data-example]");
  if (!b) return;
  const [, m, p, body] = EXAMPLES[Number(b.dataset.example)];
  $("#tMethod").value = m;
  $("#tPath").value = p;
  $("#tBody").value = body ? JSON.stringify(body, null, 2) : "";
  syncBody();
});
const syncBody = () => ($("#tBody").disabled = !["POST", "PUT", "PATCH"].includes($("#tMethod").value));
$("#tMethod").addEventListener("change", syncBody);

$("#testerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const method = $("#tMethod").value;
  let path = $("#tPath").value.trim() || "/";
  if (!path.startsWith("/")) path = "/" + path;
  const hasBody = !$("#tBody").disabled && $("#tBody").value.trim() !== "";
  const button = e.submitter || $("#testerForm button[type=submit]");
  button.dataset.busy = "Sending";
  const r = await withBusy(button, () => api(method, path, hasBody ? $("#tBody").value : undefined, { contentType: $("#tAsForm").checked ? "text/plain" : undefined }));
  $("#tMeta").innerHTML = `${statusPill(r.status)} <span class="ms-2 text-body-secondary">${r.ms} ms · ${T.getMode().mode === "server" ? "HTTP" : "in-page API"}</span>`;
  const shown = Object.entries(r.headers || {}).filter(([k]) => k !== "content-type");
  $("#tHeaders").innerHTML = shown.map(([k, v]) => `<span class="header-chip"><span>${esc(k)}:</span> ${esc(v)}</span>`).join("");
  $("#tResponse").innerHTML = jsonHTML(r.body);
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && r.ok) loadRefs();
});
syncBody();

/* ---------- requirement checks --------------------------------------------- */

function renderChecksSkeleton(checks) {
  const groups = [...new Set(checks.map((c) => c.group))];
  $("#checksList").innerHTML = groups.map((g) => `
    <div class="card panel mb-3">
      <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
        <h2 class="h6 fw-bold mb-0">${esc(g === "General" ? "General HTTP behaviour" : g === "Relations" ? "Modules working together and deletes" : `${g} module`)}</h2>
        <span class="small text-body-secondary" data-group-count="${esc(g)}"></span>
      </div>
      <div class="list-group list-group-flush">
        ${checks.map((c, i) => c.group === g ? `
          <details class="list-group-item check-row" data-check="${i}">
            <summary>
              <span class="check-icon" data-icon><i class="bi bi-circle"></i></span>
              <span class="check-title">${esc(c.title)}</span>
              <span class="check-meta ms-auto" data-meta></span>
            </summary>
            <div class="check-detail" data-detail></div>
          </details>` : "").join("")}
      </div>
    </div>`).join("");
}

$("#runChecks").addEventListener("click", async (e) => {
  const { checks, cleanUp } = createChecks();
  renderChecksSkeleton(checks);
  $("#checksSummary").innerHTML = "";
  const started = performance.now();
  let passed = 0;
  await withBusy(e.currentTarget, async () => {
    for (let i = 0; i < checks.length; i++) {
      const row = $(`[data-check="${i}"]`);
      $("[data-icon]", row).innerHTML = '<span class="spinner-border spinner-border-sm text-primary"></span>';
      let res;
      try { res = await checks[i].run(); } catch (err) { res = { pass: false, note: err.message, request: "", expected: "?", status: 0, response: null }; }
      if (res.pass) passed++;
      row.classList.add(res.pass ? "is-pass" : "is-fail");
      $("[data-icon]", row).innerHTML = `<i class="bi ${res.pass ? "bi-check-circle-fill text-success" : "bi-x-circle-fill text-danger"}"></i>`;
      $("[data-meta]", row).innerHTML = `${methodBadge(res.method || "GET")}<span class="font-mono small d-none d-md-inline">${esc(res.request.replace(/^\w+ /, ""))}</span>
        <span class="small">expects <strong>${res.expected}</strong></span>${statusPill(res.status)}`;
      $("[data-detail]", row).innerHTML = `${res.note ? `<div class="alert alert-danger py-2 small mb-2">${esc(res.note)}</div>` : ""}
        <div class="small text-body-secondary mb-1">${esc(res.request)} · ${res.ms ?? 0} ms</div><pre class="code-view small mb-0">${jsonHTML(res.response)}</pre>`;
      $("#checksProgress").style.width = `${Math.round(((i + 1) / checks.length) * 100)}%`;
    }
    await cleanUp();
  });
  [...new Set(checks.map((c) => c.group))].forEach((g) => {
    const rows = $$(`[data-check]`).filter((r) => checks[Number(r.dataset.check)].group === g);
    $(`[data-group-count="${g}"]`).textContent = `${rows.filter((r) => r.classList.contains("is-pass")).length} / ${rows.length} passed`;
  });
  const failed = checks.length - passed;
  const secs = ((performance.now() - started) / 1000).toFixed(1);
  $("#checksSummary").innerHTML = [
    ["Passed", passed, "success", "bi-check-circle-fill"], ["Failed", failed, failed ? "danger" : "secondary", "bi-x-circle-fill"],
    ["Checks", checks.length, "primary", "bi-list-check"], ["Time", `${secs}s`, "dark", "bi-stopwatch"]
  ].map(([label, v, tone, icon]) => `<div class="col-6 col-md-3"><div class="card panel summary-card"><div class="card-body d-flex align-items-center gap-3">
      <i class="bi ${icon} fs-3 text-${tone}"></i><div><div class="stat-value fs-4">${v}</div><div class="small text-body-secondary">${label}</div></div></div></div></div>`).join("");
  toast(failed ? `${failed} check${failed > 1 ? "s" : ""} failed` : "All checks passed", `${passed} of ${checks.length} passed against the ${T.getMode().mode === "server" ? "live server" : "in-page API"}.`, failed ? "danger" : "success");
  await loadRefs();
});

/* ---------- start ---------------------------------------------------------- */

(async function start() {
  await T.init();
  renderMode();
  await Promise.all([loadRefs(), loadEndpoints()]);
  show(location.hash.slice(1) || "dashboard");
})();
