// Lab 7 · Part 2 - a whole purchase through the Kashi Ghar API, from the terminal
// First start the server in another terminal:   npm start
// Then run:                                       npm run demo
// Node.js 20+ provides global fetch().
//
// It browses, fills a cart, logs in, places an order, checks the stock, and cancels the order again
// (which puts the stock back), so it can be run many times. Every change is saved in data/db.json.

const BASE = process.env.API_URL || "http://localhost:3000";
let token = null;

async function call(method, path, body) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
}

function show(step, method, path, { status, data }, pick = (d) => d) {
  console.log(`\n${step.padEnd(22)} ${method} ${path}  ->  ${status}`);
  console.log("   ", JSON.stringify(pick(data)));
}

async function main() {
  const health = await call("GET", "/health");
  show("1. Server", "GET", "/health", health, (d) => ({ status: d.status, storage: d.storage, counts: d.counts }));

  show("2. Browse lamps", "GET", "/api/products?category=lamps&sort=price-asc", await call("GET", "/api/products?category=lamps&sort=price-asc"),
    (d) => d.data.map((p) => `${p.id} ${p.name} PKR ${p.price} (stock ${p.stock}, ${p.rating.avg}★)`));

  const cart = await call("POST", "/api/carts");
  show("3. New cart", "POST", "/api/carts", cart, (d) => ({ id: d.data.id, count: d.data.count }));
  const cartId = cart.data.data.id;
  const short = `/api/carts/${cartId.slice(0, 8)}…`;

  show("4. Add lamp", "POST", `${short}/items`, await call("POST", `/api/carts/${cartId}/items`, { productId: "p9", qty: 1 }), (d) => d.message);
  show("5. Add 2 mugs", "POST", `${short}/items`, await call("POST", `/api/carts/${cartId}/items`, { productId: "p6", qty: 2 }), (d) => d.message);
  show("6. Bad coupon", "PUT", `${short}/coupon`, await call("PUT", `/api/carts/${cartId}/coupon`, { code: "FREE100" }), (d) => d.error);
  show("7. Coupon", "PUT", `${short}/coupon`, await call("PUT", `/api/carts/${cartId}/coupon`, { code: "KASHI500" }),
    (d) => ({ message: d.message, standard: d.data.totals.standard.total, express: d.data.totals.express.total }));

  show("8. Order (no login)", "POST", "/api/orders", await call("POST", "/api/orders", { cartId }), (d) => d.error);
  const login = await call("POST", "/api/auth/login", { email: "demo@kashighar.pk", password: "demo1234" });
  show("9. Log in", "POST", "/api/auth/login", login, (d) => ({ user: d.data.user.name, token: d.data.token.slice(0, 8) + "…" }));
  token = login.data.data.token;

  const before = (await call("GET", "/api/products/p9")).data.data.stock;
  const order = await call("POST", "/api/orders", {
    cartId, deliveryMethod: "standard",
    contact: { name: "Demo Customer", email: "demo@kashighar.pk", phone: "03001234567" },
    shipping: { address: "House 12, Street 4, Gulgasht Colony", city: "Multan", postal: "60000" },
    payment: { method: "cod" }
  });
  show("10. Place order", "POST", "/api/orders", order, (d) => ({ id: d.data.id, status: d.data.status, total: d.data.total, items: d.data.items.length }));
  const orderId = order.data.data.id;

  show("11. Stock went down", "GET", "/api/products/p9", await call("GET", "/api/products/p9"), (d) => `stock ${before} -> ${d.data.stock}`);
  show("12. Cart is empty", "GET", short, await call("GET", `/api/carts/${cartId}`), (d) => ({ count: d.data.count }));
  show("13. My orders", "GET", "/api/orders", await call("GET", "/api/orders"), (d) => d.data.map((o) => `${o.id} ${o.status} PKR ${o.total}`));
  show("14. Cancel order", "PATCH", `/api/orders/${orderId}`, await call("PATCH", `/api/orders/${orderId}`, { status: "Cancelled" }), (d) => d.message);
  show("15. Stock is back", "GET", "/api/products/p9", await call("GET", "/api/products/p9"), (d) => `stock ${d.data.stock}`);

  return `\nDone. All of this is saved in data/db.json: stop the server, start it again and GET /api/orders still lists ${orderId}.`;
}

main().then(console.log).catch((error) => { console.error("Start the server first (npm start):", error.message); process.exitCode = 1; });
