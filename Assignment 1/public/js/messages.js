/* ConnecFriend — private messaging page */
(function () {
  const me = UI.requireLogin();
  if (!me) return;          // not signed in: already redirecting to the login page
  const { escapeHtml, avatar, timeAgo, isActive } = UI;

  UI.renderShell("messages");

  const listBox = document.getElementById("conversationList");
  const messageList = document.getElementById("messageList");
  const input = document.getElementById("messageInput");
  const sendError = document.getElementById("sendError");
  let activeId = null;
  let typingTimer = null;
  let theirTypingTimer = null;

  /* ---------- connection status ---------- */

  function setStatus(mode) {
    const pill = document.getElementById("connStatus");
    const styles = {
      live: ["text-bg-success", "Live · Socket.IO", "Messages are delivered in real time through the chat server."],
      reconnecting: ["text-bg-warning", "Reconnecting…", "Lost the chat server. Trying to reconnect."],
      local: ["text-bg-light border", "Local mode", "Chat server not running: messages reach other tabs of this browser. Run npm start for live chat."]
    };
    const [cls, label, tip] = styles[mode] || styles.local;
    pill.className = `badge rounded-pill ${cls}`;
    pill.innerHTML = `<i class="bi bi-circle-fill me-1 small"></i>${label}`;
    pill.setAttribute("data-bs-title", tip);
    pill.setAttribute("data-bs-toggle", "tooltip");
    bootstrap.Tooltip.getInstance(pill)?.dispose();
    new bootstrap.Tooltip(pill);
    renderHeader();
  }

  const online = (user) => (Chat.isLive() ? Chat.isOnline(user.id) : isActive(user));

  /* ---------- conversation list ---------- */

  function renderList() {
    const convos = Store.conversations();
    listBox.innerHTML = convos.length
      ? convos.map(({ userId, last, unread }) => {
          const u = Store.getUser(userId);
          if (!u) return "";
          const preview = (last.from === me.id ? "You: " : "") + last.text;
          return `<button type="button" class="list-group-item list-group-item-action d-flex gap-3 align-items-center py-3 ${userId === activeId ? "active" : ""}"
                    data-open="${userId}" ${userId === activeId ? 'aria-current="true"' : ""}>
            <span class="position-relative">${avatar(u, 44)}
              ${online(u) ? '<span class="presence position-absolute bottom-0 end-0 bg-success rounded-circle"></span>' : ""}</span>
            <span class="flex-grow-1 min-w-0 text-start">
              <span class="d-flex justify-content-between gap-2"><span class="fw-semibold text-truncate">${escapeHtml(u.name)}</span>
                <span class="small ${userId === activeId ? "" : "text-body-secondary"} flex-shrink-0">${timeAgo(last.sentAt)}</span></span>
              <span class="d-flex justify-content-between gap-2 small"><span class="text-truncate ${unread ? "fw-semibold" : userId === activeId ? "" : "text-body-secondary"}">${escapeHtml(preview)}</span>
                ${unread ? `<span class="badge rounded-pill text-bg-warning">${unread}</span>` : ""}</span>
            </span>
          </button>`;
        }).join("")
      : `<div class="text-center text-body-secondary small p-4">No conversations yet.</div>`;
  }

  listBox.addEventListener("click", (e) => {
    const item = e.target.closest("[data-open]");
    if (item) openConversation(item.dataset.open);
  });

  /* ---------- active conversation ---------- */

  function renderHeader() {
    if (!activeId) return;
    const u = Store.getUser(activeId);
    document.getElementById("chatAvatarLink").href = `profile.html?id=${u.id}`;
    document.getElementById("chatAvatarLink").innerHTML = avatar(u, 42);
    document.getElementById("chatName").href = `profile.html?id=${u.id}`;
    document.getElementById("chatName").textContent = u.name;
    document.getElementById("chatSub").innerHTML = online(u)
      ? '<span class="text-success"><i class="bi bi-circle-fill small me-1"></i>Online</span>'
      : `Last login ${timeAgo(u.lastLogin)}`;
    const relation = Store.relationTo(u.id);
    document.getElementById("chatRelation").innerHTML = relation === "friend"
      ? '<span class="badge text-bg-primary bg-opacity-75">Friend</span>'
      : '<span class="badge text-bg-light border" data-bs-toggle="tooltip" data-bs-title="You can message any member, not only friends">Not a friend</span>';
    UI.tooltips(document.getElementById("chatRelation"));
  }

  function bubble(m) {
    const mine = m.from === me.id;
    const time = new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const status = mine ? `<i class="bi ${m.delivery === "queued" ? "bi-clock" : "bi-check2"} ms-1" data-status></i>` : "";
    return `<div class="d-flex ${mine ? "justify-content-end" : "justify-content-start"} mb-2" data-msg="${m.id}">
      <div class="bubble px-3 py-2 rounded-4 shadow-sm ${mine ? "bg-primary text-white rounded-bottom-end-0" : "bg-body rounded-bottom-start-0"}">
        <div class="bubble-text">${escapeHtml(m.text)}</div>
        <div class="small text-end ${mine ? "text-white-50" : "text-body-secondary"}" style="font-size:.72rem">${time}${status}</div>
      </div></div>`;
  }

  function renderMessages() {
    const msgs = Store.thread(activeId);
    let lastDay = "";
    messageList.innerHTML = msgs.length
      ? msgs.map((m) => {
          const day = new Date(m.sentAt).toDateString();
          const divider = day !== lastDay
            ? `<div class="text-center my-3"><span class="badge text-bg-light border fw-normal">${new Date(m.sentAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span></div>` : "";
          lastDay = day;
          return divider + bubble(m);
        }).join("")
      : `<div class="text-center text-body-secondary small mt-5">No messages yet. Say hello to ${escapeHtml(Store.getUser(activeId).name.split(" ")[0])}!</div>`;
    messageList.scrollTop = messageList.scrollHeight;
  }

  function openConversation(userId) {
    const user = Store.getUser(userId);
    if (!user || userId === me.id) {
      UI.toast(userId === me.id ? "You cannot message yourself." : "That member could not be found.", "warning");
      return;
    }
    activeId = userId;
    history.replaceState(null, "", `messages.html?to=${userId}`);
    Store.markRead(userId);
    document.getElementById("chatEmpty").classList.add("d-none");
    document.getElementById("chatActive").classList.replace("d-none", "d-flex");
    // on phones show the chat instead of the list
    document.getElementById("listPane").classList.add("d-none", "d-md-flex");
    document.getElementById("chatPane").classList.replace("d-none", "d-flex");
    document.getElementById("typingRow").classList.add("d-none");
    sendError.textContent = "";
    renderHeader();
    renderMessages();
    renderList();
    UI.renderShell("messages");
    input.focus();
  }

  document.getElementById("backBtn").addEventListener("click", () => {
    document.getElementById("listPane").classList.remove("d-none");
    document.getElementById("chatPane").classList.replace("d-flex", "d-none");
  });

  /* ---------- sending ---------- */

  async function send() {
    sendError.textContent = "";
    const text = input.value;
    if (!text.trim()) { sendError.textContent = "Type a message first."; input.focus(); return; }
    const btn = document.getElementById("sendBtn");
    btn.disabled = true;
    try {
      const { message, delivery } = await Chat.send(activeId, text);
      input.value = "";
      updateCounter();
      Chat.typing(activeId, false);
      if (!messageList.querySelector(`[data-msg="${message.id}"]`)) {
        if (!messageList.querySelector("[data-msg]")) messageList.innerHTML = "";
        messageList.insertAdjacentHTML("beforeend", bubble({ ...message, delivery }));
        messageList.scrollTop = messageList.scrollHeight;
      }
      if (delivery === "queued") UI.toast(`${Store.getUser(activeId).name.split(" ")[0]} is offline. The message will be delivered when they come online.`, "info");
      renderList();
    } catch (err) {
      sendError.textContent = err.name === "AppError" ? err.message : "Message could not be sent. Please try again.";
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  document.getElementById("sendForm").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });

  function updateCounter() {
    document.getElementById("msgCounter").textContent = `${input.value.length} / ${Store.LIMITS.message}`;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }
  input.addEventListener("input", () => {
    updateCounter();
    sendError.textContent = "";
    if (!activeId) return;
    Chat.typing(activeId, true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => Chat.typing(activeId, false), 1500);
  });

  /* ---------- new conversation (any member) ---------- */

  const memberList = document.getElementById("memberList");
  const memberSearch = document.getElementById("memberSearch");
  function renderMembers() {
    const q = memberSearch.value.trim().toLowerCase();
    const people = Store.allUsers()
      .filter((u) => u.id !== me.id && (!q || u.name.toLowerCase().includes(q) || u.username.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    memberList.innerHTML = people.length
      ? people.map((u) => `<button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-3" data-start="${u.id}">
          ${avatar(u, 36)}<span class="flex-grow-1 text-start"><span class="d-block fw-semibold small">${escapeHtml(u.name)}</span>
          <span class="small text-body-secondary">@${escapeHtml(u.username)}</span></span>
          ${Store.relationTo(u.id) === "friend" ? '<span class="badge text-bg-primary bg-opacity-75">Friend</span>' : '<span class="badge text-bg-light border">Member</span>'}</button>`).join("")
      : `<p class="small text-body-secondary mb-0">No members match your search.</p>`;
  }
  memberSearch.addEventListener("input", renderMembers);
  document.getElementById("newChatModal").addEventListener("show.bs.modal", () => { memberSearch.value = ""; renderMembers(); });
  document.getElementById("newChatModal").addEventListener("shown.bs.modal", () => memberSearch.focus());
  memberList.addEventListener("click", (e) => {
    const item = e.target.closest("[data-start]");
    if (!item) return;
    bootstrap.Modal.getInstance(document.getElementById("newChatModal")).hide();
    openConversation(item.dataset.start);
  });

  /* ---------- incoming events ---------- */

  Chat.connect(me, {
    status: setStatus,
    presence: () => { renderList(); renderHeader(); },
    message: (m) => {
      const other = m.from === me.id ? m.to : m.from;
      if (other === activeId) {
        if (m.from === activeId) Store.markRead(activeId);
        document.getElementById("typingRow").classList.add("d-none");
        if (!messageList.querySelector(`[data-msg="${m.id}"]`)) {
          if (!messageList.querySelector("[data-msg]")) messageList.innerHTML = "";
          messageList.insertAdjacentHTML("beforeend", bubble(m));
          messageList.scrollTop = messageList.scrollHeight;
        }
      } else if (m.from !== me.id) {
        UI.toast(`New message from ${Store.getUser(m.from)?.name || "a member"}.`, "info");
      }
      renderList();
      UI.renderShell("messages");
    },
    typing: (fromId, isTyping) => {
      if (fromId !== activeId) return;
      const row = document.getElementById("typingRow");
      document.getElementById("typingText").textContent = `${Store.getUser(fromId).name.split(" ")[0]} is typing…`;
      row.classList.toggle("d-none", !isTyping);
      clearTimeout(theirTypingTimer);
      if (isTyping) theirTypingTimer = setTimeout(() => row.classList.add("d-none"), 4000);
    }
  });

  // Keep "time ago" labels fresh
  setInterval(() => { renderList(); renderHeader(); }, 60000);

  renderList();
  const to = new URLSearchParams(location.search).get("to");
  if (to) openConversation(to);
})();
