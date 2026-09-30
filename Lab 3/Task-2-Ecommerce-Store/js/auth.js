/* ==========================================================================
   Kashi Ghar — login.html and signup.html
   Bootstrap validation (.was-validated) plus custom checks through
   setCustomValidity: phone format, password match, duplicate email.
   After success the user goes back to ?next= (only our own .html pages
   are allowed, see KG.safeNext) or to the home page.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const page = document.body.dataset.page;
  const params = new URLSearchParams(location.search);
  const next = KG.safeNext(params.get('next'), 'index.html');

  /* Keep ?next= when switching between the two pages. */
  const carry = params.get('next') ? '?next=' + encodeURIComponent(next) : '';
  const toSignup = document.getElementById('toSignup');
  const toLogin = document.getElementById('toLogin');
  if (toSignup) toSignup.href = 'signup.html' + carry;
  if (toLogin) toLogin.href = 'login.html' + carry;

  /* Show / hide password buttons */
  function wireToggle(btn, input) {
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.innerHTML = `<i class="bi ${show ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
    });
  }

  function setBusy(btn, busy) {
    btn.disabled = busy;
    btn.querySelector('.spinner-border').classList.toggle('d-none', !busy);
  }

  /* ======================= LOGIN ======================================= */
  if (page === 'login') {
    const form = document.getElementById('loginForm');
    const email = document.getElementById('loginEmail');
    const pass = document.getElementById('loginPassword');
    const error = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    wireToggle(document.getElementById('togglePassword'), pass);

    if (params.get('next')) {
      const notice = document.getElementById('nextNotice');
      notice.innerHTML = next.startsWith('checkout')
        ? '<i class="bi bi-lock me-1"></i>Please log in to continue to checkout. Your cart is saved.'
        : '<i class="bi bi-lock me-1"></i>Please log in to continue.';
      notice.classList.remove('d-none');
    }

    const user = KG.currentUser();
    if (user) {
      const already = document.getElementById('alreadyIn');
      already.innerHTML = `You are already logged in as <strong>${KG.escapeHTML(user.email)}</strong>. <a href="${next}">Continue</a>`;
      already.classList.remove('d-none');
    }

    document.getElementById('forgotLink').addEventListener('click', (e) => {
      e.preventDefault();
      KG.toast('Password reset', 'In this demo store, create a new account or use the demo login shown below.', 'info');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.classList.add('d-none');
      form.classList.add('was-validated');
      if (!form.checkValidity()) return;
      setBusy(btn, true);
      const res = await KG.login(email.value, pass.value, document.getElementById('rememberMe').checked);
      setBusy(btn, false);
      if (!res.ok) {
        error.innerHTML = `<i class="bi bi-exclamation-octagon me-1"></i>${KG.escapeHTML(res.msg)}`;
        error.classList.remove('d-none');
        pass.value = '';
        form.classList.remove('was-validated');
        pass.focus();
        return;
      }
      location.href = next;
    });
  }

  /* ======================= SIGNUP ====================================== */
  if (page === 'signup') {
    const form = document.getElementById('signupForm');
    const f = {
      name: document.getElementById('suName'),
      email: document.getElementById('suEmail'),
      phone: document.getElementById('suPhone'),
      pass: document.getElementById('suPassword'),
      confirm: document.getElementById('suConfirm'),
      city: document.getElementById('suCity'),
      terms: document.getElementById('suTerms')
    };
    const btn = document.getElementById('signupBtn');
    const error = document.getElementById('signupError');
    document.querySelectorAll('[data-toggle-pass]').forEach((b) => wireToggle(b, document.getElementById(b.dataset.togglePass)));

    const PHONE_RE = /^(\+92|0)3\d{9}$/;   // 03XXXXXXXXX or +923XXXXXXXXX
    const emailFeedback = document.getElementById('suEmailFeedback');

    function checkPhone() {
      const clean = f.phone.value.replace(/[\s-]/g, '');
      f.phone.setCustomValidity(PHONE_RE.test(clean) ? '' : 'invalid');
    }
    function checkConfirm() {
      f.confirm.setCustomValidity(f.confirm.value && f.confirm.value === f.pass.value ? '' : 'mismatch');
    }
    function checkEmailFree() {
      const taken = JSON.parse(localStorage.getItem(KG.KEYS.users) || '[]')
        .some((u) => u.email === f.email.value.trim().toLowerCase());
      f.email.setCustomValidity(taken ? 'taken' : '');
      emailFeedback.textContent = taken ? 'An account with this email already exists. Log in instead.' : 'Enter a valid email address.';
    }

    /* Password strength meter (length, cases, digit, symbol). */
    function strength(pw) {
      let score = 0;
      if (pw.length >= 8) score++;
      if (pw.length >= 12) score++;
      if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
      if (/\d/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      return score;
    }
    function renderStrength() {
      const s = strength(f.pass.value);
      const levels = [
        { pct: 0, cls: '', label: 'Use 8+ characters with a mix of letters, numbers and symbols.' },
        { pct: 20, cls: 'bg-danger', label: 'Weak' },
        { pct: 40, cls: 'bg-danger', label: 'Weak' },
        { pct: 60, cls: 'bg-warning', label: 'Fair' },
        { pct: 80, cls: 'bg-info', label: 'Good' },
        { pct: 100, cls: 'bg-success', label: 'Strong' }
      ];
      const lv = f.pass.value ? levels[Math.max(1, s)] : levels[0];
      const bar = document.querySelector('#strengthBar .progress-bar');
      bar.className = 'progress-bar ' + lv.cls;
      bar.style.width = lv.pct + '%';
      document.getElementById('strengthBar').setAttribute('aria-valuenow', lv.pct);
      document.getElementById('strengthText').textContent = f.pass.value ? 'Strength: ' + lv.label : lv.label;
    }

    f.phone.addEventListener('input', checkPhone);
    f.pass.addEventListener('input', () => { renderStrength(); checkConfirm(); });
    f.confirm.addEventListener('input', checkConfirm);
    f.email.addEventListener('input', checkEmailFree);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.classList.add('d-none');
      checkPhone(); checkConfirm(); checkEmailFree();
      form.classList.add('was-validated');
      if (!form.checkValidity()) {
        const firstBad = form.querySelector(':invalid');
        if (firstBad) firstBad.focus();
        return;
      }
      setBusy(btn, true);
      const res = await KG.signup({
        name: f.name.value, email: f.email.value, phone: f.phone.value.replace(/[\s-]/g, ''),
        password: f.pass.value, city: f.city.value
      });
      setBusy(btn, false);
      if (!res.ok) {
        error.textContent = res.msg;
        error.classList.remove('d-none');
        return;
      }
      location.href = next + (next.includes('?') || next.includes('#') ? '' : '?welcome=1');
    });
  }
});
