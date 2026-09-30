/* ==========================================================================
   Kashi Ghar — cart page (cart.html)
   DISPLAY CART: table on desktop, stacked list on phones, order summary.
   EDIT CART:    +/− buttons, typed quantity (validated 1..stock),
                 remove with confirm modal, clear cart, coupon codes.
   Every change goes through KG (app.js), which saves to localStorage and
   fires 'kg:cart'; this page simply re-renders on that event.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const { fmt, escapeHTML, art } = KG;

  const confirmModalEl = document.getElementById('confirmModal');
  const confirmModal = bootstrap.Modal.getOrCreateInstance(confirmModalEl);
  let pendingAction = null;

  function qtyControl(l, idSuffix) {
    const inputId = `qty-${l.id}-${idSuffix}`;
    return `
      <div class="input-group input-group-sm qty-group has-validation">
        <button class="btn btn-outline-secondary" type="button" data-step="-1" data-id="${l.id}" ${l.qty <= 1 ? 'disabled' : ''} aria-label="Decrease quantity"><i class="bi bi-dash"></i></button>
        <input type="number" class="form-control" id="${inputId}" value="${l.qty}" min="1" max="${l.product.stock}" data-qty="${l.id}" aria-label="Quantity of ${escapeHTML(l.product.name)}">
        <button class="btn btn-outline-secondary" type="button" data-step="1" data-id="${l.id}" ${l.qty >= l.product.stock ? 'disabled' : ''} aria-label="Increase quantity"><i class="bi bi-plus"></i></button>
        <div class="invalid-feedback">1 to ${l.product.stock} only</div>
      </div>`;
  }

  function render() {
    const lines = KG.cartLines();
    const t = KG.totals();
    document.getElementById('cartHeadCount').textContent = `${t.count} item${t.count === 1 ? '' : 's'}`;
    document.getElementById('cartEmpty').classList.toggle('d-none', lines.length > 0);
    document.getElementById('cartContent').classList.toggle('d-none', lines.length === 0);
    if (!lines.length) return;

    /* Table rows (md and up) */
    document.getElementById('cartTableBody').innerHTML = lines.map((l) => `
      <tr>
        <td class="ps-4">
          <div class="d-flex align-items-center gap-3">
            <div class="thumb thumb-md" style="--thumb-bg:${l.product.bg}">${art(l.product)}</div>
            <div>
              <a href="index.html?view=${l.id}" class="fw-semibold text-reset text-decoration-none">${escapeHTML(l.product.name)}</a>
              <div class="small text-body-secondary">${escapeHTML(KG.CATEGORIES[l.product.category])} · ${l.product.stock} in stock</div>
            </div>
          </div>
        </td>
        <td>${fmt(l.product.price)}</td>
        <td>${qtyControl(l, 'd')}</td>
        <td class="text-end fw-semibold">${fmt(l.lineTotal)}</td>
        <td class="pe-4 text-end">
          <button type="button" class="btn btn-sm btn-outline-danger" data-remove="${l.id}" aria-label="Remove ${escapeHTML(l.product.name)}"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`).join('');

    /* Stacked list (phones) */
    document.getElementById('cartListMobile').innerHTML = lines.map((l) => `
      <li class="list-group-item py-3">
        <div class="d-flex gap-3">
          <div class="thumb thumb-md" style="--thumb-bg:${l.product.bg}">${art(l.product)}</div>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between gap-2">
              <a href="index.html?view=${l.id}" class="fw-semibold text-reset text-decoration-none">${escapeHTML(l.product.name)}</a>
              <button type="button" class="btn btn-sm btn-link text-danger p-0" data-remove="${l.id}" aria-label="Remove ${escapeHTML(l.product.name)}"><i class="bi bi-trash3"></i></button>
            </div>
            <div class="small text-body-secondary mb-2">${fmt(l.product.price)} each</div>
            <div class="d-flex justify-content-between align-items-center">
              ${qtyControl(l, 'm')}
              <strong>${fmt(l.lineTotal)}</strong>
            </div>
          </div>
        </div>
      </li>`).join('');

    renderSummary(t);
  }

  function renderSummary(t) {
    const applied = document.getElementById('couponApplied');
    if (t.coupon) {
      applied.innerHTML = `
        <div class="alert ${t.couponInactive ? 'alert-warning' : 'alert-success'} d-flex justify-content-between align-items-center py-2 small">
          <span><i class="bi bi-ticket-perforated me-1"></i><strong>${escapeHTML(t.coupon)}</strong> · ${t.couponInactive ? 'needs a bigger subtotal to apply' : escapeHTML(t.couponLabel)}</span>
          <button type="button" class="btn-close btn-sm" id="removeCoupon" aria-label="Remove coupon"></button>
        </div>`;
    } else {
      applied.innerHTML = '';
    }
    document.getElementById('summaryRows').innerHTML = `
      <div class="summary-row"><span>Subtotal (${t.count} items)</span><span>${fmt(t.subtotal)}</span></div>
      ${t.discount ? `<div class="summary-row text-success"><span>Discount (${escapeHTML(t.coupon)})</span><span>− ${fmt(t.discount)}</span></div>` : ''}
      <div class="summary-row"><span>Standard delivery</span><span>${t.delivery ? fmt(t.delivery) : '<span class="text-success fw-semibold">Free</span>'}</span></div>
      <hr>
      <div class="summary-row align-items-center"><span class="fw-semibold">Total</span><span class="summary-total">${fmt(t.total)}</span></div>`;

    const pct = Math.min(100, Math.round((t.subtotal / KG.DELIVERY.standard.freeOver) * 100));
    document.getElementById('freeDelivery').innerHTML = `
      <div class="small mb-1">${t.freeDeliveryGap > 0
        ? `Add <strong>${fmt(t.freeDeliveryGap)}</strong> more for free delivery.`
        : '<i class="bi bi-truck text-success me-1"></i>Free standard delivery unlocked.'}</div>
      <div class="progress" role="progressbar" aria-label="Progress to free delivery" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" style="height:6px">
        <div class="progress-bar ${pct >= 100 ? 'bg-success' : ''}" style="width:${pct}%"></div>
      </div>`;

    document.getElementById('loginHint').innerHTML = KG.currentUser()
      ? '<i class="bi bi-lock me-1"></i>Secure checkout · Cash on Delivery available'
      : 'You will be asked to <a href="login.html?next=checkout.html">log in</a> before paying.';
  }

  /* ---------- Edit actions --------------------------------------------- */
  document.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const line = KG.getCart().find((l) => l.id === step.dataset.id);
      if (line) KG.updateQty(line.id, line.qty + parseInt(step.dataset.step, 10));
      return;
    }
    const remove = e.target.closest('[data-remove]');
    if (remove) {
      const p = KG.getProduct(remove.dataset.remove);
      askConfirm('Remove item?', `Remove <strong>${escapeHTML(p.name)}</strong> from your cart?`, 'Remove', () => {
        KG.removeItem(p.id);
        KG.toast('Removed', `${escapeHTML(p.name)} was removed from your cart.`, 'info');
      });
      return;
    }
    if (e.target.closest('#removeCoupon')) { KG.removeCoupon(); return; }
  });

  /* Typed quantity: validate before saving. */
  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-qty]');
    if (!input) return;
    const res = KG.updateQty(input.dataset.qty, input.value);
    if (!res.ok) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  });
  document.addEventListener('input', (e) => {
    const input = e.target.closest('[data-qty]');
    if (input) { input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid'); }
  });

  document.getElementById('clearCartBtn').addEventListener('click', () => {
    askConfirm('Clear your cart?', 'This removes every item and any coupon from your cart.', 'Clear cart', () => {
      KG.clearCart();
      KG.toast('Cart cleared', 'Your cart is now empty.', 'info');
    });
  });

  /* Coupon form */
  document.getElementById('couponForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('couponInput');
    const res = KG.applyCoupon(input.value);
    const fb = document.getElementById('couponFeedback');
    if (res.ok) {
      input.classList.remove('is-invalid');
      input.value = '';
      KG.toast('Coupon applied', escapeHTML(res.msg), 'success');
    } else {
      fb.textContent = res.msg;
      input.classList.add('is-invalid');
    }
  });
  document.getElementById('couponInput').addEventListener('input', (e) => e.target.classList.remove('is-invalid'));

  /* ---------- Confirm modal helper ------------------------------------- */
  function askConfirm(title, bodyHTML, yesLabel, action) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmBody').innerHTML = bodyHTML;
    document.getElementById('confirmYes').textContent = yesLabel;
    pendingAction = action;
    confirmModal.show();
  }
  document.getElementById('confirmYes').addEventListener('click', () => {
    confirmModal.hide();
    if (pendingAction) pendingAction();
    pendingAction = null;
  });

  window.addEventListener('kg:cart', render);
  window.addEventListener('kg:auth', render);
  render();
});
