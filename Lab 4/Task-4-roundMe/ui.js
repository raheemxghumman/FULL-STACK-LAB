/* Page UI for Task 4. Uses roundMe() from script.js. */
(function () {
  const input = document.getElementById("numbers");
  const result = document.getElementById("roundResult");
  const compare = document.getElementById("compare");

  // "4.7, 4.4" -> [4.7, 4.4]; "" -> [] (no arguments); returns null if something is not a number
  function parse(text) {
    const parts = text.split(",").map((s) => s.trim()).filter((s) => s !== "");
    const nums = parts.map(Number);
    return nums.some((n) => Number.isNaN(n)) ? null : nums;
  }
  const show = (v) => (Array.isArray(v) ? "[" + v.join(", ") + "]" : String(v));

  function run() {
    const args = parse(input.value);
    result.hidden = false;
    if (args === null) {
      input.classList.add("invalid");
      result.className = "result err";
      result.innerHTML = '<span class="label">Invalid input</span><span class="value">Use numbers separated by commas, e.g. 4.7, 4.4</span>';
      compare.innerHTML = "";
      return;
    }
    input.classList.remove("invalid");
    const call = "roundMe(" + args.join(", ") + ")";
    const output = roundMe(...args);

    consolePanel.section("Playground");
    console.log(call + " ->", output);

    result.className = "result ok";
    result.innerHTML = `<span class="label">${call} returns</span><span class="value">${show(output)}</span>`;

    // check each value against the built-in Math.round
    compare.innerHTML = args.length === 0 ? "" :
      '<table class="data"><thead><tr><th>Value</th><th>roundMe</th><th>Math.round</th><th>Match</th></tr></thead><tbody>' +
      args.map((n) => {
        const mine = roundMe(n), builtIn = Math.round(n);
        return `<tr><td>${n}</td><td>${mine}</td><td>${builtIn}</td><td>${mine === builtIn ? "✓" : "✗"}</td></tr>`;
      }).join("") + "</tbody></table>";
  }

  document.getElementById("roundForm").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  document.getElementById("examples").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    input.value = chip.dataset.v;
    run();
  });
})();
