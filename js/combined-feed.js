/* ==============================================
   Combined Feed — Mixed Medium + Obsidian Posts
   Used on the homepage to show the 3 most recent
   posts from both sources merged together.
   ============================================== */

(function () {
  'use strict';

  var MEDIUM_JSON = '/medium-posts.json';
  var OBSIDIAN_JSON = '/obsidian-posts.json';

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
   * Create a card for a combined feed post.
   */
  function createCard(post) {
    var article = document.createElement('article');
    article.className = 'card';

    // Source badge
    if (post.source) {
      var badge = document.createElement('span');
      badge.className = 'card-source-badge badge-' + post.source.toLowerCase();
      badge.textContent = post.source;
      article.appendChild(badge);
    }

    // Title link
    var titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    var titleLink = document.createElement('a');
    titleLink.href = post.link || '#';
    titleLink.textContent = post.title;
    if (post.external) {
      titleLink.target = '_blank';
      titleLink.rel = 'noopener';
      titleLink.textContent += ' \u21AA';
    }
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
   * Transform Medium post objects into unified format.
   */
  function normalizeMedium(mediumPost) {
    return {
      title: mediumPost.title,
      link: mediumPost.link,
      published: mediumPost.published,
      excerpt: mediumPost.excerpt,
      tags: (mediumPost.tags || []).slice(0, 4),
      source: 'Medium',
      external: true,
      dateObj: new Date(mediumPost.published)
    };
  }

  /**
   * Transform Obsidian post objects into unified format.
   */
  function normalizeObsidian(obsidianPost) {
    return {
      title: obsidianPost.title,
      link: obsidianPost.url || '#',
      published: obsidianPost.date,
      excerpt: obsidianPost.excerpt,
      tags: (obsidianPost.tags || []).slice(0, 4),
      source: 'Obsidian',
      external: false,
      dateObj: new Date(obsidianPost.date)
    };
  }

  /**
   * Fetch both feeds, merge, sort by date, take top N.
   */
  function loadCombinedFeed() {
    var containers = document.querySelectorAll('[data-combined-feed]');
    if (!containers.length) return;

    // Read count from first container
    var count = parseInt(containers[0].getAttribute('data-combined-feed'), 10) || 3;

    // Fetch both sources
    Promise.allSettled([
      fetch(MEDIUM_JSON).then(function (r) { return r.ok ? r.json() : []; }),
      fetch(OBSIDIAN_JSON).then(function (r) { return r.ok ? r.json() : []; })
    ]).then(function (results) {
      var allPosts = [];

      // Medium posts
      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
        results[0].value.forEach(function (p) {
          allPosts.push(normalizeMedium(p));
        });
      }

      // Obsidian posts
      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) {
        results[1].value.forEach(function (p) {
          allPosts.push(normalizeObsidian(p));
        });
      }

      // Sort by date descending (newest first)
      allPosts.sort(function (a, b) {
        return b.dateObj - a.dateObj;
      });

      // Take top N
      var topPosts = allPosts.slice(0, count);

      // Render into each container
      containers.forEach(function (container) {
        container.innerHTML = '';

        if (!topPosts.length) {
          var p = document.createElement('p');
          p.style.color = 'var(--soc-ink0)';
          p.textContent = 'No posts yet.';
          container.appendChild(p);
          return;
        }

        var fragment = document.createDocumentFragment();
        topPosts.forEach(function (post) {
          fragment.appendChild(createCard(post));
        });
        container.appendChild(fragment);
      });
    }).catch(function (err) {
      console.warn('Combined feed error:', err.message);
      containers.forEach(function (c) {
        c.innerHTML = '<p style="color:var(--soc-ink0);">Could not load posts.</p>';
      });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCombinedFeed);
  } else {
    loadCombinedFeed();
  }
})();