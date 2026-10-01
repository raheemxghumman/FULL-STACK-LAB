/* Page UI for Task 2. Uses isPrime() and nextPrime() from script.js. */
(function () {
  const input = document.getElementById("primeInput");
  const result = document.getElementById("primeResult");
  const chipBox = document.getElementById("primeChips");

  // chips for every prime below 100
  const primes = [];
  for (let n = 2; n < 100; n++) if (isPrime(n)) primes.push(n);
  chipBox.innerHTML = primes.map((p) => `<button type="button" class="chip" data-p="${p}">${p}</button>`).join("");

  function highlight(given, next) {
    chipBox.querySelectorAll(".chip").forEach((c) => {
      const p = Number(c.dataset.p);
      c.classList.toggle("hl", p === given || p === next);
    });
  }

  function run() {
    const value = Number(input.value);
    input.classList.remove("invalid");
    result.hidden = false;
    consolePanel.section("Playground");
    try {
      const next = nextPrime(value);
      console.log("The prime after " + value + " is " + next);
      result.className = "result ok";
      result.innerHTML = `<span class="label">The prime after ${value} is</span><span class="value">${next}</span>`;
      highlight(value, next);
    } catch (error) {
      console.error(error.message);
      input.classList.add("invalid");
      // suggest the closest primes around the number that was typed
      let below = Math.floor(value);
      while (below >= 2 && !isPrime(below)) below--;
      let above = Math.max(2, Math.ceil(value));
      while (!isPrime(above)) above++;
      const hint = below >= 2 ? `Try ${below} or ${above}.` : `Try ${above}.`;
      result.className = "result err";
      result.innerHTML = `<span class="label">Not a prime number</span><span class="value">${input.value || "(empty)"} is not prime. ${hint}</span>`;
      highlight(null, null);
    }
  }

  document.getElementById("primeForm").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  chipBox.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    input.value = chip.dataset.p;
    run();
  });
  highlight(11, 13);
})();
