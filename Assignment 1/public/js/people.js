/* ConnecFriend — people page: member directory, invitations and requests */
(function () {
  const me = UI.requireLogin();
  if (!me) return;          // not signed in: already redirecting to the login page
  const { escapeHtml, avatar, timeAgo } = UI;

  UI.renderShell("people");

  const directory = document.getElementById("directory");
  const search = document.getElementById("search");
  let filter = "all";

  /* ---------- directory ---------- */

  // The action shown on a member card depends on how they relate to me
  function actionFor(user, relation) {
    const msg = `<a href="messages.html?to=${user.id}" class="btn btn-sm btn-light" data-bs-toggle="tooltip" data-bs-title="Send a private message" aria-label="Message ${escapeHtml(user.name)}"><i class="bi bi-chat-dots"></i></a>`;
    switch (relation) {
      case "friend":
        return `${UI.ratingGroup(user.id, Store.ratingOf(user.id))}${msg}`;
      case "sent":
        return `<span class="badge text-bg-light border py-2"><i class="bi bi-hourglass-split me-1"></i>Request sent</span>${msg}`;
      case "received":
        return `<a href="#requests" class="btn btn-sm btn-success"><i class="bi bi-person-check me-1"></i>Respond</a>${msg}`;
      case "ignoring":
        return `<span class="badge text-bg-secondary py-2"><i class="bi bi-eye-slash me-1"></i>Ignored by you</span>`;
      default: // "none" and "blocked" both show Invite; the store refuses the request when blocked
        return `<button class="btn btn-sm btn-outline-primary" data-invite="${user.id}" data-busy="Sending"><i class="bi bi-person-plus me-1"></i>Invite</button>${msg}`;
    }
  }

  function renderDirectory() {
    const q = search.value.trim().toLowerCase();
    const people = Store.allUsers()
      .filter((u) => u.id !== me.id)
      .map((u) => ({ user: u, relation: Store.relationTo(u.id) }))
      .filter(({ relation }) => filter === "all" || (filter === "friends" ? relation === "friend" : relation !== "friend"))
      .filter(({ user }) => !q || [user.name, user.username, user.city].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => b.user.lastLogin - a.user.lastLogin);

    directory.innerHTML = people.length
      ? people.map(({ user, relation }) => `
        <div class="col">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body d-flex gap-3">
              <a href="profile.html?id=${user.id}">${avatar(user, 56)}</a>
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex flex-wrap align-items-center gap-2">
                  <a href="profile.html?id=${user.id}" class="fw-semibold text-body text-decoration-none">${escapeHtml(user.name)}</a>
                  ${relation === "friend" ? '<span class="badge text-bg-primary bg-opacity-75">Friend</span>' : ""}
                </div>
                <p class="small text-body-secondary mb-1">@${escapeHtml(user.username)} · ${escapeHtml(user.city)}</p>
                <p class="small mb-2 text-truncate" title="${escapeHtml(user.work)}">${escapeHtml(user.work)}</p>
                <div class="d-flex flex-wrap align-items-center gap-2">${actionFor(user, relation)}</div>
              </div>
            </div>
          </div>
        </div>`).join("")
      : `<div class="col-12"><div class="card border-0 shadow-sm"><div class="card-body text-center text-body-secondary py-5">
           <i class="bi bi-search display-6 text-body-tertiary"></i><p class="mt-3 mb-0">No members match "${escapeHtml(search.value)}".</p></div></div></div>`;
    UI.tooltips(directory);
  }

  directory.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-invite]");
    if (!btn) return;
    const user = Store.getUser(btn.dataset.invite);
    try {
      await UI.withBusy(btn, () => Store.sendInvite(user.id));
      UI.toast(`Friend request sent to ${user.name}.`);
      renderAll();
    } catch (err) {
      UI.showError(err);   // e.g. "... has added you to their ignore list"
    }
  });
  UI.bindRatings(directory, renderDirectory);

  search.addEventListener("input", renderDirectory);
  document.querySelectorAll('input[name="filter"]').forEach((r) =>
    r.addEventListener("change", () => { filter = r.value; renderDirectory(); }));

  /* ---------- requests ---------- */

  function renderRequests() {
    const { received, sent } = Store.invitesForMe();
    document.getElementById("receivedCount").textContent = received.length;

    document.getElementById("receivedList").innerHTML = received.length
      ? received.map((i) => {
          const u = Store.getUser(i.from);
          return `<li class="list-group-item px-3 py-3">
            <div class="d-flex align-items-center gap-3 mb-2">${avatar(u, 44)}
              <div class="lh-sm"><a href="profile.html?id=${u.id}" class="fw-semibold small text-body text-decoration-none">${escapeHtml(u.name)}</a>
              <span class="d-block small text-body-secondary">wants to connect · ${timeAgo(i.sentAt)}</span></div></div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-primary flex-fill" data-respond="${i.id}" data-accept="1"><i class="bi bi-check-lg me-1"></i>Accept</button>
              <button class="btn btn-sm btn-light flex-fill" data-respond="${i.id}" data-accept="0">Decline</button>
            </div></li>`;
        }).join("")
      : `<li class="list-group-item small text-body-secondary px-3 py-3">No new requests.</li>`;

    document.getElementById("sentList").innerHTML = sent.length
      ? sent.map((i) => {
          const u = Store.getUser(i.to);
          return `<li class="list-group-item px-3 py-2 d-flex align-items-center gap-3">${avatar(u, 36)}
            <div class="flex-grow-1 lh-sm"><span class="small fw-semibold d-block">${escapeHtml(u.name)}</span>
            <span class="small text-body-secondary">sent ${timeAgo(i.sentAt)}</span></div>
            <button class="btn btn-sm btn-link text-danger text-decoration-none" data-cancel="${i.id}">Cancel</button></li>`;
        }).join("")
      : `<li class="list-group-item small text-body-secondary px-3 py-3">You have no pending requests.</li>`;
  }

  document.getElementById("requests").addEventListener("click", async (e) => {
    const respond = e.target.closest("[data-respond]");
    const cancel = e.target.closest("[data-cancel]");
    try {
      if (respond) {
        const invite = Store.invitesForMe().received.find((i) => i.id === respond.dataset.respond);
        const name = invite ? Store.getUser(invite.from).name : "That member";
        const accepted = await Store.respondToInvite(respond.dataset.respond, respond.dataset.accept === "1");
        UI.toast(accepted ? `You and ${name} are now friends.` : `Request from ${name} declined.`, accepted ? "success" : "info");
      } else if (cancel) {
        await Store.cancelInvite(cancel.dataset.cancel);
        UI.toast("Friend request cancelled.", "info");
      } else return;
      renderAll();
      UI.renderShell("people");
    } catch (err) {
      UI.showError(err);
    }
  });

  function renderAll() {
    renderDirectory();
    renderRequests();
  }
  renderAll();
})();
