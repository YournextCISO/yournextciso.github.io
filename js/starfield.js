/* ==============================================
   Starfield Background — SOC Dashboard Ambience
   Lightweight canvas animation: twinkling stars + slow drift
   ============================================== */

(function () {
  'use strict';

  var canvas = document.getElementById('starfield');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var stars = [];
  var STAR_COUNT = 150;
  var animationId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function randomStar() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,          // radius 0.3–2.1
      opacity: Math.random() * 0.7 + 0.3,     // base opacity 0.3–1.0
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
      driftSpeed: Math.random() * 0.15 + 0.03
    };
  }

  function initStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push(randomStar());
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var now = Date.now() * 0.001;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      // Twinkling
      var twinkle = Math.sin(now * s.twinkleSpeed * 60 + s.twinkleOffset);
      var alpha = s.opacity * (0.5 + 0.5 * twinkle);

      // Slow upward drift, wrap around
      s.y -= s.driftSpeed;
      if (s.y < -5) {
        s.y = canvas.height + 5;
        s.x = Math.random() * canvas.width;
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha.toFixed(3) + ')';
      ctx.fill();
    }

    animationId = requestAnimationFrame(draw);
  }

  // Boot
  resize();
  initStars();
  draw();

  window.addEventListener('resize', function () {
    resize();
    initStars();
  });

  // Cleanup on page unload (good practice)
  window.addEventListener('beforeunload', function () {
    if (animationId) cancelAnimationFrame(animationId);
  });
})();