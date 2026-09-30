/* Facebook News Feed (Bootstrap version) — small behaviours on top of Bootstrap's own JS.
   Everything visual is Bootstrap components; this file only wires them together. */
(function () {
  'use strict';

  var root = document.documentElement;

  // ---- 1. Colour mode (Bootstrap 5.3 data-bs-theme) --------------------------
  function applyTheme(theme) {
    root.setAttribute('data-bs-theme', theme);
    try { localStorage.setItem('fb-theme', theme); } catch (e) {}
    var dark = theme === 'dark';
    document.querySelectorAll('.theme-label').forEach(function (el) {
      el.textContent = dark ? 'Light mode' : 'Dark mode';
    });
    var icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = dark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
  }
  function toggleTheme() {
    applyTheme(root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
  }
  document.querySelectorAll('#themeToggle, #themeToggleMenu, .js-theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', toggleTheme);
  });
  applyTheme(root.getAttribute('data-bs-theme') || 'light');

  // ---- 2. Tooltips (Bootstrap requires opt-in initialisation) ---------------
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
    new bootstrap.Tooltip(el);
  });

  // ---- 3. Toast for "Save post", "Share", "Report" --------------------------
  var toastEl = document.getElementById('fbToast');
  var toastMsg = document.getElementById('fbToastMsg');
  var toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2500 });
  function showToast(message) {
    toastMsg.textContent = message;
    toast.show();
  }
  document.querySelectorAll('.js-toast').forEach(function (btn) {
    btn.addEventListener('click', function () { showToast(btn.getAttribute('data-msg')); });
  });

  // ---- 4. Hide post (fade the card out, then remove it) ----------------------
  document.querySelectorAll('.js-hide-post').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.fb-post');
      card.classList.add('fb-hiding');
      setTimeout(function () { card.remove(); showToast('Post hidden from your feed.'); }, 250);
    });
  });

  // ---- 5. Like toggle (Bootstrap .btn-check) updates the reaction count ------
  function formatCount(n) {
    return n >= 1000 ? (Math.round(n / 100) / 10) + 'K' : String(n);
  }
  document.querySelectorAll('.js-like').forEach(function (input) {
    var post = input.closest('.fb-post');
    var counter = post.querySelector('.js-like-count');
    var base = parseInt(counter.getAttribute('data-base'), 10);
    // If the post starts liked, the base already includes this user's like.
    if (input.checked) base -= 1;
    function render() {
      counter.textContent = formatCount(base + (input.checked ? 1 : 0));
      var icon = post.querySelector('label[for="' + input.id + '"] i');
      icon.className = input.checked ? 'bi bi-hand-thumbs-up-fill me-1' : 'bi bi-hand-thumbs-up me-1';
    }
    input.addEventListener('change', render);
    render();
  });

  // ---- 6. "Comment" button focuses that post's comment box --------------------
  document.querySelectorAll('.js-focus-comment').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.querySelector(btn.getAttribute('data-target'));
      if (input) input.focus();
    });
  });

  // ---- 7. Create post modal: enable "Post" only when there is text ----------
  var postText = document.getElementById('postText');
  var publish = document.getElementById('publishPost');
  var postModalEl = document.getElementById('postModal');
  postText.addEventListener('input', function () {
    publish.disabled = postText.value.trim() === '';
  });
  postModalEl.addEventListener('shown.bs.modal', function () { postText.focus(); });
  publish.addEventListener('click', function () {
    bootstrap.Modal.getInstance(postModalEl).hide();
    postText.value = '';
    publish.disabled = true;
    showToast('Your post is now live.');
  });
})();
