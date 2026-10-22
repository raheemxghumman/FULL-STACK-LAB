/* ==========================================================================
   lib/router.js - Kashi Ghar store API (persistent)
   --------------------------------------------------------------------------
   createStoreApi({ storage }) returns { handle(request) -> Promise<response> }.

   The request is { method, url, headers, body } (body = raw JSON text) and
   the response is { status, headers, body }. server.js uses it for real HTTP
   requests and saves the data with FileStorage (data/db.json). Without the
   server (GitHub Pages) the store runs the same code in the browser with
   BrowserStorage (localStorage).

   Persistence: every request reads the database from storage, and every
   successful change is written back before the response is sent.
   Requests are handled one at a time, so two changes can never overwrite
   each other.

   Endpoints: see GET /api, or the README.
   ========================================================================== */

import { validate } from "./validate.js";
import { hashPassword, verifyPassword, randomId } from "./security.js";
import { CATEGORIES, PRODUCTS, RATING_BASE, SEED_REVIEWS, DELIVERY, COUPONS, CITIES, ART, SEED_USERS } from "./seed.js";

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const DAY = 24 * 60 * 60 * 1000;
const PHONE = { type: "string", required: true, pattern: /^(\+92|0)3\d{9}$/, hint: "must be a Pakistani mobile number, e.g. 03001234567.", label: "Phone" };
const PERSON_NAME = { type: "string", required: true, min: 3, max: 60, pattern: /^[A-Za-z][A-Za-z .'-]*$/, hint: "may only contain letters, spaces and . ' -", label: "Name" };
const ORDER_STATUSES = ["Processing", "Shipped", "Delivered", "Cancelled"];

const SCHEMAS = {
  product: {
    name: { type: "string", required: true, min: 3, max: 80, label: "Name" },
    category: { type: "enum", required: true, values: Object.keys(CATEGORIES), label: "Category" },
    price: { type: "int", required: true, min: 1, max: 1000000, label: "Price" },
    oldPrice: { type: "int", min: 1, max: 1000000, label: "Old price" },
    stock: { type: "int", required: true, min: 0, max: 10000, label: "Stock" },
    description: { type: "string", required: true, min: 10, max: 600, label: "Description" },
    art: { type: "enum", values: ART, default: "a-plate", label: "Picture" },
    bg: { type: "string", pattern: /^#[0-9a-f]{6}$/i, hint: "must be a colour like #e6ecf7.", default: "#e6ecf7", label: "Background colour" }
  },
  signup: {
    name: PERSON_NAME,
    email: { type: "email", required: true, max: 80, label: "Email" },
    phone: PHONE,
    city: { type: "enum", required: true, values: CITIES, label: "City" },
    password: { type: "string", required: true, min: 8, max: 128, keepSpaces: true, label: "Password" }
  },
  login: {
    email: { type: "email", required: true, label: "Email" },
    password: { type: "string", required: true, max: 128, keepSpaces: true, label: "Password" },
    remember: { type: "bool", default: false, label: "remember" }
  },
  review: {
    productId: { type: "string", required: true, label: "Product" },
    rating: { type: "int", required: true, min: 1, max: 5, label: "Rating" },
    name: { type: "string", required: true, min: 2, max: 40, label: "Name" },
    text: { type: "string", required: true, min: 10, max: 500, label: "Review" }
  },
  cartItem: {
    productId: { type: "string", required: true, label: "Product" },
    qty: { type: "int", min: 1, max: 1000, default: 1, label: "Quantity" }
  },
  cartQty: { qty: { type: "int", required: true, label: "Quantity" } },
  coupon: { code: { type: "string", max: 20, label: "Coupon code" } },
  order: {
    cartId: { type: "string", required: true, label: "Cart" },
    deliveryMethod: { type: "enum", values: Object.keys(DELIVERY), default: "standard", label: "Delivery method" },
    contact: { type: "object", required: true, label: "Contact" },
    shipping: { type: "object", required: true, label: "Shipping" },
    payment: { type: "object", required: true, label: "Payment" },
    notes: { type: "string", max: 300, label: "Notes" }
  },
  contact: { name: PERSON_NAME, email: { type: "email", required: true, label: "Email" }, phone: PHONE },
  shipping: {
    address: { type: "string", required: true, min: 8, max: 120, label: "Street address" },
    area: { type: "string", max: 60, label: "Area" },
    city: { type: "enum", required: true, values: CITIES, label: "City" },
    postal: { type: "string", required: true, pattern: /^\d{5}$/, hint: "must be 5 digits, e.g. 60000.", label: "Postal code" }
  },
  payment: {
    method: { type: "enum", required: true, values: ["cod", "wallet", "card"], label: "Payment method" },
    label: { type: "string", max: 30, label: "Payment label" },
    account: { type: "string", pattern: /^03\d{2}\*{4}\d{3}$/, hint: "must be masked like 0300****567.", label: "Wallet account" },
    last4: { type: "string", pattern: /^\d{4}$/, hint: "must be the last 4 digits of the card.", label: "Card last 4" }
  },
  orderStatus: { status: { type: "enum", required: true, values: ORDER_STATUSES, label: "Status" } }
};

const round1 = (n) => Math.round(n * 10) / 10;
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** A brand-new database with the seed catalogue and the two starting accounts. */
export async function createDatabase() {
  const now = new Date().toISOString();
  const users = [];
  for (const [i, { password, ...user }] of SEED_USERS.entries()) {
    users.push({ id: `u${i + 1}`, ...user, passHash: await hashPassword(password) });
  }
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    counters: { product: PRODUCTS.length, user: users.length, review: 0 },
    products: PRODUCTS.map((p) => ({ ...p, created: now, updated: now })),
    users,
    sessions: [],
    carts: [],
    orders: [],
    reviews: SEED_REVIEWS.map((r) => ({ ...r, created: Date.parse(r.date) })),
    ratingBase: RATING_BASE
  };
}

export function createStoreApi({ storage }) {
  const routes = [];

  function route(method, pattern, handler, { auth = "none", body = false, description = "" } = {}) {
    const regex = new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "/?$");
    routes.push({ method, pattern, regex, handler, auth, body, description });
  }
  const ok = (body, status = 200, headers = {}) => ({ status, headers, body });

  /* ===================== helpers that read the database ===================== */

  const publicUser = ({ passHash, ...u }) => u;

  function findProduct(db, id, status = 404) {
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new HttpError(status, `Product "${id}" does not exist.`, status === 422 ? { details: [{ field: "productId", message: "Unknown product." }] } : {});
    return p;
  }

  // Catalogue rating plus every review written through the API (Lab 3 did the same in the browser)
  function presentProduct(db, p) {
    const extra = db.reviews.filter((r) => r.productId === p.id && !r.seeded);
    const count = p.baseReviewCount + extra.length;
    const sum = p.baseRating * p.baseReviewCount + extra.reduce((s, r) => s + r.rating, 0);
    const { baseRating, baseReviewCount, ...rest } = p;
    return { ...rest, rating: { avg: count ? round1(sum / count) : 0, count } };
  }

  function findCart(db, id) {
    const cart = db.carts.find((c) => c.id === id);
    if (!cart) throw new HttpError(404, "Cart not found. Create a new one with POST /api/carts.");
    return cart;
  }

  // Drops products that were deleted or sold out, and lowers quantities above the stock.
  function tidyCart(db, cart) {
    let changed = false;
    cart.items = cart.items.filter((item) => {
      const p = db.products.find((x) => x.id === item.productId);
      if (!p || p.stock <= 0) { changed = true; return false; }
      if (item.qty > p.stock) { item.qty = p.stock; changed = true; }
      return true;
    });
    return changed;
  }

  function couponDiscount(code, subtotal) {
    const c = COUPONS[code];
    if (!c || subtotal <= 0 || (c.min && subtotal < c.min)) return 0;
    return c.type === "percent" ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
  }

  // All money maths lives here, so the cart, the checkout and the order always agree.
  function totals(lines, code, method) {
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const discount = code ? couponDiscount(code, subtotal) : 0;
    const d = DELIVERY[method];
    const delivery = subtotal > 0 ? (d.freeOver && subtotal >= d.freeOver ? 0 : d.fee) : 0;
    return {
      method, subtotal, discount, delivery,
      total: Math.max(0, subtotal - discount + delivery),
      count: lines.reduce((s, l) => s + l.qty, 0),
      coupon: code || "",
      couponLabel: code && COUPONS[code] ? COUPONS[code].label : "",
      couponInactive: Boolean(code) && discount === 0,
      freeDeliveryGap: Math.max(0, DELIVERY.standard.freeOver - subtotal)
    };
  }

  function presentCart(db, cart) {
    const lines = cart.items.map((item) => {
      const p = presentProduct(db, findProduct(db, item.productId));
      return { id: p.id, qty: item.qty, product: p, lineTotal: p.price * item.qty };
    });
    return {
      id: cart.id,
      lines,
      coupon: cart.coupon,
      count: lines.reduce((s, l) => s + l.qty, 0),
      totals: Object.fromEntries(Object.keys(DELIVERY).map((m) => [m, totals(lines, cart.coupon, m)])),
      updated: cart.updated
    };
  }

  function check(input, schema, opts) {
    const { value, errors } = validate(input, schema, opts);
    if (errors.length) throw new HttpError(422, `${errors.length} field${errors.length > 1 ? "s are" : " is"} invalid.`, { details: errors });
    return value;
  }

  function onlyParams(query, allowed) {
    const unknown = [...query.keys()].filter((k) => !allowed.includes(k));
    if (unknown.length) throw new HttpError(400, `Unknown query parameter: ${unknown.join(", ")}.`, { allowed });
  }

  /* ===================== general ===================== */

  route("GET", "/health", ({ db }) => ok({
    status: "ok", service: "kashi-ghar-api", storage: storage.kind,
    counts: { products: db.products.length, users: db.users.length, carts: db.carts.length, orders: db.orders.length, reviews: db.reviews.length },
    lastChange: db.updatedAt
  }), { description: "Server status, where the data is stored, record counts" });

  route("GET", "/api", () => ok({
    name: "Kashi Ghar store API",
    endpoints: routes.map((r) => ({ method: r.method, path: r.pattern, auth: r.auth, description: r.description }))
  }), { description: "This list of endpoints" });

  route("GET", "/api/categories", ({ db }) => ok({
    data: Object.entries(CATEGORIES).map(([key, label]) => ({ key, label, count: db.products.filter((p) => p.category === key).length }))
  }), { description: "Product categories" });

  route("GET", "/api/delivery-options", () => ok({ data: DELIVERY }), { description: "Delivery methods, fees and free-delivery limit" });

  /* ===================== products ===================== */

  route("GET", "/api/products", ({ db, query }) => {
    onlyParams(query, ["category", "q", "sort", "minPrice", "maxPrice", "inStock"]);
    let list = db.products.map((p) => presentProduct(db, p));
    const category = query.get("category");
    if (category && category !== "all") {
      if (!CATEGORIES[category]) throw new HttpError(400, `Unknown category "${category}".`, { allowed: Object.keys(CATEGORIES) });
      list = list.filter((p) => p.category === category);
    }
    const q = (query.get("q") || "").trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const haystack = `${p.name} ${CATEGORIES[p.category]} ${p.description}`.toLowerCase();
        return q.split(/\s+/).every((word) => haystack.includes(word));
      });
    }
    for (const [param, test] of [["minPrice", (p, n) => p.price >= n], ["maxPrice", (p, n) => p.price <= n]]) {
      if (!query.has(param)) continue;
      const n = Number(query.get(param));
      if (!Number.isFinite(n)) throw new HttpError(400, `${param} must be a number.`);
      list = list.filter((p) => test(p, n));
    }
    if (query.get("inStock") === "true") list = list.filter((p) => p.stock > 0);
    const sorts = {
      featured: null,
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      rating: (a, b) => b.rating.avg - a.rating.avg,
      name: (a, b) => a.name.localeCompare(b.name),
      newest: (a, b) => String(b.created).localeCompare(String(a.created))
    };
    const sort = query.get("sort") || "featured";
    if (!(sort in sorts)) throw new HttpError(400, `Unknown sort "${sort}".`, { allowed: Object.keys(sorts) });
    if (sorts[sort]) list.sort(sorts[sort]);
    return ok({ count: list.length, total: db.products.length, data: list });
  }, { description: "List products (?category= &q= &sort= &minPrice= &maxPrice= &inStock=true)" });

  route("GET", "/api/products/:id", ({ db, params }) => ok({ data: presentProduct(db, findProduct(db, params.id)) }),
    { description: "One product" });

  route("POST", "/api/products", ({ db, body }) => {
    const value = check(body, SCHEMAS.product);
    if (value.oldPrice !== undefined && value.oldPrice <= value.price) {
      throw new HttpError(422, "1 field is invalid.", { details: [{ field: "oldPrice", message: "Old price must be higher than the price." }] });
    }
    const now = new Date().toISOString();
    const product = { id: `p${++db.counters.product}`, ...value, oldPrice: value.oldPrice ?? null, baseRating: 0, baseReviewCount: 0, created: now, updated: now };
    db.products.push(product);
    return ok({ message: `${product.name} was added to the catalogue.`, data: presentProduct(db, product) }, 201, { Location: `/api/products/${product.id}` });
  }, { auth: "admin", body: true, description: "Add a product" });

  function updateProduct({ db, params, body }, partial) {
    const product = findProduct(db, params.id);
    const readOnly = ["id", "rating", "created", "updated", "baseRating", "baseReviewCount"];
    const input = partial ? { ...product, ...body } : body;
    if (partial && !Object.keys(body).length) throw new HttpError(400, "Send at least one field to update.");
    const value = check(input, SCHEMAS.product, { readOnly });
    if (value.oldPrice !== undefined && value.oldPrice !== null && value.oldPrice <= value.price) {
      throw new HttpError(422, "1 field is invalid.", { details: [{ field: "oldPrice", message: "Old price must be higher than the price." }] });
    }
    Object.assign(product, value, { oldPrice: value.oldPrice ?? null, updated: new Date().toISOString() });
    return ok({ message: `${product.name} was updated.`, data: presentProduct(db, product) });
  }
  route("PUT", "/api/products/:id", (ctx) => updateProduct(ctx, false), { auth: "admin", body: true, description: "Replace a product" });
  route("PATCH", "/api/products/:id", (ctx) => updateProduct(ctx, true), { auth: "admin", body: true, description: "Change some fields of a product (e.g. stock)" });

  route("DELETE", "/api/products/:id", ({ db, params }) => {
    const product = findProduct(db, params.id);
    db.products = db.products.filter((p) => p.id !== product.id);
    const reviews = db.reviews.length;
    db.reviews = db.reviews.filter((r) => r.productId !== product.id);
    let carts = 0;
    db.carts.forEach((c) => {
      const before = c.items.length;
      c.items = c.items.filter((i) => i.productId !== product.id);
      if (c.items.length !== before) carts++;
    });
    return ok({ message: `${product.name} was removed (also from ${carts} cart${carts === 1 ? "" : "s"}; ${reviews - db.reviews.length} reviews deleted). Past orders keep their copy.`, data: presentProduct(db, product) });
  }, { auth: "admin", description: "Remove a product" });

  /* ===================== reviews ===================== */

  const newestFirst = (a, b) => b.created - a.created;

  route("GET", "/api/reviews", ({ db, query }) => {
    onlyParams(query, ["productId", "limit"]);
    let list = db.reviews.slice().sort(newestFirst);
    if (query.has("productId")) list = list.filter((r) => r.productId === query.get("productId"));
    const total = list.length;
    if (query.has("limit")) list = list.slice(0, Math.max(1, Number(query.get("limit")) || 1));
    return ok({ count: list.length, total, data: list });
  }, { description: "Reviews, newest first (?productId= &limit=)" });

  route("GET", "/api/reviews/summary", ({ db }) => {
    const buckets = { ...db.ratingBase };
    db.reviews.filter((r) => !r.seeded).forEach((r) => (buckets[r.rating] = (buckets[r.rating] || 0) + 1));
    let total = 0, sum = 0;
    for (let s = 1; s <= 5; s++) { total += buckets[s] || 0; sum += s * (buckets[s] || 0); }
    return ok({ data: { buckets, total, avg: total ? round1(sum / total) : 0 } });
  }, { description: "Star rating distribution for the whole shop" });

  route("GET", "/api/products/:id/reviews", ({ db, params }) => {
    findProduct(db, params.id);
    const list = db.reviews.filter((r) => r.productId === params.id).sort(newestFirst);
    return ok({ count: list.length, total: list.length, data: list });
  }, { description: "Reviews of one product" });

  route("POST", "/api/reviews", ({ db, body, user }) => {
    const value = check(body, SCHEMAS.review);
    const product = findProduct(db, value.productId, 422);
    const review = {
      id: `r${++db.counters.review}`, productId: product.id, name: value.name, rating: value.rating, text: value.text,
      city: user ? user.city : "", date: todayISO(), created: Date.now(), verified: Boolean(user), userId: user ? user.id : null
    };
    db.reviews.push(review);
    return ok({ message: "Thanks! Your review was posted.", data: review, product: presentProduct(db, product) }, 201);
  }, { auth: "optional", body: true, description: "Post a review (marked verified when logged in)" });

  route("DELETE", "/api/reviews/:id", ({ db, params }) => {
    const review = db.reviews.find((r) => r.id === params.id);
    if (!review) throw new HttpError(404, `Review "${params.id}" not found.`);
    db.reviews = db.reviews.filter((r) => r !== review);
    return ok({ message: "Review deleted.", data: review });
  }, { auth: "admin", description: "Delete a review" });

  /* ===================== accounts ===================== */

  function startSession(db, user, days) {
    const now = Date.now();
    db.sessions = db.sessions.filter((s) => s.expires > now);   // tidy up expired logins
    const session = { token: randomId(), userId: user.id, created: now, expires: now + days * DAY };
    db.sessions.push(session);
    return { token: session.token, expires: new Date(session.expires).toISOString(), user: publicUser(user) };
  }

  route("POST", "/api/auth/signup", async ({ db, body }) => {
    const value = check(body, SCHEMAS.signup);
    const taken = () => db.users.some((u) => u.email === value.email);
    const conflict = () => new HttpError(409, "An account with this email already exists. Log in instead.", { details: [{ field: "email", message: "Already registered." }] });
    if (taken()) throw conflict();
    const passHash = await hashPassword(value.password);
    if (taken()) throw conflict();
    const { password, ...profile } = value;
    const user = { id: `u${++db.counters.user}`, ...profile, role: "customer", passHash, created: todayISO() };
    db.users.push(user);
    return ok({ message: `Welcome, ${user.name.split(" ")[0]}! Your account is ready.`, data: startSession(db, user, 30) }, 201);
  }, { body: true, description: "Create an account (returns a login token)" });

  route("POST", "/api/auth/login", async ({ db, body }) => {
    const value = check(body, SCHEMAS.login);
    const user = db.users.find((u) => u.email === value.email);
    // the same message for "no such email" and "wrong password", so emails cannot be guessed this way
    if (!user || !(await verifyPassword(value.password, user.passHash))) {
      throw new HttpError(401, "That email and password do not match an account.");
    }
    return ok({ message: "Logged in.", data: startSession(db, user, value.remember ? 30 : 1) });
  }, { body: true, description: "Log in (returns a login token)" });

  route("GET", "/api/auth/me", ({ user }) => ok({ data: publicUser(user) }), { auth: "user", description: "The logged-in account" });

  route("POST", "/api/auth/logout", ({ db, token }) => {
    db.sessions = db.sessions.filter((s) => s.token !== token);
    return ok({ message: "Logged out." });
  }, { auth: "user", description: "End this login" });

  route("GET", "/api/auth/email-available", ({ db, query }) => {
    onlyParams(query, ["email"]);
    const email = String(query.get("email") || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new HttpError(400, "Send a valid ?email= to check.");
    return ok({ data: { email, available: !db.users.some((u) => u.email === email) } });
  }, { description: "Is an email free for signup? (?email=)" });

  /* ===================== carts ===================== */

  route("POST", "/api/carts", ({ db }) => {
    const now = new Date().toISOString();
    const cart = { id: randomId(), items: [], coupon: "", created: now, updated: now };
    db.carts.push(cart);
    return ok({ message: "Cart created.", data: presentCart(db, cart) }, 201, { Location: `/api/carts/${cart.id}` });
  }, { description: "Start a new, empty cart" });

  route("GET", "/api/carts/:id", (ctx) => {
    const cart = findCart(ctx.db, ctx.params.id);
    if (tidyCart(ctx.db, cart)) ctx.changed = true;   // stock fell since the item was added
    return ok({ data: presentCart(ctx.db, cart) });
  }, { description: "A cart with its lines and totals for each delivery method" });

  const touch = (cart) => (cart.updated = new Date().toISOString());

  route("POST", "/api/carts/:id/items", ({ db, params, body }) => {
    const cart = findCart(db, params.id);
    const value = check(body, SCHEMAS.cartItem);
    const product = findProduct(db, value.productId, 422);
    const line = cart.items.find((i) => i.productId === product.id);
    const current = line ? line.qty : 0;
    if (product.stock === 0) throw new HttpError(409, `${product.name} is sold out.`);
    if (current >= product.stock) throw new HttpError(409, `You already have all ${product.stock} available in your cart.`);
    const next = Math.min(product.stock, current + value.qty);
    if (line) line.qty = next; else cart.items.push({ productId: product.id, qty: next });
    touch(cart);
    const capped = current + value.qty > product.stock;
    return ok({
      message: `${product.name} × ${next - current} added${capped ? " (limited by stock)" : ""}.`,
      added: next - current, capped, data: presentCart(db, cart)
    });
  }, { body: true, description: "Add a product to a cart (never more than the stock)" });

  route("PATCH", "/api/carts/:id/items/:productId", ({ db, params, body }) => {
    const cart = findCart(db, params.id);
    const line = cart.items.find((i) => i.productId === params.productId);
    if (!line) throw new HttpError(404, "That item is not in your cart.");
    const product = findProduct(db, params.productId);
    const { qty } = check(body, SCHEMAS.cartQty);
    if (qty < 1 || qty > product.stock) {
      throw new HttpError(422, `Enter a quantity from 1 to ${product.stock}.`, { details: [{ field: "qty", message: `1 to ${product.stock} only.` }] });
    }
    line.qty = qty;
    touch(cart);
    return ok({ message: "Quantity updated.", data: presentCart(db, cart) });
  }, { body: true, description: "Set the quantity of one line" });

  route("DELETE", "/api/carts/:id/items/:productId", ({ db, params }) => {
    const cart = findCart(db, params.id);
    if (!cart.items.some((i) => i.productId === params.productId)) throw new HttpError(404, "That item is not in your cart.");
    cart.items = cart.items.filter((i) => i.productId !== params.productId);
    touch(cart);
    return ok({ message: "Item removed.", data: presentCart(db, cart) });
  }, { description: "Remove one line" });

  route("DELETE", "/api/carts/:id/items", ({ db, params }) => {
    const cart = findCart(db, params.id);
    cart.items = [];
    cart.coupon = "";
    touch(cart);
    return ok({ message: "Cart cleared.", data: presentCart(db, cart) });
  }, { description: "Empty the cart (and remove the coupon)" });

  route("PUT", "/api/carts/:id/coupon", ({ db, params, body }) => {
    const cart = findCart(db, params.id);
    const code = String(check(body, SCHEMAS.coupon).code || "").trim().toUpperCase();
    const fail = (msg) => new HttpError(422, msg, { details: [{ field: "code", message: msg }] });
    if (!code) throw fail("Enter a coupon code first.");
    const coupon = COUPONS[code];
    if (!coupon) throw fail(`“${code}” is not a valid coupon.`);
    const subtotal = presentCart(db, cart).totals.standard.subtotal;
    if (coupon.min && subtotal < coupon.min) throw fail(`${code} works on orders of PKR ${coupon.min.toLocaleString("en-US")} or more.`);
    cart.coupon = code;
    touch(cart);
    return ok({ message: `${code} applied: ${coupon.label}.`, data: presentCart(db, cart) });
  }, { body: true, description: "Apply a coupon (MULTAN10, KASHI500)" });

  route("DELETE", "/api/carts/:id/coupon", ({ db, params }) => {
    const cart = findCart(db, params.id);
    cart.coupon = "";
    touch(cart);
    return ok({ message: "Coupon removed.", data: presentCart(db, cart) });
  }, { description: "Remove the coupon" });

  /* ===================== orders ===================== */

  function newOrderId(db) {
    const year = new Date().getFullYear();
    const taken = new Set(db.orders.map((o) => o.id));
    let id;
    do { id = `KG-${year}-${Math.floor(1000 + Math.random() * 9000)}`; } while (taken.has(id));
    return id;
  }

  function canSee(user, order) {
    return user.role === "admin" || order.userId === user.id;
  }

  route("POST", "/api/orders", ({ db, body, user }) => {
    // Card numbers and CVCs must never reach the server: only the last 4 digits are accepted
    const pay = body && typeof body.payment === "object" && body.payment ? body.payment : {};
    const secret = ["number", "cardNumber", "cvc", "cvv", "expiry"].filter((k) => k in pay);
    if (secret.length) {
      throw new HttpError(422, "Never send full card details to the API. Send only the last 4 digits as payment.last4.", {
        details: secret.map((k) => ({ field: `payment.${k}`, message: "Not accepted." }))
      });
    }
    const value = check(body, SCHEMAS.order);
    const errors = [];
    const contact = validate(value.contact, SCHEMAS.contact, { prefix: "contact." });
    const shipping = validate(value.shipping, SCHEMAS.shipping, { prefix: "shipping." });
    const payment = validate(value.payment, SCHEMAS.payment, { prefix: "payment." });
    errors.push(...contact.errors, ...shipping.errors, ...payment.errors);
    if (!payment.errors.length) {
      const p = payment.value;
      if (p.method === "wallet" && !["JazzCash", "Easypaisa"].includes(p.label)) errors.push({ field: "payment.label", message: "Choose JazzCash or Easypaisa." });
      if (p.method === "wallet" && !p.account) errors.push({ field: "payment.account", message: "Wallet account is required." });
      if (p.method === "card" && !p.last4) errors.push({ field: "payment.last4", message: "Card last 4 digits are required." });
    }
    if (errors.length) throw new HttpError(422, `${errors.length} field${errors.length > 1 ? "s are" : " is"} invalid.`, { details: errors });

    const cart = findCart(db, value.cartId);
    tidyCart(db, cart);
    if (!cart.items.length) throw new HttpError(409, "Your cart is empty.");
    const short = cart.items
      .map((i) => ({ i, p: findProduct(db, i.productId) }))
      .filter(({ i, p }) => i.qty > p.stock)
      .map(({ i, p }) => ({ productId: p.id, name: p.name, requested: i.qty, available: p.stock }));
    if (short.length) throw new HttpError(409, "Some items no longer have enough stock.", { details: short });

    const view = presentCart(db, cart);
    const t = view.totals[value.deliveryMethod];
    const p = payment.value;
    const order = {
      id: newOrderId(db), userId: user.id, email: user.email, created: Date.now(), date: todayISO(), status: "Processing",
      items: view.lines.map((l) => ({ id: l.id, name: l.product.name, price: l.product.price, qty: l.qty })),
      subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total, coupon: t.discount ? t.coupon : "",
      deliveryMethod: t.method, eta: DELIVERY[t.method].eta,
      contact: contact.value, shipping: shipping.value,
      payment: { method: p.method, label: p.method === "cod" ? "Cash on Delivery" : p.method === "card" ? "Card" : p.label, ...(p.account ? { account: p.account } : {}), ...(p.last4 ? { last4: p.last4 } : {}) },
      notes: value.notes || "",
      history: [{ status: "Processing", at: new Date().toISOString() }]
    };

    // the order takes the items out of stock, and the cart starts again empty
    for (const item of cart.items) findProduct(db, item.productId).stock -= item.qty;
    cart.items = [];
    cart.coupon = "";
    touch(cart);
    db.orders.push(order);
    return ok({ message: `Order ${order.id} placed.`, data: order }, 201, { Location: `/api/orders/${order.id}` });
  }, { auth: "user", body: true, description: "Place an order from a cart (takes the items out of stock)" });

  route("GET", "/api/orders", ({ db, user, query }) => {
    onlyParams(query, ["status"]);
    let list = db.orders.filter((o) => canSee(user, o));
    if (query.has("status")) list = list.filter((o) => o.status === query.get("status"));
    list.sort((a, b) => b.created - a.created);
    return ok({ count: list.length, total: list.length, data: list });
  }, { auth: "user", description: "My orders, newest first (the admin sees every order)" });

  route("GET", "/api/orders/:id", ({ db, params, user }) => {
    const order = db.orders.find((o) => o.id === params.id);
    if (!order || !canSee(user, order)) throw new HttpError(404, `Order ${params.id} not found.`);
    return ok({ data: order });
  }, { auth: "user", description: "One order" });

  route("PATCH", "/api/orders/:id", ({ db, params, body, user }) => {
    const order = db.orders.find((o) => o.id === params.id);
    if (!order || !canSee(user, order)) throw new HttpError(404, `Order ${params.id} not found.`);
    const { status } = check(body, SCHEMAS.orderStatus);
    const allowed = user.role === "admin"
      ? { Processing: ["Shipped", "Cancelled"], Shipped: ["Delivered"], Delivered: [], Cancelled: [] }[order.status]
      : order.status === "Processing" ? ["Cancelled"] : [];
    if (!allowed.includes(status)) {
      const why = user.role === "admin" ? `An order that is ${order.status} cannot become ${status}.`
        : status === "Cancelled" ? "Only orders that are still processing can be cancelled." : "Customers can only cancel an order.";
      throw new HttpError(409, why, { allowed });
    }
    if (status === "Cancelled") {
      // put the items back on the shelf
      order.items.forEach((it) => { const p = db.products.find((x) => x.id === it.id); if (p) p.stock += it.qty; });
    }
    order.status = status;
    order.history.push({ status, at: new Date().toISOString() });
    return ok({ message: `Order ${order.id} is now ${status}.`, data: order });
  }, { auth: "user", body: true, description: "Change an order's status (customers can cancel while processing)" });

  /* ===================== request entry point ===================== */

  function readBody(req, method) {
    const raw = typeof req.body === "string" ? req.body : "";
    if (raw.trim() === "") throw new HttpError(400, `A JSON body is required for ${method}.`);
    const type = String((req.headers || {})["content-type"] || "");
    if (!type.includes("application/json")) throw new HttpError(415, "Send the body as JSON with the header Content-Type: application/json.");
    let body;
    try { body = JSON.parse(raw); } catch (err) { throw new HttpError(400, `The body is not valid JSON: ${err.message}`); }
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "The body must be a JSON object.");
    return body;
  }

  function userFrom(db, headers) {
    const match = /^Bearer\s+(\S+)$/i.exec(String((headers || {}).authorization || ""));
    if (!match) return { user: null, token: null, sent: false };
    const session = db.sessions.find((s) => s.token === match[1] && s.expires > Date.now());
    const user = session ? db.users.find((u) => u.id === session.userId) : null;
    return { user: user || null, token: match[1], sent: true };
  }

  async function processRequest(req) {
    const method = String(req.method || "GET").toUpperCase();
    const url = new URL(req.url || "/", "http://localhost");
    try {
      const matches = routes.map((r) => ({ r, m: r.regex.exec(url.pathname) })).filter((x) => x.m);
      if (!matches.length) return ok({ error: "Route not found", path: url.pathname }, 404);
      const allowed = [...new Set(matches.map((x) => x.r.method))];
      if (method === "OPTIONS") return ok(null, 204, { Allow: [...allowed, "OPTIONS"].join(", ") });
      const hit = matches.find((x) => x.r.method === method);
      if (!hit) return ok({ error: `Method ${method} is not allowed on ${url.pathname}.`, allowed }, 405, { Allow: allowed.join(", ") });

      const body = hit.r.body ? readBody(req, method) : undefined;

      let db = storage.read();
      if (!db) {
        db = await createDatabase();
        storage.write(db);
      }

      const { user, token, sent } = userFrom(db, req.headers);
      if ((hit.r.auth === "user" || hit.r.auth === "admin") && !user) {
        throw new HttpError(401, sent ? "Your login has expired. Please log in again." : "Please log in first.", {});
      }
      if (hit.r.auth === "admin" && user.role !== "admin") throw new HttpError(403, "Only the store admin can do this.");

      const ctx = { db, params: decodeParams(hit.m.groups), query: url.searchParams, body, user, token, changed: false };
      const result = await hit.r.handler(ctx);

      if ((method !== "GET" && result.status < 400) || ctx.changed) {
        db.updatedAt = new Date().toISOString();
        storage.write(db);
      }
      return result;
    } catch (err) {
      if (err instanceof HttpError) {
        return ok({ error: err.message, ...err.extra }, err.status, err.status === 401 ? { "WWW-Authenticate": "Bearer" } : {});
      }
      console.error(err);
      return ok({ error: "Something went wrong on the server." }, 500);
    }
  }

  const decodeParams = (groups = {}) => Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, decodeURIComponent(v)]));

  // One request at a time: each waits for the previous one to finish
  let queue = Promise.resolve();
  function handle(req) {
    const run = queue.then(() => processRequest(req));
    queue = run.catch(() => {});
    return run;
  }

  return { handle };
}
