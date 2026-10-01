/* Page UI for Task 6. Uses multiplesBelow() and sumOfMultiples() from script.js.
   Wrapped in a function so its variables don't clash with x, y, z in script.js. */
(function () {
  const xIn = document.getElementById("x");
  const yIn = document.getElementById("y");
  const zIn = document.getElementById("z");
  const result = document.getElementById("sumResult");
  const listBox = document.getElementById("multiples");
  const SHOW_LIMIT = 60;   // longer lists are shortened on screen

  function run() {
    const a = Number(xIn.value), b = Number(yIn.value), c = Number(zIn.value);
    result.hidden = false;
    consolePanel.section("Playground");
    try {
      const list = multiplesBelow(a, b, c);
      const sum = sumOfMultiples(a, b, c);
      [xIn, yIn, zIn].forEach((el) => el.classList.remove("invalid"));
      console.log(`sumOfMultiples(${a}, ${b}, ${c}) =`, sum);

      result.className = "result ok";
      const equation = list.length > 0 && list.length <= 12 ? `${list.join(" + ")} = ` : "";
      result.innerHTML = `<span class="label">Sum of the multiples of ${a} or ${b} below ${c}</span><span class="value">${equation}${sum.toLocaleString("en-US")}</span>`;

      const shown = list.slice(0, SHOW_LIMIT);
      const more = list.length - shown.length;
      listBox.innerHTML = `<span class="label">${list.length} multiple${list.length === 1 ? "" : "s"} found</span>
        <div class="chips" style="margin-top:8px">${shown.map((n) => `<span class="chip static">${n}</span>`).join("")}${more > 0 ? `<span class="chip static">+${more} more</span>` : ""}</div>`;
    } catch (error) {
      console.error(error.message);
      [xIn, yIn, zIn].forEach((el) => el.classList.toggle("invalid", !Number.isInteger(Number(el.value)) || (el !== zIn && Number(el.value) <= 0)));
      result.className = "result err";
      result.innerHTML = `<span class="label">Invalid input</span><span class="value">${error.message}</span>`;
      listBox.innerHTML = "";
    }
  }

  document.getElementById("sumForm").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  document.getElementById("examples").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    [xIn.value, yIn.value, zIn.value] = chip.dataset.v.split(",");
    run();
  });
})();
