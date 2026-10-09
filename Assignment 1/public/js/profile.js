/* ConnecFriend — profile page (own profile, or another member's with ?id=) */
(function () {
  const me = UI.requireLogin();
  if (!me) return;          // not signed in: already redirecting to the login page
  const { escapeHtml, avatar, timeAgo, isActive } = UI;

  const params = new URLSearchParams(location.search);
  const profileId = params.get("id") || me.id;
  const isMe = profileId === me.id;

  UI.renderShell(isMe ? "profile" : "people");

  if (!Store.getUser(profileId)) {
    document.getElementById("profileArea").classList.add("d-none");
    const nf = document.getElementById("notFound");
    nf.classList.remove("d-none");
    nf.innerHTML = `<div class="card border-0 shadow-sm"><div class="card-body text-center py-5">
      <i class="bi bi-person-x display-5 text-body-tertiary"></i>
      <h1 class="h4 mt-3">Member not found</h1>
      <p class="text-body-secondary">This profile does not exist or the link is wrong.</p>
      <a href="people.html" class="btn btn-primary">Browse people</a></div></div>`;
    return;
  }

  /* ---------- header ---------- */

  function renderHeader() {
    const user = Store.getUser(profileId);
    document.title = `${user.name} · ConnecFriend`;
    document.getElementById("profileName").textContent = user.name;
    document.getElementById("profileHandle").innerHTML =
      `@${escapeHtml(user.username)} · ${isActive(user) ? '<span class="text-success"><i class="bi bi-circle-fill small me-1"></i>Active now</span>' : `Last login ${timeAgo(user.lastLogin)}`}`;

    document.getElementById("pictureBox").innerHTML =
      `<div class="rounded-circle border border-4 border-white shadow-sm d-inline-block">${avatar(user, 112)}</div>` +
      (isMe ? `<button class="btn btn-sm btn-primary rounded-circle position-absolute bottom-0 end-0" id="changePic"
                 data-bs-toggle="tooltip" data-bs-title="Change profile picture" aria-label="Change profile picture"><i class="bi bi-camera"></i></button>` : "");

    renderActions();
    UI.tooltips(document.getElementById("pictureBox"));
  }

  // Buttons depend on the relationship between me and this member
  function renderActions() {
    const box = document.getElementById("profileActions");
    if (isMe) {
      box.innerHTML = `<a href="home.html" class="btn btn-outline-primary btn-sm"><i class="bi bi-broadcast me-1"></i>Share news</a>`;
      return;
    }
    const relation = Store.relationTo(profileId);
    const message = `<a href="messages.html?to=${profileId}" class="btn btn-primary btn-sm"><i class="bi bi-chat-dots me-1"></i>Message</a>`;
    const ignoring = relation === "ignoring";
    const ignoreBtn = `<button class="btn btn-light btn-sm" data-action="ignore">${ignoring ? '<i class="bi bi-eye me-1"></i>Stop ignoring' : '<i class="bi bi-eye-slash me-1"></i>Ignore'}</button>`;
    const buttons = {
      friend: `${message}<span class="d-inline-flex align-items-center gap-2 ms-1">${UI.ratingGroup(profileId, Store.ratingOf(profileId), true)}</span>
               <button class="btn btn-outline-danger btn-sm" data-action="unfriend"><i class="bi bi-person-dash me-1"></i>Unfriend</button>`,
      sent: `${message}<span class="btn btn-light btn-sm disabled"><i class="bi bi-hourglass-split me-1"></i>Request sent</span>`,
      received: `${message}<a href="people.html#requests" class="btn btn-success btn-sm"><i class="bi bi-person-check me-1"></i>Respond to request</a>`,
      blocked: `${message}<button class="btn btn-outline-primary btn-sm" data-action="invite" data-busy="Sending"><i class="bi bi-person-plus me-1"></i>Invite as friend</button>${ignoreBtn}`,
      ignoring: `${ignoreBtn}`,
      none: `${message}<button class="btn btn-outline-primary btn-sm" data-action="invite" data-busy="Sending"><i class="bi bi-person-plus me-1"></i>Invite as friend</button>${ignoreBtn}`
    };
    box.innerHTML = buttons[relation] || "";
    UI.tooltips(box);
  }

  document.getElementById("profileActions").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const user = Store.getUser(profileId);
    try {
      if (btn.dataset.action === "invite") {
        await UI.withBusy(btn, () => Store.sendInvite(profileId));
        UI.toast(`Friend request sent to ${user.name}.`);
      } else if (btn.dataset.action === "unfriend") {
        if (!(await UI.confirmDialog(`Unfriend ${user.name}?`, "You will stop seeing each other's news. Your rating for them will be removed.", "Unfriend"))) return;
        await Store.unfriend(profileId);
        UI.toast(`${user.name} was removed from your friends.`, "info");
        renderAll();
      } else if (btn.dataset.action === "ignore") {
        const now = await Store.toggleIgnore(profileId);
        UI.toast(now ? `${user.name} is on your ignore list.` : `You stopped ignoring ${user.name}.`, "info");
      }
      renderActions();
    } catch (err) {
      UI.showError(err);
    }
  });
  UI.bindRatings(document.getElementById("profileActions"), renderActions);

  /* ---------- personal information ---------- */

  function renderInfo() {
    const user = Store.getUser(profileId);
    const row = (icon, label, value) => value
      ? `<li class="d-flex gap-2"><i class="bi ${icon} text-primary"></i><span><span class="text-body-secondary">${label}</span><br><span class="fw-medium">${escapeHtml(value)}</span></span></li>` : "";
    document.getElementById("profileBio").textContent = user.bio || "";
    document.getElementById("profileInfo").innerHTML = [
      row("bi-briefcase", "Work / study", user.work),
      row("bi-geo-alt", "Lives in", user.city),
      row("bi-house", "Hometown", user.hometown),
      row("bi-balloon", "Born in", user.born),
      row("bi-calendar-check", "Member since", new Date(user.joined).toLocaleDateString("en-GB", { month: "long", year: "numeric" })),
      row("bi-people", "Friends", String(user.friends.length))
    ].join("");
    document.getElementById("editInfoBtn").classList.toggle("d-none", !isMe);
  }

  /* ---------- friends list ---------- */

  function renderFriends() {
    const friends = Store.friendsOf(profileId);
    document.getElementById("friendCount").textContent = friends.length;
    document.getElementById("ratingHint").innerHTML = isMe
      ? 'Rate: <i class="bi bi-emoji-dizzy"></i> Stupid · <i class="bi bi-sunglasses"></i> Cool · <i class="bi bi-shield-check"></i> Trustworthy' : "";
    const grid = document.getElementById("friendGrid");
    grid.innerHTML = friends.length
      ? friends.map((f) => `
        <div class="col">
          <div class="d-flex align-items-center gap-3 p-2 border rounded-3 h-100">
            <a href="profile.html?id=${f.id}">${avatar(f, 48)}</a>
            <div class="flex-grow-1 min-w-0 lh-sm">
              <a href="profile.html?id=${f.id}" class="fw-semibold text-body text-decoration-none d-block text-truncate">${escapeHtml(f.name)}</a>
              <span class="small text-body-secondary d-block">${escapeHtml(f.city)} · ${timeAgo(f.lastLogin)}</span>
              ${isMe ? `<div class="mt-2">${UI.ratingGroup(f.id, Store.ratingOf(f.id))}</div>` : ""}
            </div>
          </div>
        </div>`).join("")
      : `<div class="col-12"><p class="text-body-secondary small mb-0">${isMe ? "You have no friends yet. Invite people from the People page." : "No friends to show."}</p></div>`;
    UI.tooltips(grid);
  }
  UI.bindRatings(document.getElementById("friendGrid"), renderFriends);

  /* ---------- ignore list (own profile only) ---------- */

  function renderIgnoreList() {
    const card = document.getElementById("ignoreCard");
    card.classList.toggle("d-none", !isMe);
    if (!isMe) return;
    const ignored = Store.currentUser().ignores.map((id) => Store.getUser(id)).filter(Boolean);
    document.getElementById("ignoreList").innerHTML = ignored.length
      ? ignored.map((u) => `<li class="list-group-item d-flex align-items-center gap-2">${avatar(u, 32)}
          <span class="small flex-grow-1">${escapeHtml(u.name)}</span>
          <button class="btn btn-sm btn-light" data-unignore="${u.id}">Remove</button></li>`).join("")
      : `<li class="list-group-item small text-body-secondary">You are not ignoring anyone.</li>`;
  }
  document.getElementById("ignoreList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-unignore]");
    if (!btn) return;
    try {
      await Store.toggleIgnore(btn.dataset.unignore);
      UI.toast(`${Store.getUser(btn.dataset.unignore).name} removed from your ignore list.`, "info");
      renderIgnoreList();
    } catch (err) { UI.showError(err); }
  });

  /* ---------- posts ---------- */

  const postsBox = document.getElementById("profilePosts");
  function renderPosts() {
    const user = Store.getUser(profileId);
    document.getElementById("postsTitle").textContent = isMe ? "Your news" : `News from ${user.name.split(" ")[0]}`;
    const posts = Store.postsBy(profileId);
    const current = Store.currentUser();
    postsBox.innerHTML = posts.length
      ? posts.map((p) => Posts.card(p, current)).join("")
      : Posts.emptyState(isMe ? "You haven't shared any news yet." : Store.relationTo(profileId) === "friend"
          ? `${user.name.split(" ")[0]} hasn't shared any news with you.` : `Become friends with ${user.name.split(" ")[0]} to see their news.`);
    UI.tooltips(postsBox);
  }
  Posts.bind(postsBox, renderPosts);

  /* ---------- edit info + picture (own profile) ---------- */

  if (isMe) {
    const form = document.getElementById("editForm");
    document.getElementById("editModal").addEventListener("show.bs.modal", () => {
      const user = Store.currentUser();
      form.name.value = user.name; form.work.value = user.work; form.city.value = user.city; form.bio.value = user.bio;
      form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
      try {
        await UI.withBusy(document.getElementById("saveInfoBtn"), () => Store.updateProfile({
          name: form.name.value, work: form.work.value, city: form.city.value, bio: form.bio.value
        }));
        bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
        UI.toast("Your information was updated.");
        renderAll();
        UI.renderShell("profile");
      } catch (err) {
        const field = err.field && form[err.field];
        if (field) { field.classList.add("is-invalid"); field.nextElementSibling.textContent = err.message; field.focus(); }
        else UI.showError(err);
      }
    });

    const fileInput = document.getElementById("pictureInput");
    document.getElementById("pictureBox").addEventListener("click", (e) => {
      if (e.target.closest("#changePic")) fileInput.click();
    });
    fileInput.addEventListener("change", async () => {
      try {
        await Store.updatePicture(fileInput.files[0]);
        UI.toast("Profile picture updated.");
        renderAll();
        UI.renderShell("profile");
      } catch (err) {
        UI.showError(err);
      } finally {
        fileInput.value = "";
      }
    });
  }

  function renderAll() {
    renderHeader();
    renderInfo();
    renderFriends();
    renderIgnoreList();
    renderPosts();
  }

  renderAll();
  if (location.hash === "#friends") document.getElementById("friends").scrollIntoView();
})();
