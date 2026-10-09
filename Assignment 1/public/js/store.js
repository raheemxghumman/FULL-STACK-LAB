/* ==========================================================================
   ConnecFriend — data layer
   --------------------------------------------------------------------------
   Acts like a small API. Every public method returns a Promise and waits a
   moment before answering, to imitate a request going to a server and a
   response coming back. Errors are thrown as AppError with a user-friendly
   message, so the pages can show them in an alert or toast.

   Storage:
     localStorage   "cf_db"      the whole database (shared by all tabs)
     sessionStorage "cf_session" the logged-in user id (per tab, so two tabs
                                 can be logged in as two different members)
   ========================================================================== */

class AppError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "AppError";
    this.field = field;   // optional: which form field caused the error
  }
}

const Store = (() => {
  const DB_KEY = "cf_db";
  const SESSION_KEY = "cf_session";
  const MINUTE = 60 * 1000;
  const LIMITS = { post: 500, message: 1000, picture: 1.5 * 1024 * 1024 };

  /* ---------- low-level persistence ---------- */

  function createDatabase() {
    const now = Date.now();
    const ago = (min) => now - min * MINUTE;
    return {
      version: 1,
      users: SEED.users.map(({ lastLoginMin, ...u }) => ({ ...u, picture: null, lastLogin: ago(lastLoginMin) })),
      ratings: JSON.parse(JSON.stringify(SEED.ratings)),
      invites: SEED.invites.map(({ minAgo, ...i }) => ({ ...i, sentAt: ago(minAgo) })),
      posts: SEED.posts.map(({ minAgo, ...p }) => ({ ...p, createdAt: ago(minAgo) })),
      // the two most recent messages to Abdul Raheem start unread so the badge has something to show
      messages: SEED.messages.map(({ minAgo, ...m }) => ({ ...m, sentAt: ago(minAgo), read: !["m3", "m4"].includes(m.id) }))
    };
  }

  function read() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Stored data was unreadable, starting fresh.", e);
    }
    const db = createDatabase();
    write(db);
    return db;
  }

  function write(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      throw new AppError("Your browser storage is full, so the change could not be saved.");
    }
  }

  // Imitates a network request: waits, then runs the action against the database.
  function request(action, delay = 220) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const db = read();
          const result = action(db);
          resolve(result);
        } catch (err) {
          reject(err instanceof AppError ? err : new AppError("Something went wrong. Please try again."));
          if (!(err instanceof AppError)) console.error(err);
        }
      }, delay);
    });
  }

  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const publicUser = ({ password, ...u }) => u;   // never hand the password to the pages

  function sessionId() {
    return sessionStorage.getItem(SESSION_KEY);
  }
  function requireUser(db) {
    const me = db.users.find((u) => u.id === sessionId());
    if (!me) throw new AppError("Your session has ended. Please log in again.");
    return me;
  }
  function findUser(db, id) {
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new AppError("That member could not be found.");
    return user;
  }

  /* ---------- authentication ---------- */

  function login(username, password) {
    const name = String(username || "").trim().toLowerCase();
    if (!name) return Promise.reject(new AppError("Please enter your username.", "username"));
    if (!password) return Promise.reject(new AppError("Please enter your password.", "password"));
    return request((db) => {
      const user = db.users.find((u) => u.username === name);
      if (!user) throw new AppError("No ConnecFriend account uses that username.", "username");
      if (user.password !== password) throw new AppError("The password is incorrect.", "password");
      user.lastLogin = Date.now();          // friends will now see this user at the top
      write(db);
      sessionStorage.setItem(SESSION_KEY, user.id);
      return publicUser(user);
    }, 450);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Synchronous helpers for page guards and rendering
  function currentUser() {
    const id = sessionId();
    if (!id) return null;
    const user = read().users.find((u) => u.id === id);
    return user ? publicUser(user) : null;
  }
  function getUser(id) {
    const user = read().users.find((u) => u.id === id);
    return user ? publicUser(user) : null;
  }
  function allUsers() {
    return read().users.map(publicUser);
  }

  /* ---------- friends ---------- */

  // Friends ordered by their last login, the most recent first
  function friendsOf(userId) {
    const db = read();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return [];
    return user.friends
      .map((id) => db.users.find((u) => u.id === id))
      .filter(Boolean)
      .sort((a, b) => b.lastLogin - a.lastLogin)
      .map(publicUser);
  }

  function relationTo(otherId) {
    const db = read();
    const me = db.users.find((u) => u.id === sessionId());
    const other = db.users.find((u) => u.id === otherId);
    if (!me || !other) return "unknown";
    if (me.id === other.id) return "self";
    if (me.friends.includes(other.id)) return "friend";
    if (db.invites.some((i) => i.from === me.id && i.to === other.id)) return "sent";
    if (db.invites.some((i) => i.from === other.id && i.to === me.id)) return "received";
    if (other.ignores.includes(me.id)) return "blocked";     // they ignore me
    if (me.ignores.includes(other.id)) return "ignoring";    // I ignore them
    return "none";
  }

  /* ---------- invitations ---------- */

  function sendInvite(toId) {
    return request((db) => {
      const me = requireUser(db);
      const target = findUser(db, toId);
      if (target.id === me.id) throw new AppError("You cannot send a friend request to yourself.");
      if (me.friends.includes(target.id)) throw new AppError(`${target.name} is already your friend.`);
      if (db.invites.some((i) => i.from === me.id && i.to === target.id))
        throw new AppError(`You have already sent ${target.name} a friend request.`);
      if (db.invites.some((i) => i.from === target.id && i.to === me.id))
        throw new AppError(`${target.name} has already sent you a request. Accept it on the People page.`);
      // The rule from the brief: no request if the receiver has ignored the sender
      if (target.ignores.includes(me.id))
        throw new AppError(`Friend request not sent. ${target.name} has added you to their ignore list.`);
      if (me.ignores.includes(target.id))
        throw new AppError(`You are ignoring ${target.name}. Remove them from your ignore list first.`);
      const invite = { id: uid("i"), from: me.id, to: target.id, sentAt: Date.now() };
      db.invites.push(invite);
      write(db);
      return invite;
    });
  }

  function invitesForMe() {
    const db = read();
    const me = db.users.find((u) => u.id === sessionId());
    if (!me) return { received: [], sent: [] };
    return {
      received: db.invites.filter((i) => i.to === me.id),
      sent: db.invites.filter((i) => i.from === me.id)
    };
  }

  function respondToInvite(inviteId, accept) {
    return request((db) => {
      const me = requireUser(db);
      const invite = db.invites.find((i) => i.id === inviteId && i.to === me.id);
      if (!invite) throw new AppError("This friend request is no longer available.");
      db.invites = db.invites.filter((i) => i.id !== inviteId);
      if (accept) {
        const sender = findUser(db, invite.from);
        if (!me.friends.includes(sender.id)) me.friends.push(sender.id);
        if (!sender.friends.includes(me.id)) sender.friends.push(me.id);
      }
      write(db);
      return accept;
    });
  }

  function cancelInvite(inviteId) {
    return request((db) => {
      const me = requireUser(db);
      const before = db.invites.length;
      db.invites = db.invites.filter((i) => !(i.id === inviteId && i.from === me.id));
      if (db.invites.length === before) throw new AppError("This request was already answered.");
      write(db);
    });
  }

  function toggleIgnore(otherId) {
    return request((db) => {
      const me = requireUser(db);
      const other = findUser(db, otherId);
      if (other.id === me.id) throw new AppError("You cannot ignore yourself.");
      const ignoring = me.ignores.includes(other.id);
      me.ignores = ignoring ? me.ignores.filter((id) => id !== other.id) : [...me.ignores, other.id];
      write(db);
      return !ignoring;
    });
  }

  function unfriend(otherId) {
    return request((db) => {
      const me = requireUser(db);
      const other = findUser(db, otherId);
      me.friends = me.friends.filter((id) => id !== other.id);
      other.friends = other.friends.filter((id) => id !== me.id);
      if (db.ratings[me.id]) delete db.ratings[me.id][other.id];
      write(db);
    });
  }

  /* ---------- ratings (1 Stupid, 2 Cool, 3 Trustworthy) ---------- */

  function ratingOf(friendId) {
    const db = read();
    return (db.ratings[sessionId()] || {})[friendId] || 0;
  }

  function rateFriend(friendId, rating) {
    return request((db) => {
      const me = requireUser(db);
      const value = Number(rating);
      if (![1, 2, 3].includes(value)) throw new AppError("Choose a rating between 1 and 3.");
      if (!me.friends.includes(friendId)) throw new AppError("You can only rate people on your friends list.");
      db.ratings[me.id] = db.ratings[me.id] || {};
      db.ratings[me.id][friendId] = value;
      write(db);
      return value;
    }, 150);
  }

  /* ---------- news feed ---------- */

  function canSee(post, viewer) {
    if (post.author === viewer.id) return true;
    if (!viewer.friends.includes(post.author)) return false;
    return post.audience === "all" || post.audience.includes(viewer.id);
  }

  // order: "login" = friends who logged in most recently first (the brief), "recent" = newest posts first
  function feed(order = "login") {
    const db = read();
    const me = db.users.find((u) => u.id === sessionId());
    if (!me) return [];
    const author = (id) => db.users.find((u) => u.id === id);
    return db.posts
      .filter((p) => author(p.author) && canSee(p, me))
      .sort((a, b) =>
        order === "recent"
          ? b.createdAt - a.createdAt
          : author(b.author).lastLogin - author(a.author).lastLogin || b.createdAt - a.createdAt
      )
      .map((p) => ({ ...p, authorUser: publicUser(author(p.author)) }));
  }

  function postsBy(userId) {
    const db = read();
    const me = db.users.find((u) => u.id === sessionId());
    if (!me) return [];
    return db.posts.filter((p) => p.author === userId && canSee(p, me)).sort((a, b) => b.createdAt - a.createdAt);
  }

  function sharePost(text, audience) {
    const body = String(text || "").trim();
    if (!body) return Promise.reject(new AppError("Write something before sharing.", "text"));
    if (body.length > LIMITS.post)
      return Promise.reject(new AppError(`News can be at most ${LIMITS.post} characters (yours is ${body.length}).`, "text"));
    if (audience !== "all" && (!Array.isArray(audience) || audience.length === 0))
      return Promise.reject(new AppError("Pick at least one friend to share with, or choose All friends.", "audience"));
    return request((db) => {
      const me = requireUser(db);
      if (audience !== "all" && audience.some((id) => !me.friends.includes(id)))
        throw new AppError("You can only share with people on your friends list.");
      const post = { id: uid("p"), author: me.id, text: body, audience, createdAt: Date.now(), likes: [], dislikes: [] };
      db.posts.push(post);
      write(db);
      return post;
    }, 350);
  }

  // kind: "like" or "dislike". Clicking the same button again removes the reaction.
  function react(postId, kind) {
    return request((db) => {
      const me = requireUser(db);
      const post = db.posts.find((p) => p.id === postId);
      if (!post || !canSee(post, me)) throw new AppError("This post is no longer available.");
      const [mine, other] = kind === "like" ? ["likes", "dislikes"] : ["dislikes", "likes"];
      const already = post[mine].includes(me.id);
      post[other] = post[other].filter((id) => id !== me.id);
      post[mine] = already ? post[mine].filter((id) => id !== me.id) : [...post[mine], me.id];
      write(db);
      return { likes: post.likes.length, dislikes: post.dislikes.length, mine: already ? null : kind };
    }, 120);
  }

  function deletePost(postId) {
    return request((db) => {
      const me = requireUser(db);
      const post = db.posts.find((p) => p.id === postId);
      if (!post || post.author !== me.id) throw new AppError("You can only delete your own news.");
      db.posts = db.posts.filter((p) => p.id !== postId);
      write(db);
    });
  }

  /* ---------- profile ---------- */

  function updateProfile(changes) {
    const allowed = ["name", "city", "bio", "work"];
    return request((db) => {
      const me = requireUser(db);
      for (const key of allowed) {
        if (key in changes) {
          const value = String(changes[key]).trim();
          if (key === "name" && value.length < 3) throw new AppError("Your name must be at least 3 characters.", "name");
          if (value.length > 160) throw new AppError("Each field can be at most 160 characters.", key);
          me[key] = value;
        }
      }
      write(db);
      return publicUser(me);
    });
  }

  function updatePicture(file) {
    if (!file) return Promise.reject(new AppError("Choose an image first."));
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type))
      return Promise.reject(new AppError("Please choose a PNG, JPG, GIF or WEBP image."));
    if (file.size > LIMITS.picture)
      return Promise.reject(new AppError("That image is larger than 1.5 MB. Please choose a smaller one."));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new AppError("The image could not be read."));
      reader.onload = () =>
        request((db) => {
          const me = requireUser(db);
          me.picture = reader.result;
          write(db);
          return me.picture;
        }).then(resolve, reject);
      reader.readAsDataURL(file);
    });
  }

  /* ---------- private messages ---------- */

  function conversations() {
    const db = read();
    const me = sessionId();
    const byPerson = new Map();
    db.messages
      .filter((m) => m.from === me || m.to === me)
      .sort((a, b) => a.sentAt - b.sentAt)
      .forEach((m) => {
        const other = m.from === me ? m.to : m.from;
        const entry = byPerson.get(other) || { userId: other, last: null, unread: 0 };
        entry.last = m;
        if (m.to === me && !m.read) entry.unread++;
        byPerson.set(other, entry);
      });
    return [...byPerson.values()].sort((a, b) => b.last.sentAt - a.last.sentAt);
  }

  function thread(otherId) {
    const me = sessionId();
    return read()
      .messages.filter((m) => (m.from === me && m.to === otherId) || (m.from === otherId && m.to === me))
      .sort((a, b) => a.sentAt - b.sentAt);
  }

  function unreadCount() {
    const me = sessionId();
    return read().messages.filter((m) => m.to === me && !m.read).length;
  }

  function markRead(otherId) {
    const db = read();
    const me = sessionId();
    let changed = false;
    db.messages.forEach((m) => {
      if (m.from === otherId && m.to === me && !m.read) { m.read = true; changed = true; }
    });
    if (changed) write(db);
  }

  // Validates and saves an outgoing message. Returns the message object.
  function sendMessage(toId, text) {
    const body = String(text || "").trim();
    if (!body) return Promise.reject(new AppError("Type a message first."));
    if (body.length > LIMITS.message)
      return Promise.reject(new AppError(`Messages can be at most ${LIMITS.message} characters.`));
    return request((db) => {
      const me = requireUser(db);
      const to = findUser(db, toId);
      if (to.id === me.id) throw new AppError("You cannot message yourself.");
      if (to.ignores.includes(me.id)) throw new AppError(`${to.name} is not accepting messages from you.`);
      const message = { id: uid("m"), from: me.id, to: to.id, text: body, sentAt: Date.now(), read: false };
      db.messages.push(message);
      write(db);
      return message;
    }, 80);
  }

  // Stores a message that arrived from elsewhere (socket or another tab). Ignores duplicates.
  function receiveMessage(message) {
    const db = read();
    if (db.messages.some((m) => m.id === message.id)) return false;
    db.messages.push({ ...message, read: false });
    write(db);
    return true;
  }

  function resetDemo() {
    localStorage.removeItem(DB_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  return {
    LIMITS, login, logout, currentUser, getUser, allUsers, friendsOf, relationTo,
    sendInvite, invitesForMe, respondToInvite, cancelInvite, toggleIgnore, unfriend,
    ratingOf, rateFriend, feed, postsBy, sharePost, react, deletePost,
    updateProfile, updatePicture,
    conversations, thread, unreadCount, markRead, sendMessage, receiveMessage, resetDemo
  };
})();
