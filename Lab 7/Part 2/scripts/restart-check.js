// Lab 7 · Part 2 - proves the API is persistent:   npm run restart-check
//
// 1. starts the real server (server.js) as a separate process with a temporary database file
// 2. signs up, fills a cart and places an order through HTTP
// 3. STOPS that server process completely
// 4. starts a brand-new server process on the same file
// 5. asks the new server for the order, the account and the stock: they are all still there
//
// An in-memory API (Part 1) would have forgotten everything at step 3.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = path.join(os.tmpdir(), `kashi-ghar-restart-${process.pid}.json`);
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

function startServer(label) {
  const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_FILE, QUIET: "1" } });
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => { if (String(d).includes("running on")) { console.log(`\n[${label}] server process ${child.pid} started`); resolve(child); } });
    child.on("error", reject);
    setTimeout(() => reject(new Error("server did not start")), 8000);
  });
}

function stopServer(child) {
  return new Promise((resolve) => { child.on("exit", () => { console.log(`\n[stop] server process ${child.pid} stopped; everything in its memory is gone`); resolve(); }); child.kill(); });
}

async function call(method, p, body, token) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}

async function main() {
  fs.rmSync(DB_FILE, { force: true });
  let server = await startServer("start 1");

  const email = `restart.${Date.now()}@example.com`;
  const signup = await call("POST", "/api/auth/signup", { name: "Restart Check", email, phone: "03001112233", city: "Multan", password: "persist123" });
  const token = signup.data.data.token;
  console.log(`  POST /api/auth/signup          -> ${signup.status}  account ${email}`);
  const cartId = (await call("POST", "/api/carts")).data.data.id;
  await call("POST", `/api/carts/${cartId}/items`, { productId: "p3", qty: 2 });
  const order = await call("POST", "/api/orders", {
    cartId, contact: { name: "Restart Check", email, phone: "03001112233" },
    shipping: { address: "House 1, Street 1, Cantt", city: "Multan", postal: "60000" }, payment: { method: "cod" }
  }, token);
  const orderId = order.data.data.id;
  console.log(`  POST /api/orders               -> ${order.status}  ${orderId}, 2 × Tall Floral Bottle Vase`);
  console.log(`  GET  /api/products/p3          -> stock ${(await call("GET", "/api/products/p3")).data.data.stock} (was 5)`);
  console.log(`  ${path.basename(DB_FILE)} on disk: ${fs.statSync(DB_FILE).size.toLocaleString()} bytes`);

  await stopServer(server);
  server = await startServer("start 2");

  const again = await call("GET", `/api/orders/${orderId}`, undefined, token);
  const me = await call("GET", "/api/auth/me", undefined, token);
  const stock = (await call("GET", "/api/products/p3")).data.data.stock;
  console.log(`  GET  /api/orders/${orderId}  -> ${again.status}  status ${again.data.data.status}, total PKR ${again.data.data.total}`);
  console.log(`  GET  /api/auth/me              -> ${me.status}  still logged in as ${me.data.data.name}`);
  console.log(`  GET  /api/products/p3          -> stock ${stock}`);

  await stopServer(server);
  fs.rmSync(DB_FILE, { force: true });
  const okAll = again.status === 200 && me.status === 200 && stock === 3;
  console.log(okAll ? "\nPERSISTENT: the new server process found the account, the order and the new stock in the file."
    : "\nFAILED: something was not saved.");
  if (!okAll) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
