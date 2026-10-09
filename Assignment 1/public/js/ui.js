/* ==========================================================================
   ConnecFriend — shared UI helpers
   Page guard, app shell (sidebar + mobile top bar), avatars, "time ago",
   toasts, confirm dialog and HTML escaping. Used by every page except login.
   ========================================================================== */

const UI = (() => {
  /* ---------- small helpers ---------- */

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function timeAgo(timestamp) {
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45) return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
    return new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function initials(name) {
    return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  }

  // Profile picture: the uploaded photo if there is one, otherwise a coloured initials avatar
  function avatar(user, size = 44, extraClass = "") {
    if (!user) return "";
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`;
    if (user.picture) {
      return `<img src="${user.picture}" alt="${escapeHtml(user.name)}" class="rounded-circle object-fit-cover flex-shrink-0 ${extraClass}" style="${style}">`;
    }
    return `<span class="avatar rounded-circle d-inline-flex align-items-center justify-content-center fw-semibold text-white flex-shrink-0 ${extraClass}"
      style="${style};background:${user.color}" role="img" aria-label="${escapeHtml(user.name)}">${initials(user.name)}</span>`;
  }

  // Green dot for anyone active in the last 15 minutes
  function isActive(user) {
    return Date.now() - user.lastLogin < 15 * 60 * 1000;
  }

  /* ---------- toasts ---------- */

  function toast(message, type = "success") {
    const icons = { success: "bi-check-circle-fill", danger: "bi-exclamation-octagon-fill", warning: "bi-exclamation-triangle-fill", info: "bi-info-circle-fill" };
    let box = document.getElementById("toastBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "toastBox";
      box.className = "toast-container position-fixed bottom-0 end-0 p-3";
      box.style.zIndex = 1090;
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.setAttribute("role", type === "danger" ? "alert" : "status");
    el.setAttribute("aria-live", type === "danger" ? "assertive" : "polite");
    el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${icons[type] || icons.info} me-2"></i>${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    box.appendChild(el);
    const t = new bootstrap.Toast(el, { delay: type === "danger" ? 5000 : 3000 });
    el.addEventListener("hidden.bs.toast", () => el.remove());
    t.show();
  }

  // Shows the message of an AppError (or a generic one) as a red toast
  function showError(err) {
    // expected problems (AppError) are warnings; anything else is a real bug
    if (err && err.name === "AppError") console.warn(err.message); else console.error(err);
    toast(err && err.name === "AppError" ? err.message : "Something went wrong. Please try again.", "danger");
  }

  /* ---------- confirm dialog (Bootstrap modal) ---------- */

  function confirmDialog(title, body, okLabel = "Confirm", okClass = "btn-danger") {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = `
      <div class="modal fade" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content">
          <div class="modal-header border-0 pb-0"><h2 class="modal-title fs-6 fw-semibold">${escapeHtml(title)}</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
          <div class="modal-body text-body-secondary small">${escapeHtml(body)}</div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-light btn-sm" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn ${okClass} btn-sm" data-ok>${escapeHtml(okLabel)}</button>
          </div></div></div></div>`;
      const el = wrap.firstElementChild;
      document.body.appendChild(el);
      const modal = new bootstrap.Modal(el);
      let answer = false;
      el.querySelector("[data-ok]").addEventListener("click", () => { answer = true; modal.hide(); });
      el.addEventListener("hidden.bs.modal", () => { el.remove(); resolve(answer); });
      modal.show();
    });
  }

  // Button loading state while a "request" is in progress
  async function withBusy(button, task) {
    const html = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${button.dataset.busy || "Please wait"}`;
    try { return await task(); }
    finally { button.disabled = false; button.innerHTML = html; }
  }

  /* ---------- page guard + app shell ---------- */

  // Redirects to the login page when nobody is logged in in this tab
  function requireLogin() {
    const me = Store.currentUser();
    if (!me) {
      sessionStorage.setItem("cf_flash", "Please log in to continue.");
      location.replace("index.html");
      return null;      // the page script stops when it gets null
    }
    return me;
  }

  const NAV = [
    { key: "home", href: "home.html", icon: "bi-house-door", label: "News feed" },
    { key: "profile", href: "profile.html", icon: "bi-person-badge", label: "My profile" },
    { key: "people", href: "people.html", icon: "bi-people", label: "People" },
    { key: "messages", href: "messages.html", icon: "bi-chat-dots", label: "Messages" }
  ];

  function navLinks(active, badges) {
    return NAV.map((n) => {
      const badge = badges[n.key] ? `<span class="badge rounded-pill text-bg-warning ms-auto">${badges[n.key]}</span>` : "";
      return `<li class="nav-item"><a class="nav-link d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${active === n.key ? "active" : ""}"
        href="${n.href}" ${active === n.key ? 'aria-current="page"' : ""}><i class="bi ${n.icon} fs-5"></i><span>${n.label}</span>${badge}</a></li>`;
    }).join("");
  }

  // Renders the sidebar (desktop) and the top bar + offcanvas menu (mobile) into #shell-nav
  function renderShell(active) {
    const me = Store.currentUser();
    const badges = { messages: Store.unreadCount(), people: Store.invitesForMe().received.length };
    const userBlock = `
      <a href="profile.html" class="d-flex align-items-center gap-2 text-reset text-decoration-none p-2 rounded-3 user-chip">
        ${avatar(me, 40)}<span class="lh-sm"><span class="d-block fw-semibold small">${escapeHtml(me.name)}</span>
        <span class="d-block text-body-secondary small">@${escapeHtml(me.username)}</span></span></a>`;
    const brand = `<a href="home.html" class="brand d-flex align-items-center gap-2 text-decoration-none">
        <span class="brand-mark d-inline-flex align-items-center justify-content-center rounded-3"><i class="bi bi-link-45deg"></i></span>
        <span class="fw-bold fs-5 text-body">Connec<span class="text-primary">Friend</span></span></a>`;

    document.getElementById("shell-nav").innerHTML = `
      <!-- desktop sidebar -->
      <aside class="sidebar d-none d-lg-flex flex-column border-end bg-body p-3 position-fixed top-0 start-0 h-100">
        <div class="mb-4 px-2 pt-1">${brand}</div>
        <ul class="nav nav-pills flex-column gap-1 mb-auto">${navLinks(active, badges)}</ul>
        <div class="border-top pt-3">${userBlock}
          <button class="btn btn-outline-secondary btn-sm w-100 mt-2" data-action="logout"><i class="bi bi-box-arrow-left me-1"></i>Log out</button>
        </div>
      </aside>

      <!-- mobile top bar -->
      <header class="d-lg-none navbar bg-body border-bottom sticky-top px-3">
        ${brand}
        <button class="btn btn-light position-relative" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNav" aria-controls="mobileNav" aria-label="Open menu">
          <i class="bi bi-list fs-5"></i>${badges.messages + badges.people ? '<span class="position-absolute top-0 start-100 translate-middle p-1 bg-warning rounded-circle"><span class="visually-hidden">New activity</span></span>' : ""}
        </button>
      </header>
      <div class="offcanvas offcanvas-start" tabindex="-1" id="mobileNav" aria-labelledby="mobileNavLabel" style="width:280px">
        <div class="offcanvas-header"><h2 class="offcanvas-title fs-6" id="mobileNavLabel">${brand}</h2>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button></div>
        <div class="offcanvas-body d-flex flex-column">
          <ul class="nav nav-pills flex-column gap-1 mb-auto">${navLinks(active, badges)}</ul>
          <div class="border-top pt-3">${userBlock}
            <button class="btn btn-outline-secondary btn-sm w-100 mt-2" data-action="logout"><i class="bi bi-box-arrow-left me-1"></i>Log out</button></div>
        </div>
      </div>`;

    document.querySelectorAll('[data-action="logout"]').forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (await confirmDialog("Log out?", "You will need your username and password to sign in again.", "Log out", "btn-primary")) {
          Store.logout();
          sessionStorage.setItem("cf_flash", "You have been logged out.");
          location.href = "index.html";
        }
      }));
  }

  /* ---------- friend rating (1 Stupid, 2 Cool, 3 Trustworthy) ---------- */

  // Three icon buttons; the current rating is filled with its colour
  function ratingGroup(friendId, current, small = true) {
    return `<div class="btn-group rating-group" role="group" aria-label="Rate this friend">` +
      [1, 2, 3].map((value) => {
        const r = RATINGS[value];
        const on = current === value;
        return `<button type="button" class="btn ${small ? "btn-sm" : ""} ${on ? "btn-" + r.color : "btn-outline-secondary"}"
          data-rate="${value}" data-friend="${friendId}" aria-pressed="${on}"
          data-bs-toggle="tooltip" data-bs-title="${r.label}" aria-label="Rate ${r.label}"><i class="bi ${r.icon}"></i></button>`;
      }).join("") + `</div>`;
  }

  // Small read-only badge for a rating (or nothing if not rated)
  function ratingBadge(value) {
    if (!value) return "";
    const r = RATINGS[value];
    return `<span class="badge rounded-pill text-bg-${r.color} bg-opacity-75"><i class="bi ${r.icon} me-1"></i>${r.label}</span>`;
  }

  // One click handler for every rating group inside root; onChange runs after a successful save
  function bindRatings(root, onChange) {
    root.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-rate]");
      if (!btn) return;
      bootstrap.Tooltip.getInstance(btn)?.hide();
      try {
        const value = await Store.rateFriend(btn.dataset.friend, btn.dataset.rate);
        const name = Store.getUser(btn.dataset.friend)?.name || "Friend";
        toast(`${name} rated as ${RATINGS[value].label}.`, "success");
        onChange && onChange();
      } catch (err) {
        showError(err);
      }
    });
  }

  // Enable Bootstrap tooltips inside a container (call again after re-rendering)
  function tooltips(root = document) {
    root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => bootstrap.Tooltip.getOrCreateInstance(el));
  }

  // Last-resort handler so unexpected errors are reported instead of failing silently
  window.addEventListener("unhandledrejection", (e) => { showError(e.reason); e.preventDefault(); });

  return {
    escapeHtml, timeAgo, avatar, isActive, toast, showError, confirmDialog, withBusy,
    requireLogin, renderShell, tooltips, ratingGroup, ratingBadge, bindRatings
  };
})();
