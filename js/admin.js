/* ==============================================
   YournextCISO Admin Panel — Write / Edit / Post
   Writes markdown posts to content/{posts|dfiring}/
   directly via the GitHub Contents API.
   ============================================== */

(function () {
  'use strict';

  const OWNER = 'YournextCISO';
  const REPO = 'yournextciso.github.io';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const TOKEN_KEY = 'ynciso_admin_token';

  const CONTENT_TYPES = {
    dfiring: { dir: 'content/dfiring', label: 'DFIRing Posts' },
    posts: { dir: 'content/posts', label: 'Blog Posts' }
  };

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    type: 'dfiring',
    files: [],
    currentPath: null,
    currentSha: null
  };

  // ---- DOM refs ----
  const gate = document.getElementById('gate');
  const app = document.getElementById('app');
  const tokenInput = document.getElementById('tokenInput');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const gateStatus = document.getElementById('gateStatus');
  const typeToggle = document.getElementById('typeToggle');
  const sidebarTitle = document.getElementById('sidebarTitle');
  const postList = document.getElementById('postList');
  const newPostBtn = document.getElementById('newPostBtn');
  const titleInput = document.getElementById('postTitle');
  const dateInput = document.getElementById('postDate');
  const tagsInput = document.getElementById('postTags');
  const excerptInput = document.getElementById('postExcerpt');
  const slugInput = document.getElementById('postSlug');
  const bodyInput = document.getElementById('postBody');
  const saveBtn = document.getElementById('saveBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const editorStatus = document.getElementById('editorStatus');
  const editorToolbar = document.getElementById('editorToolbar');
  const previewToggle = document.getElementById('previewToggle');
  const previewPane = document.getElementById('previewPane');
  const editorPanes = document.getElementById('editorPanes');
  const imageFileInput = document.getElementById('imageFileInput');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  // ---- GitHub API helpers ----
  function ghHeaders(extra) {
    return Object.assign({
      'Authorization': 'token ' + state.token,
      'Accept': 'application/vnd.github+json'
    }, extra || {});
  }

  async function ghErrorMessage(res, fallback) {
    const err = await res.json().catch(() => ({}));
    return err.message ? `${err.message} (${res.status})` : `${fallback}: ${res.status}`;
  }

  async function ghListDir(dir) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${dir}?ref=${BRANCH}`, { headers: ghHeaders() });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(await ghErrorMessage(res, `Could not list ${dir}`));
    const data = await res.json();
    return data
      .filter(f => f.type === 'file' && /\.md$/i.test(f.name) && !/^(readme|index)\.md$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function ghGetFile(path) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: ghHeaders() });
    if (!res.ok) throw new Error(await ghErrorMessage(res, `Could not load ${path}`));
    const data = await res.json();
    const content = b64DecodeUtf8(data.content.replace(/\n/g, ''));
    return { sha: data.sha, content };
  }

  async function ghPutFileB64(path, base64Content, message, sha) {
    const body = { message, content: base64Content, branch: BRANCH };
    if (sha) body.sha = sha;
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: ghHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await ghErrorMessage(res, 'Save failed'));
    return res.json();
  }

  async function ghPutFile(path, content, message, sha) {
    return ghPutFileB64(path, b64EncodeUtf8(content), message, sha);
  }

  async function ghDeleteFile(path, sha, message) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'DELETE',
      headers: ghHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, sha, branch: BRANCH })
    });
    if (!res.ok) throw new Error(await ghErrorMessage(res, 'Delete failed'));
    return res.json();
  }

  function b64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUtf8(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  // ---- image upload (button / paste / drag & drop) ----
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const EXT_BY_MIME = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp'
  };

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  function sanitizeFilename(name, mime) {
    let base = (name || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
    if (!base) base = `pasted-image-${Date.now()}`;
    if (!/\.[a-z0-9]+$/i.test(base)) base += EXT_BY_MIME[mime] || '.png';
    return base;
  }

  async function uploadImage(file) {
    if (!file || !/^image\//.test(file.type)) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus(`${file.name || 'Image'} is over 10MB — compress it first`, 'err');
      return;
    }
    const dir = CONTENT_TYPES[state.type].dir;
    let name = sanitizeFilename(file.name, file.type);
    let path = `${dir}/Attachments/${name}`;

    setStatus(`Uploading ${name}…`);
    try {
      try {
        await ghGetFile(path);
        // a file already exists at that name — don't clobber it, disambiguate
        const extMatch = name.match(/\.[a-z0-9]+$/i);
        const ext = extMatch ? extMatch[0] : '';
        const base = ext ? name.slice(0, -ext.length) : name;
        name = `${base}-${Date.now().toString(36)}${ext}`;
        path = `${dir}/Attachments/${name}`;
      } catch (_) { /* doesn't exist yet — good */ }

      const base64 = await readFileAsBase64(file);
      await ghPutFileB64(path, base64, `Add image: ${name}`);
      const alt = name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
      insertAtCursor(bodyInput, `![${alt}](Attachments/${name})\n`);
      commitHistory();
      if (previewPane.style.display !== 'none') updatePreview();
      setStatus(`Uploaded ${name} — reference inserted`, 'ok');
    } catch (e) {
      setStatus(`Image upload failed: ${e.message}`, 'err');
    }
  }

  async function uploadImages(files) {
    for (const file of files) {
      await uploadImage(file);
    }
  }

  // ---- slug (mirrors scripts/build_posts.py:slugify) ----
  function slugify(text) {
    let s = (text || '').toLowerCase().trim();
    s = s.replace(/[^\w\s-]/g, '');
    s = s.replace(/[\s_]+/g, '-');
    s = s.replace(/-+/g, '-');
    return s.replace(/^-+|-+$/g, '');
  }

  // ---- frontmatter build/parse ----
  function yamlStr(str) {
    return '"' + String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function buildMarkdown(meta, body) {
    const tags = meta.tags.length ? `[${meta.tags.map(yamlStr).join(', ')}]` : '[]';
    let fm = '---\n';
    fm += `title: ${yamlStr(meta.title)}\n`;
    fm += `date: ${meta.date}\n`;
    fm += `tags: ${tags}\n`;
    if (meta.excerpt) fm += `excerpt: ${yamlStr(meta.excerpt)}\n`;
    fm += '---\n\n';
    return fm + body.trim() + '\n';
  }

  function parseMarkdown(raw) {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { title: '', date: '', tags: [], excerpt: '', body: raw };
    const meta = {};
    m[1].split(/\r?\n/).forEach(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (key === 'tags') {
        val = val.replace(/^\[|\]$/g, '');
        meta.tags = val ? val.split(',').map(t => t.trim().replace(/^["']|["']$/g, '')) : [];
      } else {
        meta[key] = val.replace(/^["']|["']$/g, '');
      }
    });
    return {
      title: meta.title || '',
      date: meta.date || '',
      tags: meta.tags || [],
      excerpt: meta.excerpt || '',
      body: (m[2] || '').trim()
    };
  }

  // ---- tiny markdown -> html preview (approximate; real render happens server-side) ----
  function renderPreview(md) {
    let html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    html = html.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\d+\.\s+(.*)$/gm, '<li data-ol="1">$1</li>');
    html = html.replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li(?: data-ol="1")?>.*<\/li>\n?)+/g, block => {
      const ordered = block.includes('data-ol="1"');
      const items = block.replace(/ data-ol="1"/g, '');
      return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    });
    html = html.split(/\n{2,}/).map(chunk => {
      if (/^\s*<(h1|h2|h3|ul|ol|pre|blockquote|hr)/.test(chunk)) return chunk;
      return chunk.trim() ? `<p>${chunk.trim().replace(/\n/g, '<br>')}</p>` : '';
    }).join('\n');
    return html;
  }

  // ---- UI state helpers ----
  function setStatus(msg, kind) {
    editorStatus.textContent = msg || '';
    editorStatus.className = 'editor-status' + (kind ? ' ' + kind : '');
  }

  function clearEditor() {
    state.currentPath = null;
    state.currentSha = null;
    titleInput.value = '';
    dateInput.value = new Date().toISOString().slice(0, 10);
    tagsInput.value = '';
    excerptInput.value = '';
    slugInput.value = '';
    bodyInput.value = '';
    deleteBtn.style.display = 'none';
    setStatus('New post — unsaved');
    highlightActivePost();
    resetHistory();
  }

  function highlightActivePost() {
    postList.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.path === state.currentPath);
    });
  }

  async function loadPostList() {
    postList.innerHTML = '<li class="post-list-empty">Loading…</li>';
    try {
      const dir = CONTENT_TYPES[state.type].dir;
      state.files = await ghListDir(dir);
      if (!state.files.length) {
        postList.innerHTML = '<li class="post-list-empty">No posts yet.</li>';
        return;
      }
      postList.innerHTML = '';
      state.files.forEach(f => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.textContent = f.name.replace(/\.md$/i, '');
        btn.dataset.path = f.path;
        btn.dataset.sha = f.sha;
        btn.addEventListener('click', () => openPost(f.path, f.sha));
        li.appendChild(btn);
        postList.appendChild(li);
      });
      highlightActivePost();
    } catch (e) {
      postList.innerHTML = `<li class="post-list-empty">Error: ${e.message}</li>`;
    }
  }

  async function openPost(path, sha) {
    setStatus('Loading…');
    try {
      const { content, sha: freshSha } = await ghGetFile(path);
      const meta = parseMarkdown(content);
      state.currentPath = path;
      state.currentSha = freshSha || sha;
      titleInput.value = meta.title;
      dateInput.value = meta.date;
      tagsInput.value = meta.tags.join(', ');
      excerptInput.value = meta.excerpt;
      slugInput.value = path.split('/').pop().replace(/\.md$/i, '');
      bodyInput.value = meta.body;
      deleteBtn.style.display = '';
      setStatus('Loaded');
      highlightActivePost();
      resetHistory();
      if (previewPane.style.display !== 'none') updatePreview();
    } catch (e) {
      setStatus(e.message, 'err');
    }
  }

  async function savePost() {
    const title = titleInput.value.trim();
    if (!title) { setStatus('Title is required', 'err'); return; }
    const date = dateInput.value || new Date().toISOString().slice(0, 10);
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    const excerpt = excerptInput.value.trim();
    const body = bodyInput.value;
    if (!body.trim()) { setStatus('Body is empty', 'err'); return; }

    const slug = slugify(slugInput.value.trim() || title);
    if (!slug) { setStatus('Could not derive a slug from the title', 'err'); return; }

    const dir = CONTENT_TYPES[state.type].dir;
    const path = `${dir}/${slug}.md`;
    const md = buildMarkdown({ title, date, tags, excerpt }, body);

    saveBtn.disabled = true;
    setStatus('Publishing…');
    try {
      let sha = state.currentPath === path ? state.currentSha : undefined;
      if (sha === undefined) {
        // path changed (new post, or slug changed) — check if a file already exists there
        try {
          const existing = await ghGetFile(path);
          sha = existing.sha;
        } catch (_) { /* doesn't exist yet, that's fine */ }
      }
      const message = (state.currentPath ? 'Update' : 'Add') + ` post: ${title}`;
      await ghPutFile(path, md, message, sha);
      state.currentPath = path;
      state.currentSha = undefined;
      deleteBtn.style.display = '';
      setStatus('Published — build pipeline will deploy it shortly', 'ok');
      await loadPostList();
    } catch (e) {
      setStatus(e.message, 'err');
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function deletePost() {
    if (!state.currentPath || !state.currentSha) return;
    if (!confirm(`Delete "${titleInput.value}"? This cannot be undone from here.`)) return;
    setStatus('Deleting…');
    try {
      await ghDeleteFile(state.currentPath, state.currentSha, `Delete post: ${titleInput.value}`);
      setStatus('Deleted', 'ok');
      clearEditor();
      await loadPostList();
    } catch (e) {
      setStatus(e.message, 'err');
    }
  }

  // ---- toolbar (wraps/inserts markdown at cursor) ----
  const TOOLBAR_ACTIONS = {
    h1: t => prefixLine(t, '# '),
    h2: t => prefixLine(t, '## '),
    h3: t => prefixLine(t, '### '),
    bold: t => wrap(t, '**', '**'),
    italic: t => wrap(t, '*', '*'),
    quote: t => prefixLine(t, '> '),
    code: t => wrap(t, '```\n', '\n```'),
    ul: t => prefixLine(t, '- '),
    ol: t => prefixLine(t, '1. '),
    link: t => wrap(t, '[', '](https://)'),
    image: t => wrap(t, '![', '](https://)'),
    hr: t => insertAtCursor(t, '\n---\n')
  };

  function wrap(textarea, before, after) {
    const { selectionStart: s, selectionEnd: e, value } = textarea;
    const selected = value.slice(s, e) || 'text';
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    textarea.value = next;
    textarea.focus();
    textarea.selectionStart = s + before.length;
    textarea.selectionEnd = s + before.length + selected.length;
  }

  function prefixLine(textarea, prefix) {
    const { selectionStart: s, value } = textarea;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    textarea.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = s + prefix.length;
  }

  function insertAtCursor(textarea, text) {
    const { selectionStart: s, value } = textarea;
    textarea.value = value.slice(0, s) + text + value.slice(s);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = s + text.length;
  }

  // ---- undo / redo history ----
  const history = { stack: [], index: -1, limit: 150, timer: null };

  function historySnapshot() {
    return { value: bodyInput.value, start: bodyInput.selectionStart, end: bodyInput.selectionEnd };
  }

  function commitHistory() {
    clearTimeout(history.timer);
    history.timer = null;
    const snap = historySnapshot();
    const top = history.stack[history.index];
    if (top && top.value === snap.value) return;
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(snap);
    if (history.stack.length > history.limit) history.stack.shift();
    history.index = history.stack.length - 1;
    updateUndoRedoButtons();
  }

  function scheduleHistory() {
    clearTimeout(history.timer);
    history.timer = setTimeout(commitHistory, 500);
  }

  function resetHistory() {
    clearTimeout(history.timer);
    history.timer = null;
    history.stack = [historySnapshot()];
    history.index = 0;
    updateUndoRedoButtons();
  }

  function applyHistorySnapshot(snap) {
    bodyInput.value = snap.value;
    bodyInput.focus();
    bodyInput.selectionStart = snap.start;
    bodyInput.selectionEnd = snap.end;
    if (previewPane.style.display !== 'none') updatePreview();
    updateUndoRedoButtons();
  }

  function undo() {
    commitHistory();
    if (history.index <= 0) return;
    history.index--;
    applyHistorySnapshot(history.stack[history.index]);
  }

  function redo() {
    commitHistory();
    if (history.index >= history.stack.length - 1) return;
    history.index++;
    applyHistorySnapshot(history.stack[history.index]);
  }

  function updateUndoRedoButtons() {
    if (!undoBtn || !redoBtn) return;
    undoBtn.disabled = history.index <= 0;
    redoBtn.disabled = history.index >= history.stack.length - 1;
  }

  editorToolbar.addEventListener('click', e => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmd === 'upload') { imageFileInput.click(); return; }
    if (cmd === 'undo') { undo(); return; }
    if (cmd === 'redo') { redo(); return; }
    const action = TOOLBAR_ACTIONS[cmd];
    if (action) {
      action(bodyInput);
      commitHistory();
      if (previewPane.style.display !== 'none') updatePreview();
    }
  });

  bodyInput.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  });

  imageFileInput.addEventListener('change', async () => {
    await uploadImages(Array.from(imageFileInput.files || []));
    imageFileInput.value = '';
  });

  bodyInput.addEventListener('paste', e => {
    const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
    const images = items.filter(it => it.kind === 'file' && /^image\//.test(it.type)).map(it => it.getAsFile()).filter(Boolean);
    if (!images.length) return;
    e.preventDefault();
    uploadImages(images);
  });

  bodyInput.addEventListener('dragover', e => { e.preventDefault(); });
  bodyInput.addEventListener('drop', e => {
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    e.preventDefault();
    uploadImages(files);
  });

  function updatePreview() {
    previewPane.innerHTML = renderPreview(bodyInput.value);
  }

  previewToggle.addEventListener('click', () => {
    const showing = previewPane.style.display !== 'none';
    previewPane.style.display = showing ? 'none' : '';
    editorPanes.classList.toggle('split', !showing);
    previewToggle.textContent = showing ? 'Preview' : 'Hide Preview';
    if (!showing) updatePreview();
  });
  bodyInput.addEventListener('input', () => {
    scheduleHistory();
    if (previewPane.style.display !== 'none') updatePreview();
  });

  // ---- content-type toggle ----
  typeToggle.addEventListener('click', e => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    state.type = btn.dataset.type;
    typeToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    sidebarTitle.textContent = CONTENT_TYPES[state.type].label;
    clearEditor();
    loadPostList();
  });

  newPostBtn.addEventListener('click', clearEditor);
  saveBtn.addEventListener('click', savePost);
  deleteBtn.addEventListener('click', deletePost);
  titleInput.addEventListener('blur', () => {
    if (!state.currentPath && !slugInput.value.trim()) {
      slugInput.placeholder = slugify(titleInput.value) || 'my-post-title';
    }
  });

  // ---- auth gate ----
  async function verifyAndEnter() {
    gateStatus.textContent = 'Verifying…';
    try {
      const res = await fetch(`${API}/repos/${OWNER}/${REPO}`, { headers: ghHeaders() });
      if (!res.ok) throw new Error('Token rejected or missing repo access (' + res.status + ')');
      localStorage.setItem(TOKEN_KEY, state.token);
      gate.style.display = 'none';
      app.style.display = '';
      clearEditor();
      loadPostList();
    } catch (e) {
      gateStatus.textContent = e.message;
    }
  }

  connectBtn.addEventListener('click', () => {
    state.token = tokenInput.value.trim();
    if (!state.token) { gateStatus.textContent = 'Enter a token first'; return; }
    verifyAndEnter();
  });

  disconnectBtn.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    state.token = '';
    tokenInput.value = '';
    app.style.display = 'none';
    gate.style.display = '';
    gateStatus.textContent = 'Disconnected';
  });

  // ---- init ----
  if (state.token) {
    verifyAndEnter();
  }
})();
