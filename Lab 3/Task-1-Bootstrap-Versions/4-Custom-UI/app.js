/* ==========================================================================
   Nova Home (Lab 3, Bootstrap version) — small behaviour layer
   Bootstrap's own JS handles tabs, dropdown, modal, offcanvas and toasts.
   This file only:
     1. switches Bootstrap tooltips on
     2. keeps each device card in sync with its form-switch
     3. brightness slider + colour swatches for the ceiling lights
     4. thermostat +/- buttons
     5. music play / pause
     6. scenes and quick actions (with a toast)
     7. light / dark colour mode
   ========================================================================== */
(function () {
  'use strict';

  // 1. tooltips -------------------------------------------------------------
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function (el) {
    new bootstrap.Tooltip(el);
  });

  // toast helper
  var toastEl = document.getElementById('liveToast');
  var toast = bootstrap.Toast.getOrCreateInstance(toastEl);
  function notify(msg) {
    document.getElementById('toastBody').textContent = msg;
    toast.show();
  }

  // 2. device switches --------------------------------------------------------
  function syncCard(input) {
    var card = input.closest('.device');
    var status = card.querySelector('.status');
    card.classList.toggle('on', input.checked);
    status.textContent = input.checked ? status.dataset.on : status.dataset.off;
    updateCounts();
  }

  // badge on each room tab shows how many devices are on
  function updateCounts() {
    document.querySelectorAll('.count-badge').forEach(function (badge) {
      var pane = document.getElementById('pane-' + badge.dataset.room);
      badge.textContent = pane.querySelectorAll('.dev-toggle:checked').length;
    });
  }

  document.querySelectorAll('.dev-toggle').forEach(function (input) {
    input.addEventListener('change', function () { syncCard(input); });
  });

  function setDevice(id, on) {
    var input = document.getElementById(id);
    if (input && input.checked !== on) { input.checked = on; syncCard(input); }
  }
  function setKind(kind, on) {
    document.querySelectorAll('.device[data-kind="' + kind + '"] .dev-toggle').forEach(function (input) {
      if (input.checked !== on) { input.checked = on; syncCard(input); }
    });
  }

  // 3. ceiling lights: brightness + colour -----------------------------------
  var lightsCard = document.getElementById('lr-lights').closest('.device');
  var range = document.getElementById('brightness');
  var rangeVal = document.getElementById('brightnessVal');
  function applyBrightness() {
    rangeVal.textContent = range.value + '%';
    lightsCard.style.setProperty('--glow', (range.value / 100).toFixed(2));
    lightsCard.querySelector('p').textContent = '6 bulbs · ' + range.value + '% brightness';
  }
  range.addEventListener('input', applyBrightness);
  document.querySelectorAll('input[name="lightColour"]').forEach(function (r) {
    r.addEventListener('change', function () { lightsCard.style.setProperty('--dc', r.value); });
  });
  applyBrightness();

  // 4. thermostat ------------------------------------------------------------
  var ROOM_TEMP = 22, MIN = 16, MAX = 30;
  var temp = 22;
  var dial = document.getElementById('dial');
  function renderTemp() {
    document.getElementById('tempVal').textContent = temp;
    dial.style.setProperty('--val', temp);
    var mode = temp > ROOM_TEMP ? 'Heating to ' + temp + '°' : temp < ROOM_TEMP ? 'Cooling to ' + temp + '°' : 'Idle · Holding ' + temp + '°';
    document.getElementById('tempMode').textContent = mode;
    dial.dataset.mode = temp > ROOM_TEMP ? 'heat' : temp < ROOM_TEMP ? 'cool' : 'idle';
  }
  document.getElementById('tempUp').addEventListener('click', function () { if (temp < MAX) { temp++; renderTemp(); } });
  document.getElementById('tempDown').addEventListener('click', function () { if (temp > MIN) { temp--; renderTemp(); } });
  renderTemp();

  // 5. music player ------------------------------------------------------------
  var music = document.getElementById('music');
  var playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', function () {
    var playing = music.classList.toggle('playing');
    playBtn.innerHTML = playing ? '<i class="bi bi-pause-fill"></i>' : '<i class="bi bi-play-fill"></i>';
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  });

  // 6. scenes + quick actions ------------------------------------------------
  var SCENES = {
    morning: { label: 'Good Morning', on: ['lr-curtains', 'bd-curtains', 'kt-coffee', 'kt-lights'], off: ['bd-fan', 'lr-tv'] },
    movie:   { label: 'Movie Night', on: ['lr-tv', 'lr-ac'], off: ['lr-lights', 'lr-curtains'] },
    away:    { label: 'Away', on: ['lr-lock', 'kt-vacuum'], off: ['lr-tv', 'bd-tv', 'lr-speaker', 'st-speaker', 'st-plug', 'bd-fan', 'st-fan'] },
    sleep:   { label: 'Sleep', on: ['lr-lock', 'bd-ac'], off: ['lr-tv', 'bd-tv', 'lr-speaker', 'st-speaker', 'kt-lights', 'st-lamp', 'bd-lamp'] }
  };
  document.querySelectorAll('input[name="scene"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var s = SCENES[r.value];
      s.on.forEach(function (id) { setDevice(id, true); });
      s.off.forEach(function (id) { setDevice(id, false); });
      if (s.label === 'Away' || s.label === 'Sleep' || s.label === 'Movie Night') setKind('light', false);
      notify('“' + s.label + '” scene activated');
    });
  });

  document.querySelectorAll('.quick').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switch (btn.dataset.action) {
        case 'lock': setKind('lock', true); notify('All doors locked'); break;
        case 'lights-off': setKind('light', false); notify('All lights switched off'); break;
        case 'vacuum': setKind('vacuum', true); notify('Robot vacuum started in the kitchen'); break;
        case 'away': document.getElementById('scene-away').click(); break;
      }
      var oc = bootstrap.Offcanvas.getInstance(document.getElementById('activityPanel'));
      if (oc) oc.hide();
    });
  });

  // live clock inside the camera feeds
  function tick() {
    var t = new Date().toTimeString().slice(0, 8);
    document.querySelectorAll('.feed .clock').forEach(function (c) { c.textContent = t; });
  }
  tick();
  setInterval(tick, 1000);

  // 7. colour mode -------------------------------------------------------------
  var root = document.documentElement;
  var themeBtn = document.getElementById('themeToggle');
  function renderThemeIcon() {
    themeBtn.innerHTML = root.getAttribute('data-bs-theme') === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
  }
  themeBtn.addEventListener('click', function () {
    root.setAttribute('data-bs-theme', root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
    renderThemeIcon();
  });
  renderThemeIcon();

  updateCounts();
})();
