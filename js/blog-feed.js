/* ==============================================
   Blog Feed — Unified Blog Page with Tag Filtering
   Merges Medium + Obsidian posts, renders filter
   pills, and supports client-side tag filtering.
   ============================================== */

(function () {
  'use strict';

  var MEDIUM_JSON = '/medium-posts.json';
  var OBSIDIAN_JSON = '/obsidian-posts.json';
  var allPosts = [];
  var currentFilter = 'All';

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
   * Create a card for a blog post.
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
      post.tags.forEach(function (tag) {
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
   * Transform Medium post → unified format.
   */
  function normalizeMedium(mediumPost) {
    return {
      title: mediumPost.title,
      link: mediumPost.link,
      published: mediumPost.published,
      excerpt: mediumPost.excerpt,
      tags: (mediumPost.tags || []).slice(0, 6),
      source: 'Medium',
      external: true,
      dateObj: new Date(mediumPost.published)
    };
  }

  /**
   * Transform Obsidian post → unified format.
   */
  function normalizeObsidian(obsidianPost) {
    return {
      title: obsidianPost.title,
      link: obsidianPost.url || '#',
      published: obsidianPost.date,
      excerpt: obsidianPost.excerpt,
      tags: (obsidianPost.tags || []).slice(0, 6),
      source: 'Obsidian',
      external: false,
      dateObj: new Date(obsidianPost.date)
    };
  }

  /**
   * Build the tag filter bar from all posts' tags.
   */
  function buildFilterBar(posts) {
    var filterBar = document.getElementById('blogFilterBar');
    if (!filterBar) return;

    // Collect tags with frequency
    var tagCounts = {};
    var sourceTags = ['Obsidian', 'Medium'];

    posts.forEach(function (post) {
      post.tags.forEach(function (tag) {
        var normalized = tag.trim();
        if (normalized) {
          tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
        }
      });
    });

    // Sort tags by frequency descending
    var sortedTags = Object.keys(tagCounts).sort(function (a, b) {
      return tagCounts[b] - tagCounts[a];
    });

    // Build filter pills: All + Sources + Content Tags
    var allTags = ['All'].concat(sourceTags).concat(sortedTags);
    filterBar.innerHTML = '';

    allTags.forEach(function (tag) {
      var pill = document.createElement('button');
      pill.className = 'filter-pill';
      if (tag === currentFilter) pill.classList.add('active');
      pill.textContent = tag;
      pill.setAttribute('data-filter', tag);
      pill.addEventListener('click', function () {
        setFilter(tag);
      });
      filterBar.appendChild(pill);
    });
  }

  /**
   * Set active filter and re-render posts.
   */
  function setFilter(filter) {
    currentFilter = filter;

    // Update active pill styling
    var pills = document.querySelectorAll('.filter-pill');
    pills.forEach(function (p) {
      if (p.getAttribute('data-filter') === filter) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    renderFiltered();
  }

  /**
   * Filter posts and render into the container.
   */
  function renderFiltered() {
    var container = document.getElementById('blogFeedContainer');
    if (!container) return;

    var filtered = allPosts;

    if (currentFilter !== 'All') {
      filtered = allPosts.filter(function (post) {
        // Check source
        if (post.source === currentFilter) return true;
        // Check content tags (case-insensitive)
        return post.tags.some(function (t) {
          return t.toLowerCase() === currentFilter.toLowerCase();
        });
      });
    }

    container.innerHTML = '';

    if (!filtered.length) {
      var p = document.createElement('p');
      p.style.color = 'var(--soc-ink0)';
      p.style.textAlign = 'center';
      p.style.padding = '2rem 0';
      p.textContent = 'No posts match this filter.';
      container.appendChild(p);
      return;
    }

    var fragment = document.createDocumentFragment();
    filtered.forEach(function (post) {
      fragment.appendChild(createCard(post));
    });
    container.appendChild(fragment);
  }

  /**
   * Fetch both feeds, merge, sort, and render.
   */
  function loadBlogFeed() {
    var container = document.getElementById('blogFeedContainer');
    if (!container) return;

    container.innerHTML = '<p style="color:var(--soc-ink0);">Loading posts…</p>';

    Promise.allSettled([
      fetch(MEDIUM_JSON).then(function (r) { return r.ok ? r.json() : []; }),
      fetch(OBSIDIAN_JSON).then(function (r) { return r.ok ? r.json() : []; })
    ]).then(function (results) {
      allPosts = [];

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

      // Sort by date descending
      allPosts.sort(function (a, b) {
        return b.dateObj - a.dateObj;
      });

      // Build the filter bar
      buildFilterBar(allPosts);

      // Render
      renderFiltered();
    }).catch(function (err) {
      console.warn('Blog feed error:', err.message);
      if (container) {
        container.innerHTML = '<p style="color:var(--soc-ink0);">Could not load posts.</p>';
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBlogFeed);
  } else {
    loadBlogFeed();
  }
})();