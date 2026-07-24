/* ==============================================
   Medium Feed Loader — Dynamic Blog Posts
   ============================================== */

(function () {
  'use strict';

  var FEED_JSON_PATH = '/medium-posts.json';

  /**
   * Format a date string to a readable format.
   * Falls back to ISO if parsing fails.
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (_) {
      return dateStr;
    }
  }

  /**
   * Build a single post card as a DOM element, matching the existing card style.
   * Uses DOM methods to avoid XSS and entity-escaping pitfalls.
   */
  function createCard(post) {
    var article = document.createElement('article');
    article.className = 'card';

    // Title link
    var titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    var titleLink = document.createElement('a');
    titleLink.href = post.link || '#';
    titleLink.target = '_blank';
    titleLink.rel = 'noopener';
    titleLink.textContent = post.title + ' \u21AA';
    titleDiv.appendChild(titleLink);
    article.appendChild(titleDiv);

    // Meta (date)
    var metaDiv = document.createElement('div');
    metaDiv.className = 'card-meta';
    var dateSpan = document.createElement('span');
    dateSpan.textContent = '\uD83D\uDCC5 ' + formatDate(post.published);
    metaDiv.appendChild(dateSpan);
    article.appendChild(metaDiv);

    // Excerpt
    var excerptDiv = document.createElement('div');
    excerptDiv.className = 'card-excerpt';
    excerptDiv.textContent = post.excerpt || '';
    article.appendChild(excerptDiv);

    // Tags
    if (post.tags && post.tags.length) {
      var tagsWrapper = document.createElement('div');
      tagsWrapper.style.marginTop = '0.5rem';
      post.tags.slice(0, 4).forEach(function (tag) {
        var tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tagsWrapper.appendChild(tagSpan);
      });
      article.appendChild(tagsWrapper);
    }

    return article;
  }

  /**
   * Fetch and render Medium posts into all matching containers.
   */
  function loadFeed() {
    var containers = document.querySelectorAll('[data-medium-feed]');
    if (!containers.length) return;

    fetch(FEED_JSON_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (posts) {
        if (!Array.isArray(posts) || !posts.length) {
          containers.forEach(function (c) {
            c.innerHTML = '';
            var p = document.createElement('p');
            p.style.color = 'var(--soc-ink0)';
            p.textContent = 'No Medium posts yet.';
            c.appendChild(p);
          });
          return;
        }

        var count = parseInt(containers[0].getAttribute('data-medium-feed'), 10) || posts.length;
        count = Math.min(count, posts.length);

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < count; i++) {
          fragment.appendChild(createCard(posts[i]));
        }

        containers.forEach(function (c) {
          c.innerHTML = '';
          c.appendChild(fragment.cloneNode(true));
        });
      })
      .catch(function (err) {
        console.warn('Medium feed unavailable:', err.message);
        containers.forEach(function (c) { c.innerHTML = ''; });
      });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFeed);
  } else {
    loadFeed();
  }
})();