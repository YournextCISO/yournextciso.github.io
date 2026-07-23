/* ==============================================
   YournextCISO Portfolio — Navigation & UI
   ============================================== */

(function () {
  'use strict';

  // --- Mobile Nav Toggle ---
  const toggle = document.getElementById('navToggle');
  const tabs   = document.getElementById('navTabs');

  if (toggle && tabs) {
    toggle.addEventListener('click', function () {
      tabs.classList.toggle('open');
    });

    // Close nav when clicking outside
    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !tabs.contains(e.target)) {
        tabs.classList.remove('open');
      }
    });
  }

  // --- Active Nav Tab ---
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  const navLinks = document.querySelectorAll('.nav-tab');
  navLinks.forEach(function (link) {
    const href = link.getAttribute('href') || '';
    const normalizedHref = href.replace(/\/$/, '') || '/';
    // Match root, or prefix match for subpages
    if (normalizedHref === currentPath ||
        (normalizedHref !== '/' && currentPath.startsWith(normalizedHref))) {
      link.classList.add('active');
    }
  });

  // --- Footer Year ---
  const yearSpan = document.getElementById('currentYear');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // --- Status uptime placeholder (just for aesthetic) ---
  const uptimeEl = document.getElementById('uptimeCounter');
  if (uptimeEl) {
    const start = Date.now();
    setInterval(function () {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      uptimeEl.textContent = h + ':' + m + ':' + s;
    }, 1000);
  }
})();