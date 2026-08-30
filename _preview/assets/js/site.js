/* ============================================================
   Site chrome: theme toggle, sticky nav, mobile menu, filters.
   No animation, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- theme toggle ---------- */
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ---------- hairline under the nav once you scroll ---------- */
  var nav = document.getElementById('nav');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      if (nav) nav.classList.toggle('is-stuck', (window.scrollY || window.pageYOffset) > 8);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var burger = document.getElementById('nav-burger');
  var mobile = document.getElementById('nav-mobile');
  if (burger && mobile) {
    burger.addEventListener('click', function () {
      var open = mobile.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  /* ---------- domain filters (Projects page) ---------- */
  var chips = document.querySelectorAll('.chip[data-filter]');
  if (chips.length) {
    var items = document.querySelectorAll('[data-domains]');
    var empty = document.querySelector('.filter-empty');

    function apply(f, push) {
      var found = false;
      chips.forEach(function (c) {
        var on = c.getAttribute('data-filter') === f;
        if (on) found = true;
        c.setAttribute('aria-pressed', String(on));
      });
      if (!found) return apply('all', push);

      var shown = 0;
      items.forEach(function (el) {
        var match = f === 'all' || (el.getAttribute('data-domains') || '').indexOf(f) > -1;
        el.classList.toggle('is-filtered', !match);
        if (match) shown++;
      });
      if (empty) empty.classList.toggle('is-shown', shown === 0);

      if (push && history.replaceState) {
        history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f);
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        apply(chip.getAttribute('data-filter'), true);
      });
    });

    // deep links such as /projects/#slam
    if (location.hash.length > 1) apply(location.hash.slice(1).toLowerCase(), false);
    window.addEventListener('hashchange', function () {
      apply(location.hash.slice(1).toLowerCase() || 'all', false);
    });
  }

  /* ---------- misc ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
