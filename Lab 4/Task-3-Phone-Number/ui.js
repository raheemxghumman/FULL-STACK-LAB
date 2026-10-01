/* Page UI for Task 3. Uses createPhoneNumber() from script.js. */
(function () {
  const box = document.getElementById("digits");
  const result = document.getElementById("phoneResult");
  const start = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  box.innerHTML = start
    .map((d, i) => `<input type="text" inputmode="numeric" maxlength="1" value="${d}" aria-label="Digit ${i + 1}">`)
    .join("");
  const inputs = [...box.querySelectorAll("input")];

  // keep each box to a single digit and move focus along as you type
  inputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "").slice(-1);
      input.classList.remove("invalid");
      if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) inputs[i - 1].focus();
    });
    input.addEventListener("focus", () => input.select());
  });

  function run() {
    // empty boxes become NaN so the function's own validation reports them
    const numbers = inputs.map((inp) => (inp.value === "" ? NaN : Number(inp.value)));
    inputs.forEach((inp) => inp.classList.toggle("invalid", inp.value === ""));
    consolePanel.section("Playground");
    result.hidden = false;
    try {
      const phone = createPhoneNumber(numbers);
      console.log(phone);
      result.className = "result ok";
      result.innerHTML = `<span class="label">createPhoneNumber([${numbers.join(", ")}]) returns</span><span class="value">"${phone}"</span>`;
    } catch (error) {
      console.error(error.message);
      result.className = "result err";
      result.innerHTML = `<span class="label">Invalid input</span><span class="value">${error.message}</span>`;
    }
  }

  document.getElementById("phoneForm").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  document.getElementById("randomBtn").addEventListener("click", () => {
    inputs.forEach((inp) => { inp.value = Math.floor(Math.random() * 10); inp.classList.remove("invalid"); });
    run();
  });
})();
