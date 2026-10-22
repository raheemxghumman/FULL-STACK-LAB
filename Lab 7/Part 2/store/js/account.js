/* ==========================================================================
   Kashi Ghar — account page (account.html)
   Profile card + order history in a Bootstrap accordion.
   ?order=KG-2026-XXXX opens (and highlights) that order.
   Lab 7: orders come from GET /api/orders, and an order that is still
   processing can be cancelled (PATCH /api/orders/:id), which puts its items
   back in stock.
   ========================================================================== */
(function () {
  'use strict';
  KG.whenReady(() => {
    if (!KG.currentUser()) { location.replace('login.html?next=account.html'); return; }
    const { fmt, escapeHTML, formatDate } = KG;
    let openId = new URLSearchParams(location.search).get('order');
    const statusClass = { Processing: 'text-bg-warning', Shipped: 'text-bg-info', Delivered: 'text-bg-success', Cancelled: 'text-bg-secondary' };

    function render() {
      const user = KG.currentUser();
      const orders = KG.getOrders();
      const active = orders.filter((o) => o.status !== 'Cancelled');

      const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const spent = active.reduce((s, o) => s + o.total, 0);
      document.getElementById('profileCard').innerHTML = `
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="avatar-lg">${escapeHTML(initials)}</div>
          <div class="min-w-0">
            <h2 class="h5 mb-0">${escapeHTML(user.name)}</h2>
            <div class="small text-body-secondary text-truncate">${escapeHTML(user.email)}</div>
          </div>
        </div>
        <ul class="list-group list-group-flush small mb-3">
          <li class="list-group-item px-0 d-flex justify-content-between"><span class="text-body-secondary">Mobile</span><span>${escapeHTML(user.phone || '—')}</span></li>
          <li class="list-group-item px-0 d-flex justify-content-between"><span class="text-body-secondary">City</span><span>${escapeHTML(user.city || '—')}</span></li>
          <li class="list-group-item px-0 d-flex justify-content-between"><span class="text-body-secondary">Member since</span><span>${user.created ? formatDate(user.created) : '—'}</span></li>
          <li class="list-group-item px-0 d-flex justify-content-between"><span class="text-body-secondary">Orders</span><span>${orders.length}</span></li>
          <li class="list-group-item px-0 d-flex justify-content-between"><span class="text-body-secondary">Total spent</span><span class="fw-semibold">${fmt(spent)}</span></li>
        </ul>
        <div class="d-grid gap-2">
          <a href="cart.html" class="btn btn-outline-primary"><i class="bi bi-bag me-1"></i>My cart</a>
          <button type="button" class="btn btn-outline-danger" data-logout><i class="bi bi-box-arrow-right me-1"></i>Log out</button>
        </div>`;

      document.getElementById('orderCount').textContent = `${orders.length} order${orders.length === 1 ? '' : 's'}`;
      document.getElementById('noOrders').classList.toggle('d-none', orders.length > 0);

      document.getElementById('ordersAccordion').innerHTML = orders.map((o, i) => {
        const open = openId ? o.id === openId : i === 0;
        const payment = o.payment.method === 'card' ? `Card ending ${escapeHTML(o.payment.last4)}`
          : o.payment.method === 'wallet' ? `${escapeHTML(o.payment.label)} (${escapeHTML(o.payment.account || '')})` : 'Cash on Delivery';
        return `
          <div class="accordion-item${o.id === openId ? ' border-primary' : ''}">
            <h3 class="accordion-header">
              <button class="accordion-button${open ? '' : ' collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#order-${i}" aria-expanded="${open}" aria-controls="order-${i}">
                <span class="d-flex flex-wrap gap-2 align-items-center w-100 me-3">
                  <strong>${escapeHTML(o.id)}</strong>
                  <span class="text-body-secondary small">${formatDate(o.date)}</span>
                  <span class="badge ${statusClass[o.status] || 'text-bg-secondary'}">${escapeHTML(o.status)}</span>
                  <span class="ms-auto fw-semibold${o.status === 'Cancelled' ? ' text-decoration-line-through text-body-secondary' : ''}">${fmt(o.total)}</span>
                </span>
              </button>
            </h3>
            <div id="order-${i}" class="accordion-collapse collapse${open ? ' show' : ''}" data-bs-parent="#ordersAccordion">
              <div class="accordion-body">
                <div class="table-responsive">
                  <table class="table table-sm align-middle">
                    <thead><tr><th>Item</th><th class="text-center">Qty</th><th class="text-end">Price</th><th class="text-end">Total</th></tr></thead>
                    <tbody>
                      ${o.items.map((it) => `<tr><td>${escapeHTML(it.name)}</td><td class="text-center">${it.qty}</td><td class="text-end">${fmt(it.price)}</td><td class="text-end">${fmt(it.price * it.qty)}</td></tr>`).join('')}
                    </tbody>
                    <tfoot class="small">
                      <tr><td colspan="3" class="text-end">Subtotal</td><td class="text-end">${fmt(o.subtotal)}</td></tr>
                      ${o.discount ? `<tr class="text-success"><td colspan="3" class="text-end">Discount${o.coupon ? ' (' + escapeHTML(o.coupon) + ')' : ''}</td><td class="text-end">− ${fmt(o.discount)}</td></tr>` : ''}
                      <tr><td colspan="3" class="text-end">Delivery (${escapeHTML(o.deliveryMethod)})</td><td class="text-end">${o.delivery ? fmt(o.delivery) : 'Free'}</td></tr>
                      <tr class="fw-bold"><td colspan="3" class="text-end">Total</td><td class="text-end">${fmt(o.total)}</td></tr>
                    </tfoot>
                  </table>
                </div>
                <div class="row g-3 small">
                  <div class="col-sm-6"><div class="text-body-secondary">Ship to</div>${escapeHTML(o.contact.name || user.name)}<br>${escapeHTML(o.shipping.address || '')}${o.shipping.area ? ', ' + escapeHTML(o.shipping.area) : ''}<br>${escapeHTML(o.shipping.city || '')} ${escapeHTML(o.shipping.postal || '')}</div>
                  <div class="col-sm-6"><div class="text-body-secondary">Payment</div>${payment}<div class="text-body-secondary mt-2">Delivery estimate</div>${escapeHTML(o.eta)}</div>
                  ${o.notes ? `<div class="col-12"><div class="text-body-secondary">Notes</div>${escapeHTML(o.notes)}</div>` : ''}
                </div>
                ${o.status === 'Processing' ? `
                  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 border-top mt-3 pt-3">
                    <span class="small text-body-secondary"><i class="bi bi-info-circle me-1"></i>You can cancel until the order is shipped.</span>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-cancel="${escapeHTML(o.id)}"><i class="bi bi-x-circle me-1"></i>Cancel order</button>
                  </div>` : ''}
              </div>
            </div>
          </div>`;
      }).join('');
    }

    document.getElementById('ordersAccordion').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-cancel]');
      if (!btn) return;
      if (!confirm(`Cancel order ${btn.dataset.cancel}? The items go back into stock.`)) return;
      btn.disabled = true;
      const res = await KG.cancelOrder(btn.dataset.cancel);
      if (!res.ok) { btn.disabled = false; KG.toast('Not cancelled', escapeHTML(res.msg), 'warning'); return; }
      openId = btn.dataset.cancel;
      KG.toast('Order cancelled', escapeHTML(res.msg), 'info');
      render();
    });

    render();
  });
})();
