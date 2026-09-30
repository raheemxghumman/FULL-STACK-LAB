/* ==========================================================================
   Kashi Ghar — shared store logic
   Author: Abdulraheem · Full Stack Web Development Lab 3
   --------------------------------------------------------------------------
   Loaded on every page after products.js. Exposes one global, window.KG:

     Cart     getCart, cartLines, cartCount, addToCart, updateQty,
              removeItem, clearCart
     Coupons  applyCoupon, removeCoupon, getCoupon, totals
     Auth     signup, login, logout, currentUser, hashPassword
     Reviews  getReviews, addReview, productRating, ratingSummary
     Orders   placeOrder, getOrders
     UI       renderChrome (navbar + mini-cart offcanvas + footer),
              toast, stars, art, fmt, escapeHTML, safeNext

   Everything is stored in the browser's localStorage. This is a FRONT-END
   DEMO: a real shop would keep users, passwords and orders on a server.
   Pages fire/listen to two DOM events:
     'kg:cart'    whenever the cart or coupon changes
     'kg:reviews' whenever a review is added
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Constants ---------------------------------------------- */
  const KEYS = {
    cart: 'kg_cart', users: 'kg_users', session: 'kg_session',
    reviews: 'kg_reviews', orders: 'kg_orders', coupon: 'kg_coupon'
  };

  const DELIVERY = {
    standard: { label: 'Standard delivery', eta: '3–5 working days', fee: 250, freeOver: 5000 },
    express:  { label: 'Express delivery',  eta: '1–2 working days', fee: 600 }
  };

  const COUPONS = {
    MULTAN10: { type: 'percent', value: 10, label: '10% off your order' },
    KASHI500: { type: 'flat', value: 500, min: 3000, label: 'PKR 500 off orders over PKR 3,000' }
  };

  /* Seeded demo account. The hash is SHA-256("demo@kashighar.pk:demo1234"). */
  const DEMO_USER = {
    name: 'Demo Customer', email: 'demo@kashighar.pk', phone: '03001234567', city: 'Multan',
    passHash: '8d153249e074f6b290447784d1cbdcd7c8b55e085edc89f1e2c5caa9c58fca33',
    created: '2026-09-01'
  };

  const PRODUCTS = window.KG_PRODUCTS || [];
  const CATEGORIES = window.KG_CATEGORIES || {};

  /* ---------- 2. Small helpers ------------------------------------------ */
  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  const fmt = (n) => 'PKR ' + Math.round(n).toLocaleString('en-US');

  /* Escape anything typed by a user before putting it into innerHTML. */
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function getProduct(id) { return PRODUCTS.find((p) => p.id === id) || null; }

  function formatDate(iso) {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* Only allow redirects to our own pages (prevents ?next=https://evil). */
  function safeNext(value, fallback) {
    return /^[a-z-]+\.html(#[\w-]+)?$/i.test(value || '') ? value : (fallback || 'index.html');
  }

  const emit = (name) => window.dispatchEvent(new CustomEvent(name));

  /* ---------- 3. Cart ---------------------------------------------------- */
  function getCart() {
    return read(KEYS.cart, []).filter((line) => getProduct(line.id) && line.qty > 0);
  }
  function saveCart(cart) { write(KEYS.cart, cart); emit('kg:cart'); }

  function cartLines() {
    return getCart().map((line) => {
      const product = getProduct(line.id);
      return { id: line.id, qty: line.qty, product, lineTotal: product.price * line.qty };
    });
  }
  const cartCount = () => getCart().reduce((sum, l) => sum + l.qty, 0);

  /* Adds qty of a product, never exceeding the stock. */
  function addToCart(id, qty) {
    const product = getProduct(id);
    if (!product) return { ok: false, msg: 'That product no longer exists.' };
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const cart = getCart();
    const line = cart.find((l) => l.id === id);
    const current = line ? line.qty : 0;
    if (current >= product.stock) {
      return { ok: false, msg: `You already have all ${product.stock} available in your cart.` };
    }
    const next = Math.min(product.stock, current + qty);
    if (line) line.qty = next; else cart.push({ id, qty: next });
    saveCart(cart);
    return { ok: true, qty: next, added: next - current, capped: current + qty > product.stock, product };
  }

  /* Sets an exact quantity (1..stock). Returns ok:false for invalid values. */
  function updateQty(id, qty) {
    const product = getProduct(id);
    const n = Number(qty);
    if (!product) return { ok: false, msg: 'Unknown product.' };
    if (!Number.isInteger(n) || n < 1 || n > product.stock) {
      return { ok: false, msg: `Enter a quantity from 1 to ${product.stock}.` };
    }
    const cart = getCart();
    const line = cart.find((l) => l.id === id);
    if (!line) return { ok: false, msg: 'That item is not in your cart.' };
    line.qty = n;
    saveCart(cart);
    return { ok: true, qty: n };
  }

  function removeItem(id) { saveCart(getCart().filter((l) => l.id !== id)); }

  function clearCart() {
    write(KEYS.cart, []);
    localStorage.removeItem(KEYS.coupon);
    emit('kg:cart');
  }

  /* ---------- 4. Coupons & totals --------------------------------------- */
  const getCoupon = () => localStorage.getItem(KEYS.coupon) || '';

  function couponDiscount(code, subtotal) {
    const c = COUPONS[code];
    if (!c || subtotal <= 0 || (c.min && subtotal < c.min)) return 0;
    return c.type === 'percent' ? Math.round(subtotal * c.value / 100) : Math.min(c.value, subtotal);
  }

  function applyCoupon(raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return { ok: false, msg: 'Enter a coupon code first.' };
    const c = COUPONS[code];
    if (!c) return { ok: false, msg: `“${code}” is not a valid coupon.` };
    const subtotal = totals().subtotal;
    if (c.min && subtotal < c.min) return { ok: false, msg: `${code} works on orders of ${fmt(c.min)} or more.` };
    localStorage.setItem(KEYS.coupon, code);
    emit('kg:cart');
    return { ok: true, code, msg: `${code} applied: ${c.label}.` };
  }

  function removeCoupon() { localStorage.removeItem(KEYS.coupon); emit('kg:cart'); }

  /* All money maths lives here so cart, mini-cart and checkout always agree. */
  function totals(method) {
    const lines = cartLines();
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const code = getCoupon();
    const discount = code ? couponDiscount(code, subtotal) : 0;
    const d = DELIVERY[method] || DELIVERY.standard;
    let delivery = 0;
    if (subtotal > 0) delivery = d.freeOver && subtotal >= d.freeOver ? 0 : d.fee;
    return {
      subtotal, discount, delivery,
      total: Math.max(0, subtotal - discount + delivery),
      count: lines.reduce((s, l) => s + l.qty, 0),
      coupon: code,
      couponLabel: code && COUPONS[code] ? COUPONS[code].label : '',
      couponInactive: !!code && discount === 0,   // e.g. KASHI500 after subtotal dropped
      freeDeliveryGap: Math.max(0, DELIVERY.standard.freeOver - subtotal),
      method: DELIVERY[method] ? method : 'standard'
    };
  }

  /* ---------- 5. Accounts ------------------------------------------------ */
  /* SHA-256 of "email:password". Front-end demo only — never do auth in the
     browser for a real shop. Falls back to FNV-1a if crypto.subtle is
     unavailable (non-secure contexts). */
  async function hashPassword(email, password) {
    const text = String(email).trim().toLowerCase() + ':' + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv-' + h.toString(16);
  }

  function getUsers() {
    const users = read(KEYS.users, []);
    if (!users.some((u) => u.email === DEMO_USER.email)) {
      users.push(DEMO_USER);
      write(KEYS.users, users);
    }
    return users;
  }

  function setSession(email, remember) {
    localStorage.removeItem(KEYS.session);
    sessionStorage.removeItem(KEYS.session);
    (remember ? localStorage : sessionStorage).setItem(KEYS.session, email);
  }

  function currentUser() {
    const email = localStorage.getItem(KEYS.session) || sessionStorage.getItem(KEYS.session);
    if (!email) return null;
    const user = getUsers().find((u) => u.email === email);
    if (!user) return null;
    const { passHash, ...safe } = user;   // never hand the hash to the UI
    return safe;
  }

  async function signup(data) {
    const email = String(data.email || '').trim().toLowerCase();
    const users = getUsers();
    if (users.some((u) => u.email === email)) return { ok: false, field: 'email', msg: 'An account with this email already exists.' };
    if (String(data.password || '').length < 8) return { ok: false, field: 'password', msg: 'Password must be at least 8 characters.' };
    const user = {
      name: String(data.name).trim(), email, phone: String(data.phone || '').trim(), city: data.city || '',
      passHash: await hashPassword(email, data.password), created: todayISO()
    };
    users.push(user);
    write(KEYS.users, users);
    setSession(email, true);
    return { ok: true, user: currentUser() };
  }

  async function login(emailRaw, password, remember) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const user = getUsers().find((u) => u.email === email);
    if (!user || user.passHash !== await hashPassword(email, password)) {
      return { ok: false, msg: 'That email and password do not match an account.' };
    }
    setSession(email, !!remember);
    return { ok: true, user: currentUser() };
  }

  function logout() {
    localStorage.removeItem(KEYS.session);
    sessionStorage.removeItem(KEYS.session);
  }

  /* ---------- 6. Reviews ------------------------------------------------- */
  const storedReviews = () => read(KEYS.reviews, []);

  function getReviews(productId) {
    const all = storedReviews().concat(window.KG_SEED_REVIEWS || []);
    return all
      .filter((r) => !productId || r.productId === productId)
      .sort((a, b) => (b.date + (b.created || 0)).localeCompare(a.date + (a.created || 0)));
  }

  function addReview(input) {
    const rating = parseInt(input.rating, 10);
    const name = String(input.name || '').trim();
    const text = String(input.text || '').trim();
    if (!getProduct(input.productId)) return { ok: false, msg: 'Choose a product.' };
    if (!(rating >= 1 && rating <= 5)) return { ok: false, msg: 'Choose a star rating.' };
    if (name.length < 2) return { ok: false, msg: 'Enter your name.' };
    if (text.length < 10) return { ok: false, msg: 'Write at least 10 characters.' };
    const user = currentUser();
    const review = {
      id: 'r' + Date.now(), productId: input.productId, name, rating, text,
      city: user ? user.city : '', date: todayISO(), created: Date.now(), verified: !!user
    };
    const list = storedReviews();
    list.push(review);
    write(KEYS.reviews, list);
    emit('kg:reviews');
    return { ok: true, review };
  }

  /* Catalogue aggregate + reviews written in this browser. */
  function productRating(productOrId) {
    const p = typeof productOrId === 'string' ? getProduct(productOrId) : productOrId;
    const extra = storedReviews().filter((r) => r.productId === p.id);
    const count = p.reviewCount + extra.length;
    const sum = p.rating * p.reviewCount + extra.reduce((s, r) => s + r.rating, 0);
    return { avg: Math.round((sum / count) * 10) / 10, count };
  }

  /* Star buckets for the whole shop (used by the progress bars). */
  function ratingSummary() {
    const buckets = Object.assign({}, window.KG_RATING_BASE || {});
    storedReviews().forEach((r) => { buckets[r.rating] = (buckets[r.rating] || 0) + 1; });
    let total = 0, sum = 0;
    for (let s = 1; s <= 5; s++) { total += buckets[s] || 0; sum += s * (buckets[s] || 0); }
    return { buckets, total, avg: total ? Math.round((sum / total) * 10) / 10 : 0 };
  }

  /* ---------- 7. Orders -------------------------------------------------- */
  function getOrders(email) {
    const e = email || (currentUser() || {}).email;
    return read(KEYS.orders, []).filter((o) => o.email === e).sort((a, b) => b.created - a.created);
  }

  function newOrderId() {
    const taken = new Set(read(KEYS.orders, []).map((o) => o.id));
    let id;
    do { id = 'KG-2026-' + String(Math.floor(1000 + Math.random() * 9000)); } while (taken.has(id));
    return id;
  }

  /* details = { contact, shipping, deliveryMethod, payment, notes } */
  function placeOrder(details) {
    const user = currentUser();
    if (!user) return { ok: false, msg: 'Please log in to place an order.' };
    const lines = cartLines();
    if (!lines.length) return { ok: false, msg: 'Your cart is empty.' };
    const t = totals(details.deliveryMethod);
    const order = {
      id: newOrderId(), email: user.email, created: Date.now(), date: todayISO(), status: 'Processing',
      items: lines.map((l) => ({ id: l.id, name: l.product.name, price: l.product.price, qty: l.qty })),
      subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total, coupon: t.discount ? t.coupon : '',
      deliveryMethod: t.method, eta: DELIVERY[t.method].eta,
      contact: details.contact || {}, shipping: details.shipping || {}, payment: details.payment || { method: 'cod' },
      notes: details.notes || ''
    };
    const orders = read(KEYS.orders, []);
    orders.push(order);
    write(KEYS.orders, orders);
    clearCart();
    return { ok: true, order };
  }

  /* ---------- 8. UI helpers --------------------------------------------- */
  function stars(avg, extraClass) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const icon = avg >= i ? 'bi-star-fill' : (avg >= i - 0.5 ? 'bi-star-half' : 'bi-star');
      html += `<i class="bi ${icon}" aria-hidden="true"></i>`;
    }
    return `<span class="stars ${extraClass || ''}" role="img" aria-label="${avg} out of 5 stars">${html}</span>`;
  }

  function art(p, cls) {
    return `<svg class="product-art ${cls || ''}" viewBox="0 0 200 200" role="img" aria-label="${escapeHTML(p.name)}"><use href="#${p.art}"/></svg>`;
  }

  /* Bootstrap toast. variant: success | warning | danger | info */
  function toast(title, body, variant) {
    const icons = { success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', danger: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const v = variant || 'success';
    const holder = document.getElementById('toastHolder');
    if (!holder || !window.bootstrap) return;
    const el = document.createElement('div');
    el.className = 'toast kg-toast border-0';
    el.setAttribute('role', v === 'danger' ? 'alert' : 'status');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = `
      <div class="toast-header">
        <i class="bi ${icons[v]} me-2 text-${v === 'info' ? 'primary' : v}"></i>
        <strong class="me-auto">${escapeHTML(title)}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">${body}</div>`;
    holder.appendChild(el);
    el.addEventListener('hidden.bs.toast', () => el.remove());
    new bootstrap.Toast(el, { delay: 3500 }).show();
  }

  /* ---------- 9. Shared layout: navbar, mini-cart, footer --------------- */
  function navbarHTML(page) {
    const link = (key, href, label) =>
      `<li class="nav-item"><a class="nav-link${page === key ? ' active' : ''}"${page === key ? ' aria-current="page"' : ''} href="${href}">${label}</a></li>`;
    const onShop = page === 'shop';
    return `
    <nav class="navbar navbar-expand-lg sticky-top kg-navbar" aria-label="Main navigation">
      <div class="container">
        <a class="navbar-brand d-flex align-items-center gap-2" href="index.html">
          <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true"><use href="#logo"/></svg>
          <span class="lh-1"><span class="brand-name">Kashi Ghar</span><small class="brand-tag d-block">Multani blue pottery</small></span>
        </a>

        <div class="d-flex align-items-center gap-2 order-lg-last ms-auto ms-lg-3">
          <button class="btn btn-cart position-relative" type="button" data-bs-toggle="offcanvas" data-bs-target="#miniCart" aria-controls="miniCart" aria-label="Open cart">
            <i class="bi bi-bag" aria-hidden="true"></i>
            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill cart-badge" id="cartBadge">0</span>
          </button>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
        </div>

        <div class="collapse navbar-collapse" id="mainNav">
          <ul class="navbar-nav mx-lg-auto">
            ${link('shop', onShop ? '#home' : 'index.html#home', 'Home')}
            ${link('shop-list', onShop ? '#shop' : 'index.html#shop', 'Shop')}
            ${link('reviews', onShop ? '#reviews' : 'index.html#reviews', 'Reviews')}
            ${link('about', onShop ? '#about' : 'index.html#about', 'About')}
          </ul>
          <form class="nav-search my-2 my-lg-0" role="search" id="navSearchForm">
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
              <input class="form-control" type="search" id="navSearch" placeholder="Search vases, lamps, khussa…" aria-label="Search products">
            </div>
          </form>
          <div id="authArea" class="d-flex align-items-center gap-2 ms-lg-3 pb-2 pb-lg-0"></div>
        </div>
      </div>
    </nav>`;
  }

  function authAreaHTML() {
    const user = currentUser();
    if (!user) {
      return `<a class="btn btn-sm btn-outline-primary" href="login.html"><i class="bi bi-person"></i> Log in</a>
              <a class="btn btn-sm btn-primary" href="signup.html">Sign up</a>`;
    }
    const first = escapeHTML(user.name.split(' ')[0]);
    return `
      <div class="dropdown">
        <button class="btn btn-sm btn-outline-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-person-circle"></i> Hi, ${first}
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm">
          <li><h6 class="dropdown-header">${escapeHTML(user.email)}</h6></li>
          <li><a class="dropdown-item" href="account.html"><i class="bi bi-box-seam me-2"></i>My orders</a></li>
          <li><a class="dropdown-item" href="cart.html"><i class="bi bi-bag me-2"></i>My cart</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><button class="dropdown-item text-danger" type="button" data-logout><i class="bi bi-box-arrow-right me-2"></i>Log out</button></li>
        </ul>
      </div>`;
  }

  const miniCartShell = `
    <div class="offcanvas offcanvas-end kg-offcanvas" tabindex="-1" id="miniCart" aria-labelledby="miniCartLabel">
      <div class="offcanvas-header border-bottom">
        <h2 class="offcanvas-title h5 mb-0" id="miniCartLabel"><i class="bi bi-bag me-2"></i>Your cart</h2>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body" id="miniCartBody"></div>
      <div class="border-top p-3 bg-body" id="miniCartFooter"></div>
    </div>`;

  function renderMiniCart() {
    const body = document.getElementById('miniCartBody');
    const foot = document.getElementById('miniCartFooter');
    if (!body) return;
    const lines = cartLines();
    if (!lines.length) {
      body.innerHTML = `
        <div class="text-center py-5 text-body-secondary">
          <i class="bi bi-bag-x display-5 d-block mb-3"></i>
          <p class="mb-3">Your cart is empty.</p>
          <a href="index.html#shop" class="btn btn-primary btn-sm" data-bs-dismiss="offcanvas">Browse the shop</a>
        </div>`;
      foot.innerHTML = '';
      foot.classList.add('d-none');
      return;
    }
    foot.classList.remove('d-none');
    body.innerHTML = `<ul class="list-group list-group-flush">${lines.map((l) => `
      <li class="list-group-item px-0 d-flex gap-3 align-items-center">
        <div class="thumb thumb-sm" style="--thumb-bg:${l.product.bg}">${art(l.product)}</div>
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold small text-truncate">${escapeHTML(l.product.name)}</div>
          <div class="small text-body-secondary">${fmt(l.product.price)}</div>
          <div class="input-group input-group-sm qty-group mt-1">
            <button class="btn btn-outline-secondary" type="button" data-mini-dec="${l.id}" ${l.qty <= 1 ? 'disabled' : ''} aria-label="Decrease quantity of ${escapeHTML(l.product.name)}"><i class="bi bi-dash"></i></button>
            <span class="input-group-text bg-body" aria-live="polite">${l.qty}</span>
            <button class="btn btn-outline-secondary" type="button" data-mini-inc="${l.id}" ${l.qty >= l.product.stock ? 'disabled' : ''} aria-label="Increase quantity of ${escapeHTML(l.product.name)}"><i class="bi bi-plus"></i></button>
          </div>
        </div>
        <div class="text-end">
          <div class="fw-semibold small text-nowrap">${fmt(l.lineTotal)}</div>
          <button class="btn btn-link btn-sm text-danger p-0 mt-2" type="button" data-mini-remove="${l.id}" aria-label="Remove ${escapeHTML(l.product.name)}"><i class="bi bi-trash3"></i></button>
        </div>
      </li>`).join('')}</ul>`;
    const t = totals();
    foot.innerHTML = `
      <div class="d-flex justify-content-between mb-1"><span>Subtotal</span><strong>${fmt(t.subtotal)}</strong></div>
      ${t.discount ? `<div class="d-flex justify-content-between small text-success mb-1"><span>Coupon ${escapeHTML(t.coupon)}</span><span>− ${fmt(t.discount)}</span></div>` : ''}
      <p class="small text-body-secondary mb-3">${t.freeDeliveryGap > 0 ? `Add ${fmt(t.freeDeliveryGap)} more for free delivery.` : '<i class="bi bi-truck"></i> You get free standard delivery.'}</p>
      <div class="d-grid gap-2">
        <a href="cart.html" class="btn btn-outline-primary">View cart</a>
        <a href="checkout.html" class="btn btn-primary">Checkout · ${fmt(t.total)}</a>
      </div>`;
  }

  function updateBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const n = cartCount();
    badge.textContent = n;
    badge.classList.toggle('d-none', n === 0);
    badge.setAttribute('aria-label', n + ' items in cart');
  }

  const footerHTML = `
    <footer class="kg-footer mt-5">
      <div class="tile-strip" aria-hidden="true"></div>
      <div class="container py-5">
        <div class="row g-4">
          <div class="col-lg-4">
            <a class="d-inline-flex align-items-center gap-2 text-decoration-none mb-3" href="index.html">
              <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><use href="#logo"/></svg>
              <span class="brand-name text-white">Kashi Ghar</span>
            </a>
            <p class="small mb-0">Hand-painted blue pottery, camel-skin lamps and crafts, made by family workshops in Multan and shipped across Pakistan.</p>
          </div>
          <div class="col-6 col-lg-2">
            <h3 class="h6 text-white">Shop</h3>
            <ul class="list-unstyled small">
              <li><a href="index.html#shop">All products</a></li>
              <li><a href="index.html#reviews">Reviews</a></li>
              <li><a href="cart.html">Cart</a></li>
              <li><a href="account.html">My orders</a></li>
            </ul>
          </div>
          <div class="col-6 col-lg-2">
            <h3 class="h6 text-white">Help</h3>
            <ul class="list-unstyled small">
              <li><span>Delivery: 3–5 days</span></li>
              <li><span>7-day returns</span></li>
              <li><a href="login.html">Log in</a></li>
              <li><a href="signup.html">Create account</a></li>
            </ul>
          </div>
          <div class="col-lg-4">
            <h3 class="h6 text-white">Visit the workshop</h3>
            <p class="small mb-2"><i class="bi bi-geo-alt me-1"></i>Hussain Agahi Bazaar, Multan, Pakistan</p>
            <p class="small mb-3"><i class="bi bi-envelope me-1"></i>hello@kashighar.pk</p>
            <div class="d-flex flex-wrap gap-2" aria-label="Payment methods">
              <span class="badge pay-badge"><i class="bi bi-cash-coin"></i> Cash on Delivery</span>
              <span class="badge pay-badge"><i class="bi bi-phone"></i> JazzCash</span>
              <span class="badge pay-badge"><i class="bi bi-phone"></i> Easypaisa</span>
              <span class="badge pay-badge"><i class="bi bi-credit-card"></i> Visa / Mastercard</span>
            </div>
          </div>
        </div>
        <hr class="border-light opacity-25 my-4">
        <p class="small mb-0 text-center">© 2026 Kashi Ghar · Lab 3 project by Abdulraheem</p>
      </div>
    </footer>`;

  /* Injects the sprite, navbar, mini-cart, toast holder and footer. Pages
     only need <div id="site-nav"></div> and <div id="site-footer"></div>. */
  function renderChrome() {
    const page = document.body.dataset.page || '';
    if (!document.getElementById('kgSprite') && window.KG_SPRITE) {
      const holder = document.createElement('div');
      holder.id = 'kgSprite';
      holder.innerHTML = window.KG_SPRITE;
      document.body.prepend(holder);
    }
    const nav = document.getElementById('site-nav');
    if (nav) nav.outerHTML = navbarHTML(page);
    const foot = document.getElementById('site-footer');
    if (foot) foot.outerHTML = footerHTML;
    document.body.insertAdjacentHTML('beforeend', miniCartShell +
      '<div class="toast-container position-fixed bottom-0 end-0 p-3" id="toastHolder" aria-live="polite" aria-atomic="false"></div>');
    renderAuthArea();
    updateBadge();
    renderMiniCart();
  }

  function renderAuthArea() {
    const area = document.getElementById('authArea');
    if (area) area.innerHTML = authAreaHTML();
  }

  /* ---------- 10. Global event wiring ----------------------------------- */
  function bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      if (add) {
        const qtySource = add.dataset.qtyInput ? document.querySelector(add.dataset.qtyInput) : null;
        const qty = qtySource ? qtySource.value : 1;
        const res = addToCart(add.dataset.add, qty);
        if (res.ok) {
          toast('Added to cart',
            `${escapeHTML(res.product.name)} × ${res.added}${res.capped ? ' (limited by stock)' : ''}.
             <a href="cart.html" class="ms-1 fw-semibold">View cart</a>`, 'success');
          add.classList.add('btn-added');
          setTimeout(() => add.classList.remove('btn-added'), 900);
        } else {
          toast('Not added', escapeHTML(res.msg), 'warning');
        }
        return;
      }
      const dec = e.target.closest('[data-mini-dec]');
      if (dec) { const l = getCart().find((x) => x.id === dec.dataset.miniDec); if (l) updateQty(l.id, l.qty - 1); return; }
      const inc = e.target.closest('[data-mini-inc]');
      if (inc) { const l = getCart().find((x) => x.id === inc.dataset.miniInc); if (l) updateQty(l.id, l.qty + 1); return; }
      const rem = e.target.closest('[data-mini-remove]');
      if (rem) {
        const p = getProduct(rem.dataset.miniRemove);
        removeItem(rem.dataset.miniRemove);
        toast('Removed', `${escapeHTML(p.name)} was removed from your cart.`, 'info');
        return;
      }
      if (e.target.closest('[data-logout]')) {
        logout();
        const page = document.body.dataset.page;
        if (page === 'checkout' || page === 'account') { location.href = 'index.html'; return; }
        renderAuthArea();
        toast('Logged out', 'See you again soon.', 'info');
        window.dispatchEvent(new CustomEvent('kg:auth'));
      }
    });

    /* Navbar search: filters live on the shop page, otherwise jumps there. */
    const form = document.getElementById('navSearchForm');
    const input = document.getElementById('navSearch');
    if (form && input) {
      const q = new URLSearchParams(location.search).get('q');
      if (q) input.value = q;
      input.addEventListener('input', () => {
        if (document.body.dataset.page === 'shop') {
          window.dispatchEvent(new CustomEvent('kg:search', { detail: input.value }));
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (document.body.dataset.page === 'shop') {
          window.dispatchEvent(new CustomEvent('kg:search', { detail: input.value }));
          document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        } else {
          location.href = 'index.html?q=' + encodeURIComponent(input.value) + '#shop';
        }
      });
    }

    window.addEventListener('kg:cart', () => { updateBadge(); renderMiniCart(); });
    /* Keep several open tabs in sync. */
    window.addEventListener('storage', (e) => {
      if (e.key === KEYS.cart || e.key === KEYS.coupon) { updateBadge(); renderMiniCart(); emit('kg:cart'); }
    });
  }

  /* ---------- 11. Demo mode (SCREENSHOTS / MARKING ONLY) ---------------- */
  /* Adding ?demo=1 to any page logs in the demo account for this tab and
     puts three items in an empty cart, so logged-in and cart states can be
     screenshotted without clicking through. Extra flags:
       &cart=open    opens the mini-cart offcanvas
       &orders=1     adds one sample past order if the demo user has none
     Normal visitors never see any of this. */
  function applyDemoMode() {
    const q = new URLSearchParams(location.search);
    if (q.get('demo') !== '1') return;
    getUsers();
    setSession(DEMO_USER.email, false);
    if (!getCart().length) write(KEYS.cart, [{ id: 'p1', qty: 1 }, { id: 'p5', qty: 2 }, { id: 'p9', qty: 1 }]);
    if (q.get('coupon')) localStorage.setItem(KEYS.coupon, q.get('coupon').toUpperCase());
    if (q.get('orders') === '1' && !getOrders(DEMO_USER.email).length) {
      const orders = read(KEYS.orders, []);
      orders.push({
        id: 'KG-2026-4172', email: DEMO_USER.email, created: Date.parse('2026-09-14'), date: '2026-09-14', status: 'Delivered',
        items: [{ id: 'p4', name: 'Hand-painted Wall Plate', price: 1850, qty: 2 }, { id: 'p8', name: 'Hexagon Coasters · Set of 4', price: 1400, qty: 1 }],
        subtotal: 5100, discount: 510, delivery: 0, total: 4590, coupon: 'MULTAN10', deliveryMethod: 'standard', eta: DELIVERY.standard.eta,
        contact: { name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone },
        shipping: { address: 'House 12, Street 4, Gulgasht Colony', city: 'Multan', postal: '60000' },
        payment: { method: 'cod', label: 'Cash on Delivery' }, notes: ''
      });
      write(KEYS.orders, orders);
    }
  }

  /* ---------- 12. Boot --------------------------------------------------- */
  window.KG = {
    KEYS, DELIVERY, COUPONS, CATEGORIES, PRODUCTS, DEMO_USER,
    fmt, escapeHTML, formatDate, safeNext, getProduct,
    getCart, cartLines, cartCount, addToCart, updateQty, removeItem, clearCart,
    getCoupon, applyCoupon, removeCoupon, totals,
    hashPassword, signup, login, logout, currentUser,
    getReviews, addReview, productRating, ratingSummary,
    placeOrder, getOrders,
    stars, art, toast, renderAuthArea, renderMiniCart
  };

  applyDemoMode();
  getUsers();   // make sure the demo account exists

  function boot() {
    if (document.getElementById('site-nav') || document.body.dataset.page) {
      renderChrome();
      bindGlobalEvents();
      const q = new URLSearchParams(location.search);
      if (q.get('cart') === 'open' && window.bootstrap) {
        bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('miniCart')).show();
      }
      /* Greeting after a successful signup (signup.html redirects with ?welcome=1). */
      const user = currentUser();
      if (q.get('welcome') === '1' && user) {
        toast('Welcome to Kashi Ghar', `Your account is ready, ${escapeHTML(user.name.split(' ')[0])}. Use MULTAN10 for 10% off.`, 'success');
      }
    }
    window.dispatchEvent(new CustomEvent('kg:ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
