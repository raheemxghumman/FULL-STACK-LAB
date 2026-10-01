/* Page UI for Task 5. Uses absMe(), ceilMe() and floorMe() from script.js. */
(function () {
  const input = document.getElementById("numbers");
  const calls = document.getElementById("calls");
  const compare = document.getElementById("compare");

  function parse(text) {
    const parts = text.split(",").map((s) => s.trim()).filter((s) => s !== "");
    const nums = parts.map(Number);
    return nums.some((n) => Number.isNaN(n)) ? null : nums;
  }
  const show = (v) => (Array.isArray(v) ? "[" + v.map(fix).join(", ") + "]" : String(fix(v)));
  const fix = (n) => (Object.is(n, -0) ? 0 : n);

  function run() {
    const args = parse(input.value);
    if (args === null) {
      input.classList.add("invalid");
      calls.innerHTML = '<div class="result err"><span class="label">Invalid input</span><span class="value">Use numbers separated by commas, e.g. -4.7, 4.2</span></div>';
      compare.innerHTML = "";
      return;
    }
    input.classList.remove("invalid");
    const list = args.join(", ");
    const runs = [["absMe", absMe], ["ceilMe", ceilMe], ["floorMe", floorMe]];

    consolePanel.section("Playground");
    calls.innerHTML = runs.map(([name, fn]) => {
      const output = fn(...args);
      console.log(`${name}(${list}) ->`, output);
      return `<div class="result ok" style="margin-top:10px"><span class="label">${name}(${list}) returns</span><span class="value">${show(output)}</span></div>`;
    }).join("");

    // compare each value with the built-in Math methods
    compare.innerHTML = args.length === 0 ? "" :
      '<table class="data"><thead><tr><th>Value</th><th>absMe</th><th>ceilMe</th><th>floorMe</th><th>Same as Math</th></tr></thead><tbody>' +
      args.map((n) => {
        const a = absMe(n), c = ceilMe(n), f = floorMe(n);
        const ok = a === Math.abs(n) && c === Math.ceil(n) && f === Math.floor(n);
        return `<tr><td>${n}</td><td>${fix(a)}</td><td>${fix(c)}</td><td>${fix(f)}</td><td>${ok ? "✓" : "✗"}</td></tr>`;
      }).join("") + "</tbody></table>";
  }

  document.getElementById("mathForm").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  document.getElementById("examples").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    input.value = chip.dataset.v;
    run();
  });
  run();
})();
