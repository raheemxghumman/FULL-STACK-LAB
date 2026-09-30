/* ==========================================================================
   Kashi Ghar — shop page (index.html)
   Product listing with filter / sort / search, quick-view modal,
   reviews summary, review cards and the write-a-review forms.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const { fmt, escapeHTML, stars, art, formatDate } = KG;

  const state = {
    category: 'all',
    sort: 'featured',
    query: new URLSearchParams(location.search).get('q') || '',
    showAllReviews: false,
    modalProduct: null
  };

  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('resultCount');
  const modalEl = document.getElementById('productModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  /* ---------- Product listing ------------------------------------------ */
  function filteredProducts() {
    const q = state.query.trim().toLowerCase();
    let list = KG.PRODUCTS.filter((p) => {
      if (state.category !== 'all' && p.category !== state.category) return false;
      if (!q) return true;
      const haystack = (p.name + ' ' + KG.CATEGORIES[p.category] + ' ' + p.description).toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
    const byRating = (p) => KG.productRating(p).avg;
    if (state.sort === 'price-asc') list = list.slice().sort((a, b) => a.price - b.price);
    if (state.sort === 'price-desc') list = list.slice().sort((a, b) => b.price - a.price);
    if (state.sort === 'rating') list = list.slice().sort((a, b) => byRating(b) - byRating(a));
    return list;
  }

  function cardHTML(p) {
    const r = KG.productRating(p);
    const sale = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `
      <div class="col">
        <article class="card product-card h-100">
          <div class="product-media" style="--thumb-bg:${p.bg}">
            ${sale ? `<span class="badge badge-sale">Sale −${sale}%</span>` : ''}
            <button type="button" class="btn-quick" data-quick="${p.id}" aria-label="Quick view: ${escapeHTML(p.name)}"><i class="bi bi-eye"></i></button>
            ${art(p)}
            ${p.stock <= 5 ? `<span class="badge text-bg-warning stock-note">Only ${p.stock} left</span>` : ''}
          </div>
          <div class="card-body d-flex flex-column">
            <span class="product-cat mb-1">${escapeHTML(KG.CATEGORIES[p.category])}</span>
            <h3 class="card-title mb-1"><a href="index.html?view=${p.id}" class="text-reset text-decoration-none" data-quick="${p.id}">${escapeHTML(p.name)}</a></h3>
            <div class="small mb-2">${stars(r.avg)} <span class="text-body-secondary">${r.avg} (${r.count})</span></div>
            <div class="mb-3">
              <span class="price">${fmt(p.price)}</span>
              ${p.oldPrice ? `<span class="price-old ms-1">${fmt(p.oldPrice)}</span>` : ''}
            </div>
            <div class="mt-auto d-flex gap-2">
              <button type="button" class="btn btn-primary btn-sm flex-grow-1" data-add="${p.id}"><i class="bi bi-bag-plus me-1"></i>Add to cart</button>
              <button type="button" class="btn btn-outline-primary btn-sm" data-quick="${p.id}" aria-label="Quick view: ${escapeHTML(p.name)}">View</button>
            </div>
          </div>
        </article>
      </div>`;
  }

  function renderGrid() {
    const list = filteredProducts();
    grid.innerHTML = list.map(cardHTML).join('');
    empty.classList.toggle('d-none', list.length > 0);
    document.getElementById('emptyQuery').textContent = state.query ? `“${state.query}”` : 'this filter';
    const label = state.category === 'all' ? 'all categories' : KG.CATEGORIES[state.category];
    count.textContent = `Showing ${list.length} of ${KG.PRODUCTS.length} products · ${label}` + (state.query ? ` · “${state.query}”` : '');
  }

  document.querySelectorAll('input[name="category"]').forEach((radio) => {
    radio.addEventListener('change', () => { state.category = radio.value; renderGrid(); });
  });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
  window.addEventListener('kg:search', (e) => { state.query = e.detail || ''; renderGrid(); });
  document.getElementById('resetFilters').addEventListener('click', () => {
    state.query = ''; state.category = 'all';
    document.getElementById('cat-all').checked = true;
    const s = document.getElementById('navSearch'); if (s) s.value = '';
    renderGrid();
  });

  /* Hero buttons that jump to a category. */
  document.querySelectorAll('[data-category-link]').forEach((a) => {
    a.addEventListener('click', () => {
      const radio = document.getElementById('cat-' + a.dataset.categoryLink);
      if (radio) { radio.checked = true; state.category = radio.value; renderGrid(); }
    });
  });

  /* ---------- Quick-view modal ----------------------------------------- */
  function reviewItemHTML(r, showProduct) {
    const p = KG.getProduct(r.productId);
    const initials = r.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="d-flex gap-3">
        <div class="review-avatar">${escapeHTML(initials)}</div>
        <div class="min-w-0">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <strong>${escapeHTML(r.name)}</strong>
            ${r.verified ? '<span class="badge text-bg-light border"><i class="bi bi-patch-check-fill text-success"></i> Verified buyer</span>' : ''}
          </div>
          <div class="small text-body-secondary">${stars(r.rating)} · ${formatDate(r.date)}${r.city ? ' · ' + escapeHTML(r.city) : ''}</div>
          ${showProduct && p ? `<a href="index.html?view=${p.id}" class="small" data-quick="${p.id}">${escapeHTML(p.name)}</a>` : ''}
          <p class="mb-0 mt-1">${escapeHTML(r.text)}</p>
        </div>
      </div>`;
  }

  function renderModal(p) {
    const r = KG.productRating(p);
    const reviews = KG.getReviews(p.id);
    const user = KG.currentUser();
    document.getElementById('productModalTitle').textContent = p.name;
    document.getElementById('productModalBody').innerHTML = `
      <div class="row g-4">
        <div class="col-md-5">
          <div class="modal-product-media" style="--thumb-bg:${p.bg}">${art(p)}</div>
        </div>
        <div class="col-md-7">
          <span class="product-cat">${escapeHTML(KG.CATEGORIES[p.category])}</span>
          <div class="my-2">${stars(r.avg)} <span class="text-body-secondary small">${r.avg} · ${r.count} reviews</span></div>
          <div class="mb-3">
            <span class="price fs-3">${fmt(p.price)}</span>
            ${p.oldPrice ? `<span class="price-old ms-2">${fmt(p.oldPrice)}</span> <span class="badge badge-sale ms-1">Save ${fmt(p.oldPrice - p.price)}</span>` : ''}
          </div>
          <p>${escapeHTML(p.description)}</p>
          <p class="small ${p.stock <= 5 ? 'text-terra fw-semibold' : 'text-body-secondary'}"><i class="bi bi-box-seam me-1"></i>${p.stock <= 5 ? `Only ${p.stock} left in stock` : `In stock (${p.stock} available)`}</p>

          <div class="d-flex flex-wrap gap-2 align-items-center mb-4">
            <div class="input-group qty-group" style="max-width: 150px">
              <button class="btn btn-outline-secondary" type="button" data-modal-step="-1" aria-label="Decrease quantity"><i class="bi bi-dash"></i></button>
              <input type="number" class="form-control" id="modalQty" value="1" min="1" max="${p.stock}" aria-label="Quantity">
              <button class="btn btn-outline-secondary" type="button" data-modal-step="1" aria-label="Increase quantity"><i class="bi bi-plus"></i></button>
            </div>
            <button type="button" class="btn btn-primary px-4" data-add="${p.id}" data-qty-input="#modalQty"><i class="bi bi-bag-plus me-1"></i>Add to cart</button>
          </div>

          <h3 class="h5">Reviews <span class="badge text-bg-light border">${reviews.length}</span></h3>
          <div class="modal-reviews vstack gap-3 mb-3 pe-2">
            ${reviews.length ? reviews.map((rv) => reviewItemHTML(rv, false)).join('<hr class="my-0">') : '<p class="text-body-secondary small mb-0">No written reviews yet. Be the first.</p>'}
          </div>

          <form class="border rounded-3 p-3 bg-body" id="modalReviewForm" novalidate>
            <h4 class="h6">Review this product</h4>
            <div class="btn-group rating-picker mb-2" role="group" aria-label="Star rating">
              ${[1, 2, 3, 4, 5].map((n) => `<input type="radio" class="btn-check" name="modalRating" id="mr${n}" value="${n}" ${n === 1 ? 'required' : ''}><label class="btn btn-sm btn-outline-warning" for="mr${n}">${n}★</label>`).join('')}
            </div>
            <div class="invalid-feedback mb-2" id="modalRatingFeedback">Pick a star rating.</div>
            <div class="row g-2">
              <div class="col-sm-4">
                <input type="text" class="form-control form-control-sm" id="modalReviewName" placeholder="Your name" aria-label="Your name" minlength="2" maxlength="40" required value="${user ? escapeHTML(user.name) : ''}">
                <div class="invalid-feedback">Enter your name.</div>
              </div>
              <div class="col-sm-8">
                <input type="text" class="form-control form-control-sm" id="modalReviewText" placeholder="What did you think?" aria-label="Your review" minlength="10" maxlength="500" required>
                <div class="invalid-feedback">At least 10 characters.</div>
              </div>
            </div>
            <button class="btn btn-terra btn-sm mt-2" type="submit">Post review</button>
          </form>
        </div>
      </div>`;
  }

  function openModal(id) {
    const p = KG.getProduct(id);
    if (!p) return;
    state.modalProduct = p;
    renderModal(p);
    modal.show();
  }
  modalEl.addEventListener('hidden.bs.modal', () => { state.modalProduct = null; });

  document.addEventListener('click', (e) => {
    const quick = e.target.closest('[data-quick]');
    if (quick) { e.preventDefault(); openModal(quick.dataset.quick); return; }
    const step = e.target.closest('[data-modal-step]');
    if (step) {
      const input = document.getElementById('modalQty');
      const max = parseInt(input.max, 10);
      const next = Math.min(max, Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(step.dataset.modalStep, 10)));
      input.value = next;
    }
  });

  /* Clamp a typed quantity to 1..stock. */
  modalEl.addEventListener('change', (e) => {
    if (e.target.id !== 'modalQty') return;
    const max = parseInt(e.target.max, 10);
    e.target.value = Math.min(max, Math.max(1, parseInt(e.target.value, 10) || 1));
  });

  /* Review form inside the modal. */
  modalEl.addEventListener('submit', (e) => {
    if (e.target.id !== 'modalReviewForm') return;
    e.preventDefault();
    const form = e.target;
    const rating = form.querySelector('input[name="modalRating"]:checked');
    document.getElementById('modalRatingFeedback').classList.toggle('d-block', !rating);
    form.classList.add('was-validated');
    if (!form.checkValidity() || !rating) return;
    const res = KG.addReview({
      productId: state.modalProduct.id, rating: rating.value,
      name: document.getElementById('modalReviewName').value,
      text: document.getElementById('modalReviewText').value
    });
    if (res.ok) KG.toast('Review posted', 'Thanks for sharing your experience.', 'success');
    else KG.toast('Review not posted', escapeHTML(res.msg), 'warning');
  });

  /* ---------- Reviews section ------------------------------------------ */
  function renderSummary() {
    const s = KG.ratingSummary();
    const bars = [5, 4, 3, 2, 1].map((n) => {
      const c = s.buckets[n] || 0;
      const pct = s.total ? Math.round((c / s.total) * 100) : 0;
      return `
        <div class="d-flex align-items-center gap-2 small mb-1">
          <span class="text-nowrap" style="width:2.2rem">${n} <i class="bi bi-star-fill text-warning"></i></span>
          <div class="progress flex-grow-1" role="progressbar" aria-label="${n} star reviews" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" style="height:8px">
            <div class="progress-bar" style="width:${pct}%; background:${n >= 4 ? 'var(--kg-cobalt)' : n === 3 ? 'var(--kg-turq)' : 'var(--kg-terra)'}"></div>
          </div>
          <span class="text-body-secondary text-end" style="width:2.6rem">${c.toLocaleString('en-US')}</span>
        </div>`;
    }).join('');
    document.getElementById('ratingSummary').innerHTML = `
      <div class="d-flex align-items-center gap-3 mb-3">
        <div class="rating-big">${s.avg.toFixed(1)}</div>
        <div>${stars(s.avg, 'fs-5')}<div class="small text-body-secondary">Based on ${s.total.toLocaleString('en-US')} reviews</div></div>
      </div>
      ${bars}
      <p class="small text-body-secondary mt-3 mb-0"><i class="bi bi-shield-check me-1"></i>Reviews marked “verified” come from customers with an account.</p>`;
  }

  function renderReviewList() {
    const all = KG.getReviews();
    const shown = state.showAllReviews ? all : all.slice(0, 6);
    document.getElementById('reviewList').innerHTML = shown.map((r) => `
      <div class="col"><div class="card review-card h-100 p-3">${reviewItemHTML(r, true)}</div></div>`).join('');
    const more = document.getElementById('moreReviews');
    more.classList.toggle('d-none', all.length <= 6);
    more.textContent = state.showAllReviews ? 'Show fewer reviews' : `Show all ${all.length} reviews`;
  }
  document.getElementById('moreReviews').addEventListener('click', () => {
    state.showAllReviews = !state.showAllReviews;
    renderReviewList();
  });

  /* Main write-a-review form. */
  const reviewForm = document.getElementById('reviewForm');
  const productSelect = document.getElementById('reviewProduct');
  productSelect.insertAdjacentHTML('beforeend',
    KG.PRODUCTS.map((p) => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join(''));

  function prefillName() {
    const user = KG.currentUser();
    const input = document.getElementById('reviewName');
    if (user && !input.value) input.value = user.name;
  }
  prefillName();

  reviewForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rating = reviewForm.querySelector('input[name="reviewRating"]:checked');
    document.getElementById('ratingFeedback').classList.toggle('d-block', !rating);
    reviewForm.classList.add('was-validated');
    if (!reviewForm.checkValidity() || !rating) return;
    const res = KG.addReview({
      productId: productSelect.value, rating: rating.value,
      name: document.getElementById('reviewName').value,
      text: document.getElementById('reviewText').value
    });
    if (!res.ok) { KG.toast('Review not posted', escapeHTML(res.msg), 'warning'); return; }
    reviewForm.reset();
    reviewForm.classList.remove('was-validated');
    prefillName();
    KG.toast('Review posted', 'Thanks! Your review is now at the top of the list.', 'success');
  });

  /* Any new review refreshes ratings everywhere on the page. */
  window.addEventListener('kg:reviews', () => {
    renderGrid();
    renderSummary();
    renderReviewList();
    if (state.modalProduct) renderModal(state.modalProduct);
  });
  window.addEventListener('kg:auth', prefillName);

  /* ---------- Initial render ------------------------------------------- */
  renderGrid();
  renderSummary();
  renderReviewList();

  /* Deep link: index.html?view=p3 opens that product. */
  const view = new URLSearchParams(location.search).get('view');
  if (view && KG.getProduct(view)) openModal(view);
});
