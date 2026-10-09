/* ==========================================================================
   ConnecFriend — basic chat server (Express + Socket.IO)
   --------------------------------------------------------------------------
   Serves the pages in /public and relays private messages in real time.

     npm install
     npm start          -> http://localhost:3000

   Socket events
     client -> server   join             { userId, name }
                        private-message  message object, ack callback
                        typing           { from, to, typing }
     server -> client   private-message  message object
                        presence         [ ids of online members ]
                        typing           { from, typing }

   Messages for members who are offline are kept in memory and delivered as
   soon as they join. Nothing is written to disk (this is a basic demo).
   ========================================================================== */

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const MAX_LENGTH = 1000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server);

const sockets = new Map();   // userId -> Set of socket ids (one member can have several tabs open)
const pending = new Map();   // userId -> messages waiting for them while offline

const onlineIds = () => [...sockets.keys()];
const room = (userId) => `user:${userId}`;

function isValidMessage(m) {
  return m && typeof m.id === "string" && typeof m.from === "string" && typeof m.to === "string" &&
    typeof m.text === "string" && m.text.trim().length > 0 && m.text.length <= MAX_LENGTH && m.from !== m.to;
}

io.on("connection", (socket) => {
  // A member opens the messages page
  socket.on("join", ({ userId, name } = {}) => {
    if (typeof userId !== "string" || !userId) return;
    socket.data.userId = userId;
    socket.join(room(userId));
    if (!sockets.has(userId)) sockets.set(userId, new Set());
    sockets.get(userId).add(socket.id);
    console.log(`+ ${name || userId} connected (${socket.id})`);

    // deliver anything that arrived while they were offline
    const waiting = pending.get(userId) || [];
    waiting.forEach((m) => socket.emit("private-message", m));
    pending.delete(userId);

    io.emit("presence", onlineIds());
  });

  // Relay a private message to the recipient (and the sender's other tabs)
  socket.on("private-message", (message, ack = () => {}) => {
    if (!socket.data.userId) return ack({ ok: false, error: "Join first." });
    if (!isValidMessage(message) || message.from !== socket.data.userId) {
      return ack({ ok: false, error: "Invalid message." });
    }
    const clean = { id: message.id, from: message.from, to: message.to, text: message.text.trim(), sentAt: Number(message.sentAt) || Date.now() };

    socket.to(room(clean.from)).emit("private-message", clean);   // sender's other tabs

    if (sockets.has(clean.to)) {
      io.to(room(clean.to)).emit("private-message", clean);
      ack({ ok: true, delivered: true });
    } else {
      const queue = pending.get(clean.to) || [];
      queue.push(clean);
      pending.set(clean.to, queue);
      ack({ ok: true, delivered: false });
    }
  });

  socket.on("typing", ({ to, typing } = {}) => {
    if (socket.data.userId && typeof to === "string") {
      socket.to(room(to)).emit("typing", { from: socket.data.userId, typing: Boolean(typing) });
    }
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (!userId || !sockets.has(userId)) return;
    sockets.get(userId).delete(socket.id);
    if (sockets.get(userId).size === 0) sockets.delete(userId);
    console.log(`- ${userId} disconnected (${socket.id})`);
    io.emit("presence", onlineIds());
  });
});

// Only start listening when run directly (the test script imports the server)
if (require.main === module) {
  server.listen(PORT, () => console.log(`ConnecFriend running at http://localhost:${PORT}`));
}

module.exports = { server, io };
