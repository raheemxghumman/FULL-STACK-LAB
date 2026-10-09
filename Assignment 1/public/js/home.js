/* ConnecFriend — home page: share news, news feed, friends by last login, suggestions */
(function () {
  const me = UI.requireLogin();
  if (!me) return;          // not signed in: already redirecting to the login page
  const { escapeHtml, avatar, timeAgo, isActive } = UI;

  UI.renderShell("home");

  const hour = new Date().getHours();
  document.getElementById("greeting").textContent =
    `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${me.name.split(" ")[0]}`;
  document.getElementById("greetingDate").textContent =
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  document.getElementById("composerAvatar").innerHTML = avatar(Store.currentUser(), 44);

  /* ---------- news feed ---------- */

  const feedBox = document.getElementById("feed");
  let order = "login";

  function renderFeed() {
    const current = Store.currentUser();
    const posts = Store.feed(order);
    feedBox.innerHTML = posts.length
      ? posts.map((p) => Posts.card(p, current)).join("")
      : Posts.emptyState("No news yet. Add some friends or share your first update.", '<a href="people.html" class="btn btn-primary btn-sm">Find people</a>');
    UI.tooltips(feedBox);
  }
  Posts.bind(feedBox, renderFeed);

  document.querySelectorAll('input[name="order"]').forEach((r) =>
    r.addEventListener("change", () => { order = r.value; renderFeed(); }));

  /* ---------- friends ordered by last login ---------- */

  const friendList = document.getElementById("friendList");
  function renderFriends() {
    const friends = Store.friendsOf(me.id);
    friendList.innerHTML = friends.length
      ? friends.map((f) => `
        <li class="list-group-item border-0 px-3 py-2">
          <div class="d-flex align-items-center gap-3">
            <a href="profile.html?id=${f.id}" class="position-relative flex-shrink-0">${avatar(f, 40)}
              ${isActive(f) ? '<span class="presence position-absolute bottom-0 end-0 bg-success rounded-circle"><span class="visually-hidden">Active now</span></span>' : ""}</a>
            <div class="flex-grow-1 min-w-0 lh-sm">
              <a href="profile.html?id=${f.id}" class="fw-semibold small text-body text-decoration-none d-block text-truncate">${escapeHtml(f.name)}</a>
              <span class="small text-body-secondary"><i class="bi bi-clock-history me-1"></i>${timeAgo(f.lastLogin)}</span>
            </div>
            ${UI.ratingGroup(f.id, Store.ratingOf(f.id))}
          </div>
        </li>`).join("")
      : `<li class="list-group-item border-0 small text-body-secondary">You have no friends yet.</li>`;
    UI.tooltips(friendList);
  }
  UI.bindRatings(friendList, renderFriends);

  /* ---------- people you may know (invite) ---------- */

  const suggestBox = document.getElementById("suggestions");
  function renderSuggestions() {
    const people = Store.allUsers().filter((u) => ["none", "blocked", "sent"].includes(Store.relationTo(u.id))).slice(0, 4);
    suggestBox.innerHTML = people.length
      ? people.map((u) => {
          const sent = Store.relationTo(u.id) === "sent";
          return `
          <li class="list-group-item border-0 px-3 py-2 d-flex align-items-center gap-3">
            <a href="profile.html?id=${u.id}">${avatar(u, 40)}</a>
            <div class="flex-grow-1 min-w-0 lh-sm">
              <a href="profile.html?id=${u.id}" class="fw-semibold small text-body text-decoration-none d-block text-truncate">${escapeHtml(u.name)}</a>
              <span class="small text-body-secondary">${escapeHtml(u.city)}</span>
            </div>
            ${sent
              ? '<span class="badge text-bg-light border"><i class="bi bi-hourglass-split me-1"></i>Sent</span>'
              : `<button class="btn btn-sm btn-outline-primary" data-invite="${u.id}" data-busy="Sending"><i class="bi bi-person-plus"></i> Invite</button>`}
          </li>`;
        }).join("")
      : `<li class="list-group-item border-0 small text-body-secondary">No suggestions right now.</li>`;
  }
  suggestBox.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-invite]");
    if (!btn) return;
    try {
      await UI.withBusy(btn, () => Store.sendInvite(btn.dataset.invite));
      UI.toast(`Friend request sent to ${Store.getUser(btn.dataset.invite).name}.`);
      renderSuggestions();
    } catch (err) {
      UI.showError(err);
    }
  });

  /* ---------- share news ---------- */

  const form = document.getElementById("shareForm");
  const text = document.getElementById("postText");
  const counter = document.getElementById("postCounter");
  const picker = bootstrap.Collapse.getOrCreateInstance(document.getElementById("friendPicker"), { toggle: false });
  const checks = document.getElementById("friendChecks");
  const audienceError = document.getElementById("audienceError");

  checks.innerHTML = Store.friendsOf(me.id).map((f) => `
    <div class="col"><label class="form-check d-flex align-items-center gap-2 m-0 p-2 rounded-3 bg-body border">
      <input class="form-check-input m-0" type="checkbox" value="${f.id}">
      ${avatar(f, 26)}<span class="small text-truncate">${escapeHtml(f.name)}</span></label></div>`).join("");

  const picked = () => [...checks.querySelectorAll("input:checked")].map((c) => c.value);
  const updatePicked = () => {
    document.getElementById("pickedCount").textContent = `(${picked().length} selected)`;
    if (picked().length) audienceError.classList.add("d-none");
  };
  checks.addEventListener("change", updatePicked);
  document.getElementById("pickAll").addEventListener("click", (e) => { e.preventDefault(); checks.querySelectorAll("input").forEach((c) => (c.checked = true)); updatePicked(); });
  document.getElementById("pickNone").addEventListener("click", (e) => { e.preventDefault(); checks.querySelectorAll("input").forEach((c) => (c.checked = false)); updatePicked(); });

  document.querySelectorAll('input[name="audience"]').forEach((r) =>
    r.addEventListener("change", () => (r.value === "some" ? picker.show() : picker.hide())));

  text.addEventListener("input", () => {
    counter.textContent = `${text.value.length} / ${Store.LIMITS.post}`;
    text.classList.remove("is-invalid");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const audience = form.audience.value === "all" ? "all" : picked();
    text.classList.remove("is-invalid");
    audienceError.classList.add("d-none");
    try {
      await UI.withBusy(document.getElementById("shareBtn"), () => Store.sharePost(text.value, audience));
      UI.toast(audience === "all" ? "Shared with all your friends." : `Shared with ${audience.length} friend${audience.length > 1 ? "s" : ""}.`);
      form.reset();
      checks.querySelectorAll("input").forEach((c) => (c.checked = false));
      updatePicked();
      picker.hide();
      counter.textContent = `0 / ${Store.LIMITS.post}`;
      renderFeed();
    } catch (err) {
      if (err.field === "text") {
        text.classList.add("is-invalid");
        document.getElementById("postTextFeedback").textContent = err.message;
        text.focus();
      } else if (err.field === "audience") {
        audienceError.textContent = err.message;
        audienceError.classList.remove("d-none");
      } else {
        UI.showError(err);
      }
    }
  });

  renderFeed();
  renderFriends();
  renderSuggestions();
  UI.tooltips();
})();
