// Lab 7 Part 2 tests: npm test
// Uses its own temporary database file, so data/db.json is never touched.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server.js";

process.env.QUIET = "1";
const dbFile = path.join(os.tmpdir(), `kashi-ghar-test-${process.pid}.json`);
let server, base;

async function start() {
  server = createServer({ dbFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}
const stop = () => new Promise((resolve) => server.close(resolve));

before(async () => { fs.rmSync(dbFile, { force: true }); await start(); });
after(async () => { await stop(); fs.rmSync(dbFile, { force: true }); });

async function call(method, p, body, token) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + p, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  return { status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json() };
}

const shared = {};
const checkout = (cartId, extra = {}) => ({
  cartId, deliveryMethod: "standard",
  contact: { name: "Test Buyer", email: "buyer@example.com", phone: "03001234567" },
  shipping: { address: "House 1, Street 2, Model Town", area: "", city: "Lahore", postal: "54000" },
  payment: { method: "cod" }, notes: "", ...extra
});

test("catalogue: products from Lab 3, filters, sort, one product, 404", async () => {
  const all = await call("GET", "/api/products");
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 12);
  assert.equal(all.body.data[0].rating.avg, 4.8);

  const lamps = await call("GET", "/api/products?category=lamps&sort=price-asc");
  assert.deepEqual(lamps.body.data.map((p) => p.id), ["p10", "p9"]);
  assert.equal((await call("GET", "/api/products?q=khussa")).body.data[0].id, "p11");
  assert.equal((await call("GET", "/api/products?category=cars")).status, 400);
  assert.equal((await call("GET", "/api/products/p7")).body.data.name, "Multani Tile Panel · 6 pcs");
  assert.equal((await call("GET", "/api/products/p99")).status, 404);
  assert.equal((await call("GET", "/api/categories")).body.data.length, 5);
});

test("accounts: signup, duplicate, login, me, wrong password, logout", async () => {
  const bad = await call("POST", "/api/auth/signup", { name: "A", email: "x", phone: "123", city: "Paris", password: "short" });
  assert.equal(bad.status, 422);
  assert.equal(bad.body.details.length, 5);

  const signup = await call("POST", "/api/auth/signup", { name: "Test Buyer", email: "Buyer@Example.com", phone: "03001234567", city: "Lahore", password: "secret123" });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.data.user.email, "buyer@example.com");
  assert.equal(signup.body.data.user.passHash, undefined, "the password hash is never sent");

  assert.equal((await call("POST", "/api/auth/signup", { name: "Someone", email: "buyer@example.com", phone: "03001234567", city: "Lahore", password: "secret123" })).status, 409);
  assert.equal((await call("GET", "/api/auth/email-available?email=buyer@example.com")).body.data.available, false);

  assert.equal((await call("POST", "/api/auth/login", { email: "buyer@example.com", password: "wrong-pass" })).status, 401);
  const login = await call("POST", "/api/auth/login", { email: "buyer@example.com", password: "secret123", remember: true });
  assert.equal(login.status, 200);
  shared.token = login.body.data.token;

  assert.equal((await call("GET", "/api/auth/me", undefined, shared.token)).body.data.name, "Test Buyer");
  assert.equal((await call("GET", "/api/auth/me")).status, 401);

  const temp = (await call("POST", "/api/auth/login", { email: "buyer@example.com", password: "secret123" })).body.data.token;
  assert.equal((await call("POST", "/api/auth/logout", undefined, temp)).status, 200);
  assert.equal((await call("GET", "/api/auth/me", undefined, temp)).status, 401, "the token stops working after logout");
});

test("cart: add (capped by stock), change quantity, coupon, remove, clear", async () => {
  const cart = (await call("POST", "/api/carts")).body.data;
  assert.equal(cart.count, 0);
  const id = cart.id;

  let r = await call("POST", `/api/carts/${id}/items`, { productId: "p7", qty: 10 });   // only 4 in stock
  assert.equal(r.status, 200);
  assert.equal(r.body.added, 4);
  assert.equal(r.body.capped, true);
  assert.equal((await call("POST", `/api/carts/${id}/items`, { productId: "p7" })).status, 409);

  assert.equal((await call("PATCH", `/api/carts/${id}/items/p7`, { qty: 9 })).status, 422);
  r = await call("PATCH", `/api/carts/${id}/items/p7`, { qty: 1 });
  assert.equal(r.body.data.totals.standard.subtotal, 7200);
  assert.equal(r.body.data.totals.standard.delivery, 0, "free standard delivery over PKR 5,000");
  assert.equal(r.body.data.totals.express.delivery, 600);

  assert.equal((await call("PUT", `/api/carts/${id}/coupon`, { code: "FREE" })).status, 422);
  r = await call("PUT", `/api/carts/${id}/coupon`, { code: "multan10" });
  assert.equal(r.body.data.totals.standard.discount, 720);
  assert.equal(r.body.data.totals.standard.total, 6480);

  await call("POST", `/api/carts/${id}/items`, { productId: "p8", qty: 2 });
  assert.equal((await call("DELETE", `/api/carts/${id}/items/p8`)).body.data.lines.length, 1);
  assert.equal((await call("DELETE", `/api/carts/${id}/items`)).body.data.coupon, "");
  assert.equal((await call("GET", "/api/carts/not-a-cart")).status, 404);
});

