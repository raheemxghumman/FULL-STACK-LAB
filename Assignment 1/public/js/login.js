/* ConnecFriend — login page */
(function () {
  // Already signed in in this tab? Go straight to the feed.
  if (Store.currentUser()) {
    location.replace("home.html");
    return;
  }

  const form = document.getElementById("loginForm");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const errorBox = document.getElementById("loginError");
  const button = document.getElementById("loginBtn");

  // Message passed from another page (e.g. "Please log in to continue.")
  const flash = sessionStorage.getItem("cf_flash");
  if (flash) {
    const box = document.getElementById("flash");
    box.textContent = flash;
    box.classList.remove("d-none");
    sessionStorage.removeItem("cf_flash");
  }

  // Remembered username
  const remembered = localStorage.getItem("cf_remember");
  if (remembered) {
    username.value = remembered;
    document.getElementById("remember").checked = true;
    password.focus();
  }

  function clearErrors() {
    errorBox.classList.add("d-none");
    [username, password].forEach((el) => el.classList.remove("is-invalid"));
  }

  function showFieldError(err) {
    const field = err.field === "password" ? password : err.field === "username" ? username : null;
    if (field) {
      field.classList.add("is-invalid");
      document.getElementById(field.id + "Feedback").textContent = err.message;
      field.focus();
    } else {
      errorBox.textContent = err.message;
      errorBox.classList.remove("d-none");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    try {
      await UI.withBusy(button, () => Store.login(username.value, password.value));
      if (document.getElementById("remember").checked) localStorage.setItem("cf_remember", username.value.trim().toLowerCase());
      else localStorage.removeItem("cf_remember");
      location.href = "home.html";
    } catch (err) {
      showFieldError(err);
    }
  });

  [username, password].forEach((el) => el.addEventListener("input", () => el.classList.remove("is-invalid")));

  // Show / hide password
  document.getElementById("togglePassword").addEventListener("click", (e) => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    e.currentTarget.innerHTML = `<i class="bi ${show ? "bi-eye-slash" : "bi-eye"}"></i>`;
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  // Demo account chips fill in the form
  document.getElementById("demoUsers").innerHTML = Store.allUsers().slice(0, 6).map((u) =>
    `<button type="button" class="btn btn-light btn-sm d-flex align-items-center gap-2 rounded-pill pe-3" data-user="${u.username}">
       ${UI.avatar(u, 24)}<span>${UI.escapeHtml(u.username)}</span></button>`).join("");
  document.getElementById("demoUsers").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-user]");
    if (!chip) return;
    clearErrors();
    username.value = chip.dataset.user;
    password.value = "connect123";
    button.focus();
  });

  UI.tooltips();
})();
