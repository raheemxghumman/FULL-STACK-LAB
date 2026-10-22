/* ==========================================================================
   Kashi Ghar — shared store logic (Lab 7: now backed by the API)
   Author: Abdulraheem · Full Stack Web Development Lab 3, updated in Lab 7
   --------------------------------------------------------------------------
   In Lab 3 every function here read and wrote localStorage. In Lab 7 the
   data belongs to the Kashi Ghar API (see ../lib/router.js), and this file
   only talks to it through KGApi.request():

     Catalogue  GET  /api/products, /api/categories, /api/delivery-options
     Cart       POST /api/carts, GET/POST/PATCH/DELETE /api/carts/:id/items...,
                PUT/DELETE /api/carts/:id/coupon
     Accounts   POST /api/auth/signup | login | logout, GET /api/auth/me
     Reviews    GET  /api/reviews, /api/reviews/summary, POST /api/reviews
     Orders     POST /api/orders, GET /api/orders, PATCH /api/orders/:id

   The browser keeps only two things: the id of its cart (kg_cart_id) and
   the login token (kg_token). Everything else is loaded from the API when
   the page opens and kept in `state`, so pages can still read it without
   waiting (KG.cartLines(), KG.PRODUCTS ...). Every change is sent to the
   API first, and `state` is updated from the API's answer.

   Pages wait for the data with KG.whenReady(fn). Events, as in Lab 3:
     'kg:cart'    the cart or coupon changed
     'kg:reviews' a review was added
     'kg:auth'    the user logged out
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Browser keys and state ---------------------------------- */
  const KEYS = { token: 'kg_token', cart: 'kg_cart_id' };

  const state = {
    products: [], categories: {}, delivery: {}, cart: null, user: null,
    reviews: [], summary: { buckets: {}, total: 0, avg: 0 }, orders: []
  };

  const EMPTY_TOTALS = { subtotal: 0, discount: 0, delivery: 0, total: 0, count: 0, coupon: '', couponLabel: '', couponInactive: false, freeDeliveryGap: 5000, method: 'standard' };

  /* ---------- 2. Small helpers ------------------------------------------ */
  const fmt = (n) => 'PKR ' + Math.round(n).toLocaleString('en-US');

  /* Escape anything typed by a user before putting it into innerHTML. */
  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function getProduct(id) { return state.products.find((p) => p.id === id) || null; }

  function formatDate(iso) {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* Only allow redirects to our own pages (prevents ?next=https://evil). */
  function safeNext(value, fallback) {
    return /^[a-z-]+\.html(#[\w-]+)?$/i.test(value || '') ? value : (fallback || 'index.html');
  }

  const emit = (name) => window.dispatchEvent(new CustomEvent(name));

  /* Login token: localStorage when "remember me" is ticked, otherwise only for this tab. */
  const getToken = () => localStorage.getItem(KEYS.token) || sessionStorage.getItem(KEYS.token);
  function setToken(token, remember) {
    clearToken();
    (remember ? localStorage : sessionStorage).setItem(KEYS.token, token);
  }
  function clearToken() {
    localStorage.removeItem(KEYS.token);
    sessionStorage.removeItem(KEYS.token);
  }

  const call = (method, path, body) => KGApi.request(method, path, body, getToken());

  /* Turns an API error into the { ok:false, msg } shape the pages already use. */
  function fail(r) {
    const d = r.data || {};
    const details = Array.isArray(d.details) ? d.details : [];
    const parts = details.map((x) => x.message || (x.name ? `${x.name}: only ${x.available} left` : '')).filter(Boolean);
    return { ok: false, status: r.status, msg: parts.length && r.status === 422 ? parts.join(' ') : (d.error || 'Something went wrong.'), details, field: details[0] && details[0].field };
  }

  /* ---------- 3. Loading data from the API ------------------------------- */
  async function must(method, path) {
    const r = await call(method, path);
    if (!r.ok) throw new Error((r.data && r.data.error) || `${method} ${path} failed (${r.status})`);
    return r.data;
  }

  async function loadProducts() { state.products = (await must('GET', '/api/products')).data; }
  async function loadCategories() {
    state.categories = Object.fromEntries((await must('GET', '/api/categories')).data.map((c) => [c.key, c.label]));
  }
  async function loadDelivery() { state.delivery = (await must('GET', '/api/delivery-options')).data; }
  async function loadReviews() { state.reviews = (await must('GET', '/api/reviews')).data; }
  async function loadSummary() { state.summary = (await must('GET', '/api/reviews/summary')).data; }

  /* The cart lives on the server; this browser only remembers its id. */
  async function loadCart() {
    const id = localStorage.getItem(KEYS.cart);
    if (id) {
      const r = await call('GET', '/api/carts/' + encodeURIComponent(id));
      if (r.ok) { state.cart = r.data.data; return; }
    }
    state.cart = (await must('POST', '/api/carts')).data;
    localStorage.setItem(KEYS.cart, state.cart.id);
  }

  async function loadUser() {
    if (!getToken()) { state.user = null; return; }
    const r = await call('GET', '/api/auth/me');
    if (r.ok) state.user = r.data.data;
    else { clearToken(); state.user = null; }   // expired or logged out elsewhere
  }

  async function loadOrders() {
    if (!state.user) { state.orders = []; return; }
    const r = await call('GET', '/api/orders');
    state.orders = r.ok ? r.data.data : [];
  }

  /* ---------- 4. Cart ---------------------------------------------------- */
  function getCart() { return state.cart ? state.cart.lines.map((l) => ({ id: l.id, qty: l.qty })) : []; }
  function cartLines() { return state.cart ? state.cart.lines : []; }
  const cartCount = () => (state.cart ? state.cart.count : 0);

  /* Sends a cart change. If the cart has disappeared (e.g. the data was reset), starts a new one and tries again. */
  async function cartRequest(method, path, body) {
    let r = await call(method, `/api/carts/${state.cart.id}${path}`, body);
    if (r.status === 404 && r.data && /Cart not found/.test(r.data.error)) {
      localStorage.removeItem(KEYS.cart);
      await loadCart();
      r = await call(method, `/api/carts/${state.cart.id}${path}`, body);
    }
    if (r.ok) { state.cart = r.data.data; emit('kg:cart'); }
    return r;
  }

  /* Adds qty of a product. The API never lets the cart go above the stock. */
  async function addToCart(id, qty) {
    const r = await cartRequest('POST', '/items', { productId: id, qty: Math.max(1, parseInt(qty, 10) || 1) });
    if (!r.ok) return fail(r);
    const line = state.cart.lines.find((l) => l.id === id);
    return { ok: true, qty: line ? line.qty : 0, added: r.data.added, capped: r.data.capped, product: line ? line.product : getProduct(id) };
  }

  /* Sets an exact quantity. The API answers 422 for anything outside 1..stock. */
  async function updateQty(id, qty) {
    const n = Number(qty);
    const r = await cartRequest('PATCH', '/items/' + encodeURIComponent(id), { qty: Number.isFinite(n) ? n : String(qty) });
    return r.ok ? { ok: true, qty: n } : fail(r);
  }

  async function removeItem(id) {
    const r = await cartRequest('DELETE', '/items/' + encodeURIComponent(id));
    return r.ok ? { ok: true } : fail(r);
  }

  async function clearCart() {
    const r = await cartRequest('DELETE', '/items');
    return r.ok ? { ok: true } : fail(r);
  }

  /* ---------- 5. Coupons & totals (worked out by the API) ---------------- */
  const getCoupon = () => (state.cart ? state.cart.coupon : '');

  async function applyCoupon(raw) {
    const r = await cartRequest('PUT', '/coupon', { code: String(raw || '') });
    return r.ok ? { ok: true, code: state.cart.coupon, msg: r.data.message } : fail(r);
  }

  async function removeCoupon() {
    const r = await cartRequest('DELETE', '/coupon');
    return r.ok ? { ok: true } : fail(r);
  }

  /* The cart from the API already holds the totals for each delivery method. */
  function totals(method) {
    const all = state.cart && state.cart.totals;
    if (!all) return EMPTY_TOTALS;
    return all[method] || all.standard;
  }

  /* ---------- 6. Accounts ------------------------------------------------ */
  function currentUser() { return state.user; }

  async function signup(data) {
    const r = await call('POST', '/api/auth/signup', {
      name: String(data.name || ''), email: String(data.email || ''), phone: String(data.phone || ''),
      city: String(data.city || ''), password: String(data.password || '')
    });
    if (!r.ok) return fail(r);
    setToken(r.data.data.token, true);
    state.user = r.data.data.user;
    state.orders = [];
    return { ok: true, user: state.user };
  }

  async function login(email, password, remember) {
    const r = await call('POST', '/api/auth/login', { email: String(email || ''), password: String(password || ''), remember: !!remember });
    if (!r.ok) return fail(r);
    setToken(r.data.data.token, !!remember);
    state.user = r.data.data.user;
    await loadOrders();
    return { ok: true, user: state.user };
  }

  async function logout() {
    await call('POST', '/api/auth/logout');
    clearToken();
    state.user = null;
    state.orders = [];
  }

  /* Used by the signup form to warn about an email that already has an account. */
  async function emailAvailable(email) {
    const r = await call('GET', '/api/auth/email-available?email=' + encodeURIComponent(email));
    return r.ok ? r.data.data.available : true;
  }

  /* ---------- 7. Reviews ------------------------------------------------- */
  function getReviews(productId) {
    return state.reviews.filter((r) => !productId || r.productId === productId);   // newest first, as sent by the API
  }

  async function addReview(input) {
    const r = await call('POST', '/api/reviews', {
      productId: input.productId, rating: parseInt(input.rating, 10),
      name: String(input.name || ''), text: String(input.text || '')
    });
    if (!r.ok) return fail(r);
    const updated = r.data.product;
    state.products = state.products.map((p) => (p.id === updated.id ? updated : p));
    state.reviews.unshift(r.data.data);
    await loadSummary();
    emit('kg:reviews');
    return { ok: true, review: r.data.data };
  }

  function productRating(productOrId) {
    const p = typeof productOrId === 'string' ? getProduct(productOrId) : productOrId;
    return p && p.rating ? p.rating : { avg: 0, count: 0 };
  }

  const ratingSummary = () => state.summary;

  /* Filtering, sorting and searching are done by the API (GET /api/products?...). */
  async function searchProducts({ category, q, sort } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (q && q.trim()) params.set('q', q.trim());
    if (sort && sort !== 'featured') params.set('sort', sort);
    const r = await call('GET', '/api/products' + (params.toString() ? '?' + params : ''));
    return r.ok ? { ok: true, list: r.data.data, total: r.data.total } : fail(r);
  }

  /* ---------- 8. Orders -------------------------------------------------- */
  function getOrders() { return state.orders; }

  /* details = { contact, shipping, deliveryMethod, payment, notes } */
  async function placeOrder(details) {
    if (!state.user) return { ok: false, msg: 'Please log in to place an order.' };
    const r = await call('POST', '/api/orders', {
      cartId: state.cart.id, deliveryMethod: details.deliveryMethod,
      contact: details.contact || {}, shipping: details.shipping || {}, payment: details.payment || { method: 'cod' },
      notes: details.notes || ''
    });
    if (!r.ok) return fail(r);
    // the order took items out of stock and emptied the cart
    await Promise.all([loadCart(), loadProducts(), loadOrders()]);
    emit('kg:cart');
    return { ok: true, order: r.data.data };
  }

  /* Customers can cancel an order while it is still processing; the API puts the stock back. */
  async function cancelOrder(id) {
    const r = await call('PATCH', '/api/orders/' + encodeURIComponent(id), { status: 'Cancelled' });
    if (!r.ok) return fail(r);
    await Promise.all([loadOrders(), loadProducts()]);
    return { ok: true, order: r.data.data, msg: r.data.message };
  }

  /* ---------- 9. UI helpers --------------------------------------------- */
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

  /* ---------- 10. Shared layout: navbar, mini-cart, footer -------------- */
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

  function footerHTML() {
    const where = KGApi.mode === 'server'
      ? `Node.js server · saved in ${escapeHTML(KGApi.storage.replace(/^file \((.*)\)$/, '$1'))}`
      : 'API running in this browser · saved in localStorage';
    return `
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
        <p class="small mb-1 text-center">© 2026 Kashi Ghar · Lab 3 store with the Lab 7 API, by Abdulraheem</p>
        <p class="small mb-0 text-center api-note"><i class="bi bi-hdd-network me-1"></i>Data from the Kashi Ghar API: ${where}</p>
      </div>
    </footer>`;
  }

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
    if (foot) foot.outerHTML = footerHTML();
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

  /* Shown instead of the page when the API cannot be reached. */
  function renderOffline(err) {
    const fromFile = location.protocol === 'file:';
    document.body.insertAdjacentHTML('afterbegin', `
      <div class="container py-5" role="alert">
        <div class="alert alert-danger shadow-sm">
          <h1 class="h5"><i class="bi bi-plug me-2"></i>The store could not reach the Kashi Ghar API</h1>
          <p class="mb-2">${fromFile
            ? 'This page was opened as a file. Browsers do not allow the API modules to load from <code>file://</code>.'
            : escapeHTML(err && err.message ? err.message : 'Unknown error.')}</p>
          <p class="mb-0">Start the server in <code>Lab 7/Part 2</code> with <code>npm start</code> and open <a href="http://localhost:3000/store/">http://localhost:3000/store/</a>.</p>
        </div>
      </div>`);
  }

  /* ---------- 11. Global event wiring ----------------------------------- */
  function bindGlobalEvents() {
    document.addEventListener('click', async (e) => {
      const add = e.target.closest('[data-add]');
      if (add) {
        if (add.disabled) return;
        const qtySource = add.dataset.qtyInput ? document.querySelector(add.dataset.qtyInput) : null;
        const qty = qtySource ? qtySource.value : 1;
        add.disabled = true;
        const res = await addToCart(add.dataset.add, qty);
        add.disabled = false;
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
      if (dec) { const l = getCart().find((x) => x.id === dec.dataset.miniDec); if (l) await updateQty(l.id, l.qty - 1); return; }
      const inc = e.target.closest('[data-mini-inc]');
      if (inc) { const l = getCart().find((x) => x.id === inc.dataset.miniInc); if (l) await updateQty(l.id, l.qty + 1); return; }
      const rem = e.target.closest('[data-mini-remove]');
      if (rem) {
        const line = cartLines().find((l) => l.id === rem.dataset.miniRemove);
        const res = await removeItem(rem.dataset.miniRemove);
        if (res.ok) toast('Removed', `${escapeHTML(line ? line.product.name : 'The item')} was removed from your cart.`, 'info');
        return;
      }
      if (e.target.closest('[data-logout]')) {
        await logout();
        const page = document.body.dataset.page;
        if (page === 'checkout' || page === 'account') { location.href = 'index.html'; return; }
        renderAuthArea();
        toast('Logged out', 'See you again soon.', 'info');
        emit('kg:auth');
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
    /* Coming back to the tab: the cart may have changed in another tab, so ask the API again. */
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible' || !state.cart) return;
      const r = await call('GET', '/api/carts/' + state.cart.id);
      if (r.ok && r.data.data.updated !== state.cart.updated) { state.cart = r.data.data; emit('kg:cart'); }
    });
  }

  /* ---------- 12. Demo mode (SCREENSHOTS / MARKING ONLY) ---------------- */
  /* Adding ?demo=1 to any page logs in the demo account for this tab and
     puts three items in an empty cart, all through the API. Extra flags:
       &cart=open       opens the mini-cart offcanvas
       &coupon=CODE     applies a coupon
       &orders=1        places one sample order if the demo user has none */
  async function applyDemoMode() {
    const q = new URLSearchParams(location.search);
    if (q.get('demo') !== '1') return;
    await loadUser();
    if (!state.user || state.user.email !== 'demo@kashighar.pk') {
      const r = await call('POST', '/api/auth/login', { email: 'demo@kashighar.pk', password: 'demo1234' });
      if (r.ok) setToken(r.data.data.token, false);
    }
    await loadCart();
    const fill = async (items) => { for (const [productId, qty] of items) await cartRequest('POST', '/items', { productId, qty }); };
    if (q.get('orders') === '1') {
      const mine = await call('GET', '/api/orders');
      if (mine.ok && !mine.data.data.length) {
        await cartRequest('DELETE', '/items');
        await fill([['p4', 2], ['p8', 1]]);
        await cartRequest('PUT', '/coupon', { code: 'MULTAN10' });
        await call('POST', '/api/orders', {
          cartId: state.cart.id, deliveryMethod: 'standard',
          contact: { name: 'Demo Customer', email: 'demo@kashighar.pk', phone: '03001234567' },
          shipping: { address: 'House 12, Street 4, Gulgasht Colony', area: '', city: 'Multan', postal: '60000' },
          payment: { method: 'cod' }, notes: ''
        });
        await loadCart();
      }
    }
    if (!state.cart.lines.length) await fill([['p1', 1], ['p5', 2], ['p9', 1]]);
    if (q.get('coupon')) await cartRequest('PUT', '/coupon', { code: q.get('coupon') });
  }

  /* ---------- 13. Boot --------------------------------------------------- */
  const domReady = new Promise((resolve) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve);
    else resolve();
  });

  /* Resolves true when the data is loaded and the layout is drawn, false if the API could not be reached. */
  const ready = (async () => {
    await domReady;
    try {
      await KGApi.init();
      await applyDemoMode();
      await Promise.all([loadCategories(), loadDelivery(), loadProducts(), loadReviews(), loadSummary(), loadCart(), loadUser()]);
      await loadOrders();
    } catch (err) {
      console.error(err);
      renderOffline(err);
      return false;
    }
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
    emit('kg:ready');
    return true;
  })();

  window.KG = {
    KEYS,
    fmt, escapeHTML, formatDate, safeNext, getProduct,
    getCart, cartLines, cartCount, addToCart, updateQty, removeItem, clearCart,
    getCoupon, applyCoupon, removeCoupon, totals,
    signup, login, logout, currentUser, emailAvailable,
    getReviews, addReview, productRating, ratingSummary, searchProducts,
    placeOrder, getOrders, cancelOrder,
    stars, art, toast, renderAuthArea, renderMiniCart,
    ready,
    /* Runs fn once the API data has loaded (never, if the API is unreachable). */
    whenReady(fn) { ready.then((ok) => { if (ok) fn(); }); }
  };
  /* Read-only views of the data loaded from the API (same names as in Lab 3). */
  Object.defineProperties(window.KG, {
    PRODUCTS: { get: () => state.products },
    CATEGORIES: { get: () => state.categories },
    DELIVERY: { get: () => state.delivery }
  });
})();
