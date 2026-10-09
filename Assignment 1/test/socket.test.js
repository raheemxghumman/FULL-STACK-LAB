/* Basic automated check of the chat server: npm test */
const assert = require("assert");
const { io: ioClient } = require("socket.io-client");
const { server } = require("../server");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}`;
  const connect = () => ioClient(url, { transports: ["websocket"], forceNew: true });
  let passed = 0;
  const ok = (name) => { passed++; console.log("PASS", name); };

  try {
    // two members come online
    const raheem = connect();
    await once(raheem, "connect");
    raheem.emit("join", { userId: "u1", name: "Abdul Raheem" });
    const presence1 = await once(raheem, "presence");
    assert.deepStrictEqual(presence1, ["u1"]);
    ok("presence after first join");

    const ayesha = connect();
    await once(ayesha, "connect");
    const presenceSeen = once(raheem, "presence");
    ayesha.emit("join", { userId: "u2", name: "Ayesha" });
    assert.deepStrictEqual((await presenceSeen).sort(), ["u1", "u2"]);
    ok("presence updates when a second member joins");

    // live delivery
    const incoming = once(ayesha, "private-message");
    const ack = await emitAck(raheem, "private-message", { id: "t1", from: "u1", to: "u2", text: "  Hello Ayesha  ", sentAt: Date.now() });
    assert.deepStrictEqual(ack, { ok: true, delivered: true });
    const got = await incoming;
    assert.strictEqual(got.text, "Hello Ayesha");
    assert.strictEqual(got.from, "u1");
    ok("private message delivered in real time (text trimmed)");

    // typing indicator
    const typing = once(ayesha, "typing");
    raheem.emit("typing", { from: "u1", to: "u2", typing: true });
    assert.deepStrictEqual(await typing, { from: "u1", typing: true });
    ok("typing indicator forwarded");

    // validation
    assert.strictEqual((await emitAck(raheem, "private-message", { id: "t2", from: "u2", to: "u3", text: "spoof" })).ok, false);
    ok("rejects a message pretending to be from someone else");
    assert.strictEqual((await emitAck(raheem, "private-message", { id: "t3", from: "u1", to: "u2", text: "   " })).ok, false);
    ok("rejects an empty message");
    assert.strictEqual((await emitAck(raheem, "private-message", { id: "t4", from: "u1", to: "u2", text: "x".repeat(1001) })).ok, false);
    ok("rejects a message over 1000 characters");

    // offline member: message is queued and delivered on join
    const queuedAck = await emitAck(raheem, "private-message", { id: "t5", from: "u1", to: "u8", text: "Accepting your request!", sentAt: Date.now() });
    assert.deepStrictEqual(queuedAck, { ok: true, delivered: false });
    const fatima = connect();
    await once(fatima, "connect");
    const late = once(fatima, "private-message");
    fatima.emit("join", { userId: "u8", name: "Fatima" });
    assert.strictEqual((await late).id, "t5");
    ok("message to an offline member is queued and delivered when they join");

    // disconnect updates presence (skip the earlier broadcast from Fatima's join)
    const afterLeave = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("presence without u2 never arrived")), 2000);
      raheem.on("presence", (ids) => { if (!ids.includes("u2")) { clearTimeout(t); resolve(ids); } });
    });
    ayesha.disconnect();
    assert.deepStrictEqual((await afterLeave).sort(), ["u1", "u8"]);
    ok("presence updates on disconnect");

    raheem.disconnect(); fatima.disconnect();
    console.log(`\n${passed} passed, 0 failed`);
  } catch (err) {
    console.error("FAIL", err.message);
    process.exitCode = 1;
  } finally {
    await wait(100);
    server.close();
    process.exit();
  }
})();
