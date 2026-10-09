/* ==========================================================================
   ConnecFriend — private message transport
   --------------------------------------------------------------------------
   Live mode : when the app is opened from the Node server (npm start), the
               Socket.IO client is loaded from the server and messages,
               typing indicators and online status travel over the socket.
   Local mode: when the pages are opened as plain files (or the server is
               down), messages are still saved and are delivered to other
               tabs of the same browser through a BroadcastChannel, so two
               tabs logged in as different members can chat.
   Every message has a unique id, so a message that arrives twice (socket +
   channel) is only stored and shown once.
   ========================================================================== */

const Chat = (() => {
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("connecfriend-chat") : null;
  let socket = null;
  let me = null;
  let handlers = {};
  let online = new Set();

  const emit = (name, ...args) => handlers[name] && handlers[name](...args);

  function loadSocketClient() {
    return new Promise((resolve) => {
      if (!location.protocol.startsWith("http")) return resolve(false);   // opened as a file
      if (window.io) return resolve(true);
      const s = document.createElement("script");
      s.src = "/socket.io/socket.io.js";
      s.onload = () => resolve(Boolean(window.io));
      s.onerror = () => resolve(false);                                    // no server: stay local
      document.head.appendChild(s);
    });
  }

  function deliver(message) {
    if (message.to !== me.id && message.from !== me.id) return;
    Store.receiveMessage(message);          // no-op if this tab already stored it
    emit("message", message);
  }

  /**
   * Starts the chat connection.
   * @param {object} user  the logged-in member
   * @param {object} on    callbacks: message(msg), status("live"|"local"|"reconnecting"),
   *                       presence(Set of online ids), typing(fromId, isTyping)
   */
  async function connect(user, on) {
    me = user;
    handlers = on;

    // Other tabs of this browser
    if (channel) {
      channel.onmessage = ({ data }) => {
        if (data.type === "message") deliver(data.message);
        if (data.type === "typing" && data.to === me.id) emit("typing", data.from, data.typing);
      };
    }

    emit("status", "local");
    if (!(await loadSocketClient())) return;

    socket = window.io({ reconnectionAttempts: 5, timeout: 4000 });
    socket.on("connect", () => {
      socket.emit("join", { userId: me.id, name: me.name });
      emit("status", "live");
    });
    socket.on("disconnect", () => emit("status", "reconnecting"));
    socket.io.on("reconnect_failed", () => emit("status", "local"));
    socket.on("connect_error", () => { if (!socket.active) emit("status", "local"); });
    socket.on("private-message", deliver);
    socket.on("presence", (ids) => { online = new Set(ids); emit("presence", online); });
    socket.on("typing", ({ from, typing }) => emit("typing", from, typing));
  }

  /**
   * Validates and saves a message, then sends it to the other person.
   * Resolves with { message, delivery } where delivery is
   * "delivered" | "queued" (recipient offline, server will deliver later) | "local".
   */
  async function send(toId, text) {
    const message = await Store.sendMessage(toId, text);   // throws AppError on bad input
    channel && channel.postMessage({ type: "message", message });

    if (!socket || !socket.connected) return { message, delivery: "local" };

    const delivery = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve("local"), 4000);   // no answer from the server
      socket.emit("private-message", message, (ack) => {
        clearTimeout(timer);
        resolve(ack && ack.ok ? (ack.delivered ? "delivered" : "queued") : "local");
      });
    });
    return { message, delivery };
  }

  function typing(toId, isTyping) {
    const payload = { from: me.id, to: toId, typing: isTyping };
    channel && channel.postMessage({ type: "typing", ...payload });
    if (socket && socket.connected) socket.emit("typing", payload);
  }

  const isOnline = (id) => online.has(id);
  const isLive = () => Boolean(socket && socket.connected);

  return { connect, send, typing, isOnline, isLive };
})();
