/* ==========================================================================
   Kashi Ghar — checkout page (checkout.html)
   - Requires a logged-in user (otherwise -> login.html?next=checkout.html)
   - Requires a non-empty cart (otherwise -> cart.html)
   - Validates contact, address, delivery and payment with Bootstrap
     validation + custom rules (phone, Luhn card check, expiry date)
   - Places the order through KG.placeOrder and shows a success modal
   Card numbers and CVCs are NEVER stored; only the last 4 digits are kept.
   ========================================================================== */
(function () {
  'use strict';
  /* Guard runs before anything renders so the page never flashes. */
  if (!KG.currentUser()) { location.replace('login.html?next=checkout.html'); return; }
  if (!KG.getCart().length) { location.replace('cart.html'); return; }

  document.addEventListener('DOMContentLoaded', () => {
    const { fmt, escapeHTML, art } = KG;
    const user = KG.currentUser();
    const form = document.getElementById('checkoutForm');
    let orderPlaced = false;

    /* ---------- Prefill from the account -------------------------------- */
    document.getElementById('coName').value = user.name || '';
    document.getElementById('coEmail').value = user.email || '';
    document.getElementById('coPhone').value = user.phone || '';
    if (user.city) document.getElementById('coCity').value = user.city;
    document.getElementById('walletNumber').value = user.phone || '';

    const deliveryMethod = () => form.querySelector('input[name="delivery"]:checked').value;
    const paymentMethod = () => form.querySelector('input[name="payment"]:checked').value;

    /* ---------- Order summary ------------------------------------------ */
    function renderSummary() {
      if (orderPlaced) return;
      const lines = KG.cartLines();
      if (!lines.length) { location.replace('cart.html'); return; }
      const t = KG.totals(deliveryMethod());
      document.getElementById('coItems').innerHTML = lines.map((l) => `
        <li class="d-flex align-items-center gap-3">
          <div class="position-relative">
            <div class="thumb thumb-sm" style="--thumb-bg:${l.product.bg}">${art(l.product)}</div>
            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-secondary">${l.qty}</span>
          </div>
          <div class="flex-grow-1 min-w-0 small"><div class="fw-semibold text-truncate">${escapeHTML(l.product.name)}</div><div class="text-body-secondary">${fmt(l.product.price)} × ${l.qty}</div></div>
          <div class="fw-semibold small text-nowrap">${fmt(l.lineTotal)}</div>
        </li>`).join('');

      document.getElementById('coCouponApplied').innerHTML = t.coupon ? `
        <div class="d-flex justify-content-between align-items-center small ${t.couponInactive ? 'text-warning-emphasis' : 'text-success'}">
          <span><i class="bi bi-ticket-perforated me-1"></i>${escapeHTML(t.coupon)} · ${t.couponInactive ? 'not active for this subtotal' : escapeHTML(t.couponLabel)}</span>
          <button type="button" class="btn btn-link btn-sm p-0 text-danger" id="coRemoveCoupon">Remove</button>
        </div>` : '';

      document.getElementById('stdPrice').textContent = t.subtotal >= KG.DELIVERY.standard.freeOver ? 'Free' : fmt(KG.DELIVERY.standard.fee);
      document.getElementById('coTotals').innerHTML = `
        <div class="summary-row"><span>Subtotal</span><span>${fmt(t.subtotal)}</span></div>
        ${t.discount ? `<div class="summary-row text-success"><span>Discount</span><span>− ${fmt(t.discount)}</span></div>` : ''}
        <div class="summary-row"><span>${escapeHTML(KG.DELIVERY[t.method].label)}</span><span>${t.delivery ? fmt(t.delivery) : '<span class="text-success fw-semibold">Free</span>'}</span></div>
        <div class="summary-row align-items-center mt-2"><span class="fw-semibold">Total</span><span class="summary-total">${fmt(t.total)}</span></div>`;
      document.querySelector('#placeOrderBtn .btn-label').textContent = `Place order · ${fmt(t.total)}`;
    }

    form.querySelectorAll('input[name="delivery"]').forEach((r) => r.addEventListener('change', renderSummary));

    /* Coupon inside the summary */
    document.getElementById('coApply').addEventListener('click', () => {
      const input = document.getElementById('coCoupon');
      const res = KG.applyCoupon(input.value);
      if (res.ok) { input.value = ''; input.classList.remove('is-invalid'); KG.toast('Coupon applied', escapeHTML(res.msg), 'success'); }
      else { document.getElementById('coCouponFeedback').textContent = res.msg; input.classList.add('is-invalid'); }
    });
    document.getElementById('coCoupon').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('coApply').click(); }
    });
    document.addEventListener('click', (e) => { if (e.target.id === 'coRemoveCoupon') KG.removeCoupon(); });

    /* ---------- Payment method panels (Bootstrap collapse) -------------- */
    const panels = {
      wallet: { collapse: document.getElementById('walletFields'), fieldset: document.getElementById('walletFieldset') },
      card: { collapse: document.getElementById('cardFields'), fieldset: document.getElementById('cardFieldset') }
    };
    function syncPayment() {
      const m = paymentMethod();
      Object.entries(panels).forEach(([key, p]) => {
        const open = key === m;
        p.fieldset.disabled = !open;          // disabled fields are skipped by validation
        bootstrap.Collapse.getOrCreateInstance(p.collapse, { toggle: false })[open ? 'show' : 'hide']();
      });
    }
    form.querySelectorAll('input[name="payment"]').forEach((r) => r.addEventListener('change', syncPayment));

    /* ---------- Custom validation rules --------------------------------- */
    const PHONE_RE = /^(\+92|0)3\d{9}$/;
    const cleanPhone = (v) => v.replace(/[\s-]/g, '');

    function luhn(num) {
      let sum = 0, dbl = false;
      for (let i = num.length - 1; i >= 0; i--) {
        let d = parseInt(num[i], 10);
        if (dbl) { d *= 2; if (d > 9) d -= 9; }
        sum += d; dbl = !dbl;
      }
      return sum % 10 === 0;
    }
    function expiryOk(v) {
      const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);
      if (!m) return false;
      const now = new Date();
      const year = 2000 + parseInt(m[2], 10), month = parseInt(m[1], 10);
      return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
    }

    const phone = document.getElementById('coPhone');
    const wallet = document.getElementById('walletNumber');
    const cardNumber = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiry');

    function runCustomChecks() {
      phone.setCustomValidity(PHONE_RE.test(cleanPhone(phone.value)) ? '' : 'phone');
      wallet.setCustomValidity(/^03\d{9}$/.test(cleanPhone(wallet.value)) ? '' : 'wallet');
      const digits = cardNumber.value.replace(/\s/g, '');
      cardNumber.setCustomValidity(/^\d{16}$/.test(digits) && luhn(digits) ? '' : 'card');
      cardExpiry.setCustomValidity(expiryOk(cardExpiry.value) ? '' : 'expiry');
    }
    [phone, wallet, cardNumber, cardExpiry].forEach((el) => el.addEventListener('input', runCustomChecks));

    /* Auto-format: "4242424242424242" -> "4242 4242 4242 4242", "0928" -> "09/28" */
    cardNumber.addEventListener('input', () => {
      const digits = cardNumber.value.replace(/\D/g, '').slice(0, 16);
      cardNumber.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
      runCustomChecks();
    });
    cardExpiry.addEventListener('input', (e) => {
      let d = cardExpiry.value.replace(/\D/g, '').slice(0, 4);
      if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2);
      if (e.inputType !== 'deleteContentBackward') cardExpiry.value = d;
      runCustomChecks();
    });

    /* ---------- Place order -------------------------------------------- */
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      runCustomChecks();
      form.classList.add('was-validated');
      if (!form.checkValidity()) {
        const firstBad = form.querySelector(':invalid:not(fieldset)');
        if (firstBad) { firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstBad.focus({ preventScroll: true }); }
        KG.toast('Check your details', 'Some fields need attention before we can place the order.', 'warning');
        return;
      }

      const method = paymentMethod();
      const payment = { method };
      if (method === 'cod') payment.label = 'Cash on Delivery';
      if (method === 'wallet') { payment.label = document.getElementById('walletProvider').value; payment.account = cleanPhone(wallet.value).replace(/^(\d{4})\d+(\d{3})$/, '$1****$2'); }
      if (method === 'card') { payment.label = 'Card'; payment.last4 = cardNumber.value.replace(/\s/g, '').slice(-4); }

      const btn = document.getElementById('placeOrderBtn');
      btn.disabled = true;
      btn.querySelector('.spinner-border').classList.remove('d-none');

      /* Short pause to feel like a payment step, then save the order. */
      setTimeout(() => {
        orderPlaced = true;
        const res = KG.placeOrder({
          deliveryMethod: deliveryMethod(),
          contact: { name: document.getElementById('coName').value.trim(), email: document.getElementById('coEmail').value.trim(), phone: cleanPhone(phone.value) },
          shipping: {
            address: document.getElementById('coAddress').value.trim(),
            area: document.getElementById('coArea').value.trim(),
            city: document.getElementById('coCity').value,
            postal: document.getElementById('coPostal').value.trim()
          },
          notes: document.getElementById('coNotes').value.trim(),
          payment
        });
        btn.querySelector('.spinner-border').classList.add('d-none');
        if (!res.ok) {
          orderPlaced = false; btn.disabled = false;
          KG.toast('Order not placed', escapeHTML(res.msg), 'danger');
          return;
        }
        const o = res.order;
        document.getElementById('successOrderId').textContent = o.id;
        document.getElementById('viewOrderLink').href = 'account.html?order=' + encodeURIComponent(o.id);
        const payText = method === 'cod' ? `Please keep ${fmt(o.total)} ready for the rider.`
          : method === 'wallet' ? `A ${payment.label} request for ${fmt(o.total)} has been sent to ${payment.account}.`
          : `${fmt(o.total)} was charged to the card ending ${payment.last4}.`;
        document.getElementById('successText').textContent =
          `${payText} Expected delivery: ${o.eta}. A confirmation was sent to ${o.contact.email}.`;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('successModal')).show();
      }, 700);
    });

    window.addEventListener('kg:cart', renderSummary);
    renderSummary();
    syncPayment();
  });
})();
