/* ==========================================================================
   ui/app.js - drives the Lab 6 test console.
   It imports the REAL lab functions and runs them; the animations are driven
   by a thin wrapper around fetch that reports when each request starts and
   finishes. Nothing about the lab code is changed for the UI.
   ========================================================================== */

import { fetchUser } from "../Task-1-Async-Await/fetchUser.js";
import { getUserProfile } from "../Task-2-Promise-All/userProfile.js";
import { API_BASE_URL } from "../lib/http.js";
import { mockFetch, MOCK_BASE_URL } from "./mockFetch.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);

/* ---------- state ---------- */
const state = { source: "real", timeoutMs: 5000 };

const SCENARIOS = {
  t1: {
    real: [
      { id: 1, label: "valid user", tone: "ok" },
      { id: 5, label: "valid user", tone: "ok" },
      { id: 10, label: "last valid id", tone: "ok" },
      { id: 11, label: "does not exist (404)", tone: "bad" },
      { id: 0, label: "invalid id", tone: "warn" },
      { id: "abc", label: "not a number", tone: "warn" }
    ],
    sim: [
      { id: 1, label: "valid user", tone: "ok" },
      { id: 50, label: "invalid data", tone: "bad" },
      { id: 52, label: "server error 500", tone: "bad" },
      { id: 53, label: "broken JSON", tone: "bad" },
      { id: 54, label: "slow (2.5 s)", tone: "warn" },
      { id: 55, label: "network failure", tone: "bad" },
      { id: 99, label: "not found (404)", tone: "bad" }
    ]
  },
  t2: {
    real: [
      { id: 1, label: "both valid", tone: "ok" },
      { id: 7, label: "both valid", tone: "ok" },
      { id: 11, label: "user missing (404)", tone: "bad" },
      { id: -1, label: "invalid id", tone: "warn" }
    ],
    sim: [
      { id: 2, label: "both valid", tone: "ok" },
      { id: 3, label: "both valid", tone: "ok" },
      { id: 50, label: "invalid user details", tone: "bad" },
      { id: 51, label: "invalid post", tone: "bad" },
      { id: 52, label: "server error", tone: "bad" },
      { id: 54, label: "slow (2.5 s)", tone: "warn" },
      { id: 55, label: "network failure", tone: "bad" }
    ]
  }
};

const ERROR_HELP = {
  TypeError: "The id was rejected before any request was sent. Ids must be positive whole numbers.",
  HttpError: "The API answered, but with an error status instead of the user.",
  NetworkError: "There was no response at all, so the API could not be reached.",
  RequestTimeout: "The API took longer than the timeout, so the request was cancelled with AbortSignal.timeout().",
  InvalidJSONError: "The API answered with something that is not valid JSON.",
  InvalidUserError: "The request worked, but the user it returned does not pass validation.",
  InvalidDetailsError: "Both requests worked, but the details they returned are not valid, so the main promise is rejected."
};

/* ---------- request options + instrumented fetch ---------- */

// Wraps the chosen fetch so the UI hears about every request start and end.
function instrumentedFetch(onEvent) {
  const base = state.source === "sim" ? mockFetch : window.fetch.bind(window);
  return async (url, init) => {
    const kind = String(url).includes("/posts") ? "posts" : "users";
    const started = performance.now();
    onEvent({ type: "start", kind, url });
    try {
      const response = await base(url, init);
      onEvent({ type: "response", kind, url, status: response.status, ok: response.ok, ms: performance.now() - started });
      return response;
    } catch (error) {
      onEvent({ type: "fail", kind, url, error, ms: performance.now() - started });
      throw error;
    }
  };
}

function requestOptions(onEvent) {
  return {
    baseUrl: state.source === "sim" ? MOCK_BASE_URL : API_BASE_URL,
    fetchFn: instrumentedFetch(onEvent),
    timeoutMs: state.timeoutMs
  };
}

