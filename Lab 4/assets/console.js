/* ==========================================================================
   console.js — mirrors console.log / info / warn / error onto the page.
   The lab answers print with plain console.log(); this file shows the same
   output inside the "Console output" panel, so it is visible without
   opening DevTools. Load it BEFORE the task's script.js.
   ========================================================================== */
(function () {
  const queue = [];   // messages logged before the panel exists
  let pageLoaded = false;
  window.addEventListener("load", () => { pageLoaded = true; });

  // Colour-coded formatting, similar to the browser console.
  function format(value, nested) {
    if (value === null) return '<span class="c-null">null</span>';
    if (value === undefined) return '<span class="c-null">undefined</span>';
    switch (typeof value) {
      case "number":
      case "bigint":
        return '<span class="c-num">' + (Object.is(value, -0) ? "0" : String(value)) + "</span>";
      case "boolean":
        return '<span class="c-bool">' + value + "</span>";
      case "string":
        // top-level strings print as plain text; strings inside arrays/objects get quotes
        return nested ? '<span class="c-str">"' + escape(value) + '"</span>' : escape(value);
      case "function":
        return '<span class="c-key">ƒ ' + escape(value.name || "anonymous") + "()</span>";
    }
    if (Array.isArray(value)) {
      return "[" + value.map((v) => format(v, true)).join(", ") + "]";
    }
    if (value instanceof Error) return escape(value.name + ": " + value.message);
    const entries = Object.keys(value).map(
      (k) => '<span class="c-key">' + escape(k) + "</span>: " + format(value[k], true)
    );
    return "{" + entries.join(", ") + "}";
  }

  function escape(text) {
    return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function render(type, args) {
    const body = document.getElementById("console-body");
    if (!body) { queue.push([type, args]); return; }
    const line = document.createElement("div");
    line.className = "console-line " + type;
    // one inner span, so the flex gap only separates the prompt from the text
    line.innerHTML = "<span>" + args.map((a) => format(a, false)).join(" ") + "</span>";
    body.appendChild(line);
    // keep the first lines in view on load; follow new output after that
    if (pageLoaded) body.scrollTop = body.scrollHeight;
  }

  // Wrap the real console methods: the browser console still receives everything.
  ["log", "info", "warn", "error"].forEach((type) => {
    const original = console[type].bind(console);
    console[type] = function (...args) {
      original(...args);
      render(type === "info" ? "log" : type, args);
    };
  });

  // Helpers used by the pages (not by the lab answers themselves).
  window.consolePanel = {
    section(title) { render("section", [title]); },
    clear() {
      const body = document.getElementById("console-body");
      if (body) body.innerHTML = "";
    },
    flush() { queue.splice(0).forEach(([t, a]) => render(t, a)); }
  };

  // Show messages that were logged before the panel was ready.
  document.addEventListener("DOMContentLoaded", () => window.consolePanel.flush());

  // Uncaught errors also appear in the panel.
  window.addEventListener("error", (e) => render("error", [e.message]));
})();
