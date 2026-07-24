/* ==============================================
   DFIRing Feed — Personal thoughts blog
   Renders posts from dfiring-posts.json into cards
   ============================================== */

(function () {
  'use strict';

  var FEED_JSON_PATH = '/dfiring-posts.json';

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
    var container = document.getElementById('dfiringFeedContainer');
    if (!container) return;

    fetch(FEED_JSON_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (posts) {
        container.innerHTML = '';

        if (!Array.isArray(posts) || !posts.length) {
          var p = document.createElement('p');
          p.style.color = 'var(--soc-ink0)';
          p.style.textAlign = 'center';
          p.style.padding = '2rem 0';
          p.textContent = 'No thoughts published yet. Check back soon.';
          container.appendChild(p);
          return;
        }

        var fragment = document.createDocumentFragment();
        posts.forEach(function (post) {
          fragment.appendChild(createCard(post));
        });
        container.appendChild(fragment);
      })
      .catch(function (err) {
        console.warn('DFIRing feed unavailable:', err.message);
        container.innerHTML = '<p style="color:var(--soc-ink0);">Could not load posts.</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFeed);
  } else {
    loadFeed();
  }
})();