// "12" -> 12; anything else is passed as typed so the lab code can reject it
function readId(input) {
  const raw = input.value.trim();
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

/* ---------- small UI helpers ---------- */

function ripple(button, event) {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const span = document.createElement("span");
  span.className = "ripple";
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${(event?.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
  span.style.top = `${(event?.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;
  button.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}

function slideThumb(container, activeButton, thumb) {
  thumb.style.width = `${activeButton.offsetWidth}px`;
  thumb.style.transform = `translateX(${activeButton.offsetLeft - 4}px)`;
}

function renderChips(task) {
  const box = $(`#${task}-chips`);
  box.innerHTML = SCENARIOS[task][state.source].map((s, i) =>
    `<button type="button" class="chip" data-id="${esc(s.id)}" style="animation-delay:${i * 40}ms"><span class="dot ${s.tone}"></span><b>${esc(s.id)}</b>${esc(s.label)}</button>`
  ).join("");
}

function addHistory(task, ok, text, ms) {
  const list = $(`#${task}-history`);
  list.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  li.innerHTML = `<span class="badge ${ok ? "ok" : "bad"}">${ok ? "OK" : "ERR"}</span><span class="what">${esc(text)}</span><time>${fmtMs(ms)}</time>`;
  list.prepend(li);
  [...list.children].slice(8).forEach((el) => el.remove());
}

function errorCard(error, extraHtml = "") {
  const status = error.status ? ` <span class="badge bad">HTTP ${error.status}</span>` : "";
  return `<div class="error-card shake">
      <span class="badge bad">${esc(error.name)}</span>${status}
      <h3>${error.name === "InvalidDetailsError" ? "Main promise rejected" : "fetchUser() returned an error"}</h3>
      <p class="msg">${esc(error.message)}</p>
      <p class="why">${esc(ERROR_HELP[error.name] ?? "The request failed.")}</p>${extraHtml}
    </div>`;
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

function codeLine(fn, id) {
  const shownId = typeof id === "number" ? `<span class="n">${id}</span>` : `<span class="s">"${esc(id)}"</span>`;
  const source = state.source === "sim" ? "simulated API" : "jsonplaceholder.typicode.com";
  return fn === "fetchUser"
    ? `<span class="c">// Task 1 · ${source}</span>\n<span class="k">try</span> {\n  <span class="k">const</span> user = <span class="k">await</span> <span class="f">fetchUser</span>(${shownId}, { timeoutMs: <span class="n">${state.timeoutMs}</span> });\n} <span class="k">catch</span> (error) { <span class="c">/* HttpError, NetworkError ... */</span> }`
    : `<span class="c">// Task 2 · ${source}</span>\n<span class="f">getUserProfile</span>(${shownId})          <span class="c">// new Promise(...)</span>\n  .<span class="f">then</span>(profile => <span class="c">/* accepted */</span>)\n  .<span class="f">catch</span>(error => <span class="c">/* rejected */</span>);`;
}

/* ---------- elapsed timer (requestAnimationFrame) ---------- */
function startTimer(output) {
  const t0 = performance.now();
  let frame = 0;
  const tick = () => { output.textContent = fmtMs(performance.now() - t0); frame = requestAnimationFrame(tick); };
  frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); const ms = performance.now() - t0; output.textContent = fmtMs(ms); return ms; };
}

/* ==========================================================================
   TASK 1
   ========================================================================== */

const STEP_FOR_ERROR = { TypeError: 1, NetworkError: 2, RequestTimeout: 2, HttpError: 3, InvalidJSONError: 3, InvalidUserError: 4 };

function setStep(n, cls, detail) {
  const step = $(`#t1-steps .step[data-step="${n}"]`);
  step.classList.remove("active", "done", "fail", "skip");
  if (cls) step.classList.add(cls);
  if (detail !== undefined) $(".detail", step).textContent = detail;
}

async function runTask1(event) {
  event?.preventDefault();
  const button = $("#t1-run");
  if (button.disabled) return;
  ripple(button, event?.submitter ? null : undefined);
  button.disabled = true;

  const id = readId($("#t1-id"));
  $("#t1-code").innerHTML = codeLine("fetchUser", id);
  [1, 2, 3, 4].forEach((n) => setStep(n, null, ""));
  setStep(1, "active", "checking…");
  $("#t1-result").innerHTML = `<div class="idle"><span class="big">⏳</span>Waiting for fetchUser(${esc(id)})…</div>`;
  const stop = startTimer($("#t1-elapsed"));

  let responded = false;
  const onEvent = (e) => {
    if (e.type === "start") { setStep(1, "done", "ok"); setStep(2, "active", "GET /users/" + id); }
    if (e.type === "response") { responded = true; setStep(2, "done", fmtMs(e.ms)); setStep(3, "active", `${e.status} ${e.ok ? "OK" : ""}`.trim()); }
  };

  try {
    const user = await fetchUser(id, requestOptions(onEvent));
    const ms = stop();
    setStep(3, "done", "valid JSON");
    await wait(120);
    setStep(4, "done", "passed");
    $("#t1-result").innerHTML = `
      <div class="user-card">
        <div class="user-head"><div class="avatar">${esc(initials(user.name))}</div>
          <div><h3>${esc(user.name)}</h3><p>@${esc(user.username)} · id ${user.id}</p></div>
          <span class="badge ok" style="margin-left:auto">valid user</span></div>
        <dl class="facts">
          ${[["Email", user.email], ["City", user.city], ["Company", user.company], ["Phone", user.phone], ["Website", user.website], ["Fetched in", fmtMs(ms)]]
            .map(([k, v], i) => `<div style="animation-delay:${120 + i * 55}ms"><dt>${k}</dt><dd>${esc(v ?? "—")}</dd></div>`).join("")}
        </dl>
      </div>`;
    addHistory("t1", true, `fetchUser(${id}) → ${user.name}`, ms);
  } catch (error) {
    const ms = stop();
    const failAt = STEP_FOR_ERROR[error.name] ?? (responded ? 3 : 2);
    for (let n = 1; n < failAt; n++) setStep(n, "done");
    const detail = { 1: "invalid id", 2: error.name === "RequestTimeout" ? "timed out" : "no response", 3: error.status ? `HTTP ${error.status}` : "not JSON", 4: "failed" }[failAt];
    setStep(failAt, "fail", detail);
    for (let n = failAt + 1; n <= 4; n++) setStep(n, "skip", "");
    const list = error.problems ? `<ul class="problems">${error.problems.map((p, i) => `<li style="animation-delay:${200 + i * 70}ms">${esc(p)}</li>`).join("")}</ul>` : "";
    $("#t1-result").innerHTML = errorCard(error, list);
    addHistory("t1", false, `fetchUser(${id}) → ${error.name}`, ms);
  } finally {
    button.disabled = false;
  }
}

/* ==========================================================================
   TASK 2
   ========================================================================== */

const lanes = { users: $("#lane-users"), posts: $("#lane-posts") };
const laneFrames = {};

function resetLane(kind, id) {
  const lane = lanes[kind];
  cancelAnimationFrame(laneFrames[kind]);
  lane.className = "lane";
  $(".lane-id", lane).textContent = id;
  $(".state", lane).textContent = "idle";
  $(".fill", lane).style.transform = "scaleX(0)";
}

// The bar creeps toward 90% while waiting (we can't know real progress) and snaps to 100% when done.
function runLane(kind) {
  const lane = lanes[kind];
  const fill = $(".fill", lane);
  const t0 = performance.now();
  lane.className = "lane running";
  const tick = () => {
    const t = performance.now() - t0;
    fill.style.transform = `scaleX(${0.9 * (1 - Math.exp(-t / 700))})`;
    $(".state", lane).textContent = `pending · ${fmtMs(t)}`;
    laneFrames[kind] = requestAnimationFrame(tick);
  };
  laneFrames[kind] = requestAnimationFrame(tick);
}

function finishLane(kind, ok, text) {
  const lane = lanes[kind];
  cancelAnimationFrame(laneFrames[kind]);
  lane.className = `lane ${ok ? "done" : "failed"}`;
  const fill = $(".fill", lane);
  fill.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1)";
  fill.style.transform = "scaleX(1)";
  setTimeout(() => (fill.style.transition = ""), 400);
  $(".state", lane).textContent = text;
}

function setVerdict(stateName, text) {
  const v = $("#t2-verdict");
  v.className = `verdict ${stateName}`;
  $(".text", v).textContent = text;
  $(".ring", v).textContent = stateName === "accepted" ? "✔" : stateName === "rejected" ? "✖" : "";
}

function setTiming(times, total) {
  const max = Math.max(times.users ?? 0, times.posts ?? 0, total, 1) * 1.05;
  const put = (key, ms) => {
    $(`#tb-${key}`).style.width = ms ? `${(ms / max) * 100}%` : "0";
    $(`#to-${key}`).textContent = ms ? fmtMs(ms) : "–";
  };
  put("users", times.users);
  put("posts", times.posts);
  put("total", total);
  const sum = (times.users ?? 0) + (times.posts ?? 0);
  $("#t2-saving").textContent = times.users && times.posts && sum > total
    ? `Run one after another this would take about ${fmtMs(sum)}. Running together saved about ${fmtMs(sum - total)}.`
    : "";
}

async function runTask2(event) {
  event?.preventDefault();
  const button = $("#t2-run");
  if (button.disabled) return;
  ripple(button);
  button.disabled = true;

  const id = readId($("#t2-id"));
  $("#t2-code").innerHTML = codeLine("getUserProfile", id);
  resetLane("users", id);
  resetLane("posts", id);
  $("#merge").classList.remove("active");
  $("#t2-all").className = "all-node";
  setVerdict("pending", "pending");
  setTiming({}, 0);
  $("#t2-result").innerHTML = `<div class="idle"><span class="big">⏳</span>Main promise is pending…</div>`;

  const times = {};
  const t0 = performance.now();
  const onEvent = (e) => {
    if (e.type === "start") {
      runLane(e.kind);
      $("#merge").classList.add("active");
      $("#t2-all").className = "all-node waiting";
    }
    if (e.type === "response") {
      times[e.kind] = e.ms;
      finishLane(e.kind, e.ok, `${e.status} ${e.ok ? "OK" : "error"} · ${fmtMs(e.ms)}`);
    }
    if (e.type === "fail") {
      times[e.kind] = e.ms;
      finishLane(e.kind, false, `${e.error?.name === "TimeoutError" ? "timed out" : "failed"} · ${fmtMs(e.ms)}`);
    }
  };

  try {
    const profile = await getUserProfile(id, requestOptions(onEvent));
    const total = performance.now() - t0;
    $("#merge").classList.remove("active");
    $("#t2-all").className = "all-node";
    setVerdict("accepted", "ACCEPTED");
    setTiming(times, total);
    $("#t2-result").innerHTML = `
      <div class="verdict-card accepted">
        <div class="user-head"><div class="avatar">${esc(initials(profile.user.name))}</div>
          <div><h3>${esc(profile.user.name)}</h3><p>${esc(profile.user.email)} · ${esc(profile.user.city ?? "")}</p></div>
          <span class="badge ok" style="margin-left:auto">both valid</span></div>
        <div class="problem-group"><h4>${profile.postCount} post${profile.postCount === 1 ? "" : "s"}</h4></div>
        <ul class="posts">${profile.posts.slice(0, 5).map((p, i) => `<li style="animation-delay:${150 + i * 70}ms"><b>#${p.id}</b>${esc(p.title)}</li>`).join("")}
          ${profile.postCount > 5 ? `<li style="animation-delay:${150 + 5 * 70}ms"><b>…</b>and ${profile.postCount - 5} more</li>` : ""}</ul>
      </div>`;
    addHistory("t2", true, `getUserProfile(${id}) → accepted, ${profile.postCount} posts`, total);
  } catch (error) {
    const total = performance.now() - t0;
    // a lane that never answered because the other one failed first
    ["users", "posts"].forEach((k) => {
      if (lanes[k].classList.contains("running")) { cancelAnimationFrame(laneFrames[k]); lanes[k].className = "lane cancelled"; $(".state", lanes[k]).textContent = "result ignored"; }
    });
    $("#merge").classList.remove("active");
    $("#t2-all").className = "all-node";
    setVerdict("rejected", "REJECTED");
    setTiming(times, total);
    let extra = "";
    if (error.problems) {
      const group = (title, list) => `<div class="problem-group"><h4>${title}</h4>${list.length
        ? `<ul class="problems">${list.map((p, i) => `<li style="animation-delay:${200 + i * 70}ms">${esc(p)}</li>`).join("")}</ul>`
        : `<p class="why" style="margin-top:4px">✔ valid</p>`}</div>`;
      extra = group("User details", error.problems.user) + group("Posts", error.problems.posts);
    }
    $("#t2-result").innerHTML = errorCard(error, extra);
    addHistory("t2", false, `getUserProfile(${id}) → ${error.name}`, total);
  } finally {
    button.disabled = false;
  }
}

/* ==========================================================================
   wiring
   ========================================================================== */

function setSource(source) {
  state.source = source;
  const box = $("#sourceSwitch");
  $$("button", box).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.source === source)));
  slideThumb(box, $(`button[data-source="${source}"]`, box), $(".thumb", box));
  const hint = $("#sourceHint");
  hint.style.opacity = 0;
  setTimeout(() => {
    hint.textContent = source === "sim"
      ? "Simulated in your browser: try invalid data, a 500 error, broken JSON, a slow API or a dropped connection."
      : "Live requests to jsonplaceholder.typicode.com. Users 1–10 exist; any other id gives a 404.";
    hint.style.opacity = 1;
  }, 160);
  renderChips("t1");
  renderChips("t2");
  $("#t1-code").innerHTML = codeLine("fetchUser", readId($("#t1-id")));
  $("#t2-code").innerHTML = codeLine("getUserProfile", readId($("#t2-id")));
}

function selectTab(tabId) {
  $$(".tab").forEach((tab) => {
    const active = tab.id === tabId;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = $(`#${tab.getAttribute("aria-controls")}`);
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  const tab = $(`#${tabId}`);
  const indicator = $(".tab-indicator");
  indicator.style.width = `${tab.offsetWidth}px`;
  indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  history.replaceState(null, "", tabId === "tab-t2" ? "#task2" : "#task1");
}

$("#sourceSwitch").addEventListener("click", (e) => {
  const button = e.target.closest("button[data-source]");
  if (button && button.dataset.source !== state.source) setSource(button.dataset.source);
});

$("#timeout").addEventListener("input", (e) => {
  state.timeoutMs = Number(e.target.value);
  $("#timeoutValue").textContent = `${(state.timeoutMs / 1000).toFixed(state.timeoutMs % 1000 ? 2 : 1)} s`;
  $("#t1-code").innerHTML = codeLine("fetchUser", readId($("#t1-id")));
});

$$(".tab").forEach((tab) => tab.addEventListener("click", () => selectTab(tab.id)));
$(".tabs").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const next = $(".tab[aria-selected='false']");
  next.focus();
  selectTab(next.id);
});

$("#t1-form").addEventListener("submit", runTask1);
$("#t2-form").addEventListener("submit", runTask2);
["t1", "t2"].forEach((task) => {
  $(`#${task}-id`).addEventListener("input", () =>
    ($(`#${task}-code`).innerHTML = codeLine(task === "t1" ? "fetchUser" : "getUserProfile", readId($(`#${task}-id`)))));
  $(`#${task}-chips`).addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip || $(`#${task}-run`).disabled) return;
    $(`#${task}-id`).value = chip.dataset.id;
    (task === "t1" ? runTask1 : runTask2)();
  });
});

window.addEventListener("resize", () => {
  selectTab($(".tab[aria-selected='true']").id);
  const box = $("#sourceSwitch");
  slideThumb(box, $(`button[aria-pressed="true"]`, box), $(".thumb", box));
});

// start
setSource("real");
selectTab(location.hash === "#task2" ? "tab-t2" : "tab-t1");
document.fonts?.ready.then(() => {           // re-measure once web fonts have loaded
  selectTab($(".tab[aria-selected='true']").id);
  const box = $("#sourceSwitch");
  slideThumb(box, $(`button[aria-pressed="true"]`, box), $(".thumb", box));
});