test("orders: needs login, validates, never accepts card numbers, takes stock", async () => {
  const id = (await call("POST", "/api/carts")).body.data.id;
  await call("POST", `/api/carts/${id}/items`, { productId: "p9", qty: 2 });       // camel-skin lamp, stock 6

  assert.equal((await call("POST", "/api/orders", checkout(id))).status, 401);
  const invalid = await call("POST", "/api/orders", checkout(id, { shipping: { address: "x", city: "Mars", postal: "1" } }), shared.token);
  assert.equal(invalid.status, 422);
  assert.ok(invalid.body.details.some((d) => d.field === "shipping.postal"));
  const card = await call("POST", "/api/orders", checkout(id, { payment: { method: "card", number: "4242424242424242" } }), shared.token);
  assert.equal(card.status, 422);
  assert.match(card.body.error, /Never send full card details/);

  const placed = await call("POST", "/api/orders", checkout(id, { deliveryMethod: "express" }), shared.token);
  assert.equal(placed.status, 201);
  assert.match(placed.body.data.id, /^KG-\d{4}-\d{4}$/);
  assert.equal(placed.body.data.total, 8900 * 2 + 600);
  shared.orderId = placed.body.data.id;

  assert.equal((await call("GET", "/api/products/p9")).body.data.stock, 4, "stock went down by 2");
  assert.equal((await call("GET", `/api/carts/${id}`)).body.data.count, 0, "the cart is empty after ordering");
  assert.equal((await call("POST", "/api/orders", checkout(id), shared.token)).status, 409, "an empty cart cannot be ordered");
  assert.equal((await call("GET", "/api/orders", undefined, shared.token)).body.total, 1);
});

test("persistence: data survives a server restart", async () => {
  await stop();
  const onDisk = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  assert.ok(onDisk.orders.some((o) => o.id === shared.orderId), "the order is in the JSON file");
  assert.ok(onDisk.users.every((u) => u.passHash.startsWith("pbkdf2$")), "only password hashes are stored");

  await start();   // a brand-new server process reading the same file
  assert.equal((await call("GET", `/api/orders/${shared.orderId}`, undefined, shared.token)).body.data.status, "Processing");
  assert.equal((await call("GET", "/api/products/p9")).body.data.stock, 4);
  assert.equal((await call("GET", "/api/auth/me", undefined, shared.token)).status, 200, "logins survive too");
});

test("orders: customer can cancel while processing; stock comes back", async () => {
  const other = (await call("POST", "/api/auth/login", { email: "demo@kashighar.pk", password: "demo1234" })).body.data.token;
  assert.equal((await call("GET", `/api/orders/${shared.orderId}`, undefined, other)).status, 404, "other customers cannot see it");
  assert.equal((await call("PATCH", `/api/orders/${shared.orderId}`, { status: "Shipped" }, shared.token)).status, 409);

  const cancel = await call("PATCH", `/api/orders/${shared.orderId}`, { status: "Cancelled" }, shared.token);
  assert.equal(cancel.status, 200);
  assert.equal((await call("GET", "/api/products/p9")).body.data.stock, 6);
  assert.equal((await call("PATCH", `/api/orders/${shared.orderId}`, { status: "Cancelled" }, shared.token)).status, 409);
});

test("reviews: post (verified when logged in), summary and product rating update", async () => {
  const before = (await call("GET", "/api/products/p6")).body.data.rating;
  assert.equal((await call("POST", "/api/reviews", { productId: "p6", rating: 9, name: "Ali", text: "short" })).status, 422);
  const r = await call("POST", "/api/reviews", { productId: "p6", rating: 5, name: "Test Buyer", text: "Lovely mugs, the chai stays warm for ages." }, shared.token);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.verified, true);
  assert.equal(r.body.product.rating.count, before.count + 1);
  assert.equal((await call("GET", "/api/reviews?limit=1")).body.data[0].id, r.body.data.id, "newest first");
  assert.equal((await call("GET", "/api/reviews/summary")).body.data.total, 1182 + 1);
});

test("admin: product CRUD needs the admin account", async () => {
  const product = { name: "Kashi Pen Holder", category: "tableware", price: 900, stock: 15, description: "A small hand-painted pen holder for the study table." };
  assert.equal((await call("POST", "/api/products", product)).status, 401);
  assert.equal((await call("POST", "/api/products", product, shared.token)).status, 403);

  const admin = (await call("POST", "/api/auth/login", { email: "admin@kashighar.pk", password: "admin1234" })).body.data.token;
  const created = await call("POST", "/api/products", product, admin);
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal(id, "p13");
  assert.equal((await call("PATCH", `/api/products/${id}`, { stock: 3 }, admin)).body.data.stock, 3);
  assert.equal((await call("PUT", `/api/products/${id}`, { ...product, price: 950 }, admin)).body.data.price, 950);
  assert.equal((await call("PATCH", `/api/products/${id}`, { oldPrice: 500 }, admin)).status, 422, "old price must be higher");
  assert.equal((await call("DELETE", `/api/products/${id}`, undefined, admin)).status, 200);
  assert.equal((await call("GET", `/api/products/${id}`)).status, 404);
});

test("HTTP errors: 404 route, 405 method, 400 bad JSON, 415 not JSON", async () => {
  assert.equal((await call("GET", "/api/nothing")).body.error, "Route not found");
  const wrong = await call("DELETE", "/api/products");
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get("allow"), "GET, POST");
  assert.equal((await call("POST", "/api/auth/login", "{oops")).status, 400);
  const form = await fetch(base + "/api/auth/login", { method: "POST", body: "email=x", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  assert.equal(form.status, 415);
});
