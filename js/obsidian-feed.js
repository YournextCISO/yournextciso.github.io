/* ==============================================
   Obsidian Feed Loader — Renders Obsidian Posts
   Standalone renderer for dedicated Obsidian-only
   feed sections using [data-obsidian-feed] containers.
   ============================================== */

(function () {
  'use strict';

  var FEED_JSON_PATH = '/obsidian-posts.json';

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

  function createCard(post) {
    var article = document.createElement('article');
    article.className = 'card';

    // Source badge
    var badge = document.createElement('span');
    badge.className = 'card-source-badge badge-obsidian';
    badge.textContent = 'Obsidian';
    article.appendChild(badge);

    // Title link (internal)
    var titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    var titleLink = document.createElement('a');
    titleLink.href = post.url || '#';
    titleLink.textContent = post.title;
    titleDiv.appendChild(titleLink);
    article.appendChild(titleDiv);

    // Meta (date)
    var metaDiv = document.createElement('div');
    metaDiv.className = 'card-meta';
    var dateSpan = document.createElement('span');
    dateSpan.textContent = '\uD83D\uDCC5 ' + formatDate(post.date);
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
      post.tags.slice(0, 5).forEach(function (tag) {
        var tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = tag;
        tagsWrapper.appendChild(tagSpan);
      });
      article.appendChild(tagsWrapper);
    }

    return article;
  }

  function loadFeed() {
    var containers = document.querySelectorAll('[data-obsidian-feed]');
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
            p.textContent = 'No Obsidian notes published yet.';
            c.appendChild(p);
          });
          return;
        }

        containers.forEach(function (container) {
          var count = parseInt(container.getAttribute('data-obsidian-feed'), 10) || posts.length;
          count = Math.min(count, posts.length);

          container.innerHTML = '';
          var fragment = document.createDocumentFragment();
          for (var i = 0; i < count; i++) {
            fragment.appendChild(createCard(posts[i]));
          }
          container.appendChild(fragment);
        });
      })
      .catch(function (err) {
        console.warn('Obsidian feed unavailable:', err.message);
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