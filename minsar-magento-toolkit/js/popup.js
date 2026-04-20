// Minsar — Popup Controller
(function () {
  'use strict';

  let currentTab = null;
  let adminBaseUrl = '';
  let isMagento = false;

  // ── Init ──
  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Check if current page is Magento admin
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: detectMagento
      });
      isMagento = result?.result?.isMagento || false;
      adminBaseUrl = result?.result?.baseUrl || '';
    } catch {
      isMagento = false;
    }

    if (isMagento) {
      document.getElementById('main-content').classList.remove('hidden');
      document.getElementById('not-magento').classList.add('hidden');
      loadStoreInfo();
      loadBookmarks();
      loadHistory();
      loadToggles();
    } else {
      document.getElementById('main-content').classList.add('hidden');
      document.getElementById('not-magento').classList.remove('hidden');
    }

    bindEvents();
    if (isMagento) {
      document.getElementById('omni-search').focus();
    }
  }

  // ── Detect Magento Admin ──
  function detectMagento() {
    const body = document.body;
    const isMage = !!(
      document.querySelector('meta[name="form_key"]') ||
      document.querySelector('.admin__menu') ||
      document.querySelector('#html-body.admin__scope') ||
      body?.classList?.contains('admin__scope') ||
      document.querySelector('script[src*="mage/"]') ||
      document.querySelector('form[data-form="edit"]') ||
      document.querySelector('.page-wrapper.admin__scope')
    );

    let baseUrl = '';
    if (isMage) {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.textContent.includes('BASE_URL')) {
          const match = s.textContent.match(/BASE_URL["']?\s*[:=]\s*["']([^"']+)["']/);
          if (match) { baseUrl = match[1]; break; }
        }
      }
      if (!baseUrl) {
        const url = window.location.href;
        const adminMatch = url.match(/(https?:\/\/[^/]+\/[^/]+)\//);
        if (adminMatch) baseUrl = adminMatch[1];
      }
    }

    return { isMagento: isMage, baseUrl };
  }

  // ── Bind Events ──
  function bindEvents() {
    // Omni Search
    const searchInput = document.getElementById('omni-search');
    searchInput.addEventListener('input', handleOmniSearch);
    searchInput.addEventListener('keydown', handleSearchKeydown);

    // Cache Flush Buttons
    document.getElementById('btn-flush-all').addEventListener('click', () => flushCache('all'));
    document.getElementById('btn-flush-config').addEventListener('click', () => flushCache('config'));
    document.getElementById('btn-flush-layout').addEventListener('click', () => flushCache('layout'));
    document.getElementById('btn-flush-fpc').addEventListener('click', () => flushCache('full_page'));
    document.getElementById('btn-flush-block').addEventListener('click', () => flushCache('block_html'));
    document.getElementById('btn-flush-translate').addEventListener('click', () => flushCache('translate'));

    // Order Search
    document.getElementById('btn-order-search').addEventListener('click', handleOrderSearch);
    document.getElementById('order-search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleOrderSearch();
    });

    // Toggles
    document.getElementById('toggle-dark').addEventListener('change', toggleDarkMode);
    document.getElementById('toggle-compact').addEventListener('change', toggleCompactMode);

    // Bookmarks
    document.getElementById('btn-add-bookmark').addEventListener('click', addBookmark);

    // Settings
    document.getElementById('btn-settings').addEventListener('click', showSettings);
    document.getElementById('btn-back').addEventListener('click', hideSettings);
    document.getElementById('btn-save-env').addEventListener('click', saveEnvSettings);
  }

  // ── Feature 1: Omni Search ──
  let searchHighlight = -1;

  function handleOmniSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    const resultsEl = document.getElementById('search-results');

    if (query.length < 2) {
      resultsEl.classList.add('hidden');
      return;
    }

    const results = searchIndex(query);
    searchHighlight = -1;

    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="search-result-item"><span class="search-result-text">No results found</span></div>';
    } else {
      resultsEl.innerHTML = results.slice(0, 10).map((r, i) => `
        <div class="search-result-item" data-index="${i}" data-type="${r.type}" data-path="${r.path || ''}" data-action="${r.action || ''}">
          <span class="search-result-icon">${r.icon}</span>
          <span class="search-result-text">
            ${r.name}
            <span class="search-result-path">${r.type === 'action' ? 'Action' : r.path || ''}</span>
          </span>
          ${r.type === 'action' ? '<span class="search-result-kbd">↵ Run</span>' : ''}
        </div>
      `).join('');
    }

    resultsEl.classList.remove('hidden');

    // Click handlers for results
    resultsEl.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => executeSearchResult(item));
    });
  }

  function handleSearchKeydown(e) {
    const resultsEl = document.getElementById('search-results');
    const items = resultsEl.querySelectorAll('.search-result-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchHighlight = Math.min(searchHighlight + 1, items.length - 1);
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchHighlight = Math.max(searchHighlight - 1, 0);
      updateHighlight(items);
    } else if (e.key === 'Enter' && searchHighlight >= 0 && items[searchHighlight]) {
      e.preventDefault();
      executeSearchResult(items[searchHighlight]);
    } else if (e.key === 'Escape') {
      resultsEl.classList.add('hidden');
    }
  }

  function updateHighlight(items) {
    items.forEach((item, i) => {
      item.style.background = i === searchHighlight ? 'var(--bg-hover)' : '';
    });
  }

  function searchIndex(query) {
    const results = [];
    const all = [
      ...MINSAR_INDEX.pages.map(p => ({ ...p, type: 'page' })),
      ...MINSAR_INDEX.configs.map(c => ({ ...c, type: 'config' })),
      ...MINSAR_INDEX.actions.map(a => ({ ...a, type: 'action' }))
    ];

    for (const item of all) {
      const searchable = `${item.name} ${item.keywords || ''} ${item.path || ''}`.toLowerCase();
      if (searchable.includes(query)) {
        results.push(item);
      }
    }

    // Sort: exact name match first, then by type (actions > pages > configs)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase().startsWith(query) ? 0 : 1;
      const bExact = b.name.toLowerCase().startsWith(query) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const typeOrder = { action: 0, page: 1, config: 2 };
      return (typeOrder[a.type] || 3) - (typeOrder[b.type] || 3);
    });

    return results;
  }

  function executeSearchResult(item) {
    const type = item.dataset.type;
    const path = item.dataset.path;
    const action = item.dataset.action;

    if (type === 'action') {
      executeAction(action);
    } else if (path) {
      navigateToPath(path);
    }
  }

  function executeAction(action) {
    switch (action) {
      case 'flush-all': flushCache('all'); break;
      case 'flush-config': flushCache('config'); break;
      case 'flush-layout': flushCache('layout'); break;
      case 'flush-fpc': flushCache('full_page'); break;
      case 'flush-block': flushCache('block_html'); break;
      case 'flush-translate': flushCache('translate'); break;
      case 'toggle-dark':
        document.getElementById('toggle-dark').click();
        break;
      case 'toggle-compact':
        document.getElementById('toggle-compact').click();
        break;
      case 'add-bookmark': addBookmark(); break;
    }
  }

  function navigateToPath(path) {
    // All paths in config-index start with /admin/
    // We need to replace /admin with the actual admin path from the current URL
    const url = currentTab.url;
    const match = url.match(/(https?:\/\/[^/]+\/[^/]+)\//);

    if (match) {
      // match[1] = https://domain.com/customadmin
      const cleanPath = path.replace(/^\/admin/, '');
      chrome.tabs.update(currentTab.id, { url: match[1] + cleanPath });
    } else {
      // Fallback: use origin + path as-is
      const origin = new URL(url).origin;
      chrome.tabs.update(currentTab.id, { url: origin + path });
    }
    window.close();
  }

  // ── Feature 2: Cache Flush ──
  async function flushCache(type) {
    const btnMap = {
      all: 'btn-flush-all',
      config: 'btn-flush-config',
      layout: 'btn-flush-layout',
      full_page: 'btn-flush-fpc',
      block_html: 'btn-flush-block',
      translate: 'btn-flush-translate'
    };

    const btn = document.getElementById(btnMap[type]);
    btn.classList.add('loading');

    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: executeCacheFlush,
        args: [type]
      });

      // If we get here without error, the fetch was dispatched
      btn.classList.remove('loading');
      btn.classList.add('success');
      showToast(`✅ ${type === 'all' ? 'All caches' : type + ' cache'} flushed!`, 'success');
      setTimeout(() => btn.classList.remove('success'), 2000);
    } catch (err) {
      btn.classList.remove('loading');
      showToast(`❌ Failed: ${err.message}`, 'error');
    }
  }

  // This runs in the PAGE context, not the popup
  function executeCacheFlush(type) {
    const formKey = document.querySelector('input[name="form_key"]')?.value
      || document.querySelector('meta[name="form_key"]')?.content;

    if (!formKey) return;

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const adminPath = pathParts[0] || 'admin';
    const adminBase = `${window.location.origin}/${adminPath}`;

    if (type === 'all') {
      const body = new URLSearchParams();
      body.append('form_key', formKey);
      fetch(`${adminBase}/admin/cache/flushAll/`, {
        method: 'POST',
        body: body,
        credentials: 'same-origin'
      }).catch(() => {});
    } else {
      // MassRefresh is POST with types[] param
      const body = new URLSearchParams();
      body.append('form_key', formKey);
      body.append('types[]', type);

      fetch(`${adminBase}/admin/cache/massRefresh/`, {
        method: 'POST',
        body: body,
        credentials: 'same-origin'
      }).catch(() => {});
    }
  }

  // ── Feature 4: Order Search ──
  function handleOrderSearch() {
    const query = document.getElementById('order-search').value.trim();
    if (!query) return;

    // Navigate to orders grid with search filter
    const searchParam = encodeURIComponent(query);
    navigateToPath(`/admin/sales/order/?search=${searchParam}`);
  }

  // ── Feature 5 & 6: Dark Mode & Compact Mode ──
  async function toggleDarkMode(e) {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ minsarDarkMode: enabled });

    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: applyDarkMode,
      args: [enabled]
    });

    showToast(enabled ? '🌙 Dark mode enabled' : '☀️ Light mode restored', 'info');
  }

  async function toggleCompactMode(e) {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ minsarCompactMode: enabled });

    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: applyCompactMode,
      args: [enabled]
    });

    showToast(enabled ? '📐 Compact mode enabled' : '📐 Compact mode disabled', 'info');
  }

  function applyDarkMode(enabled) {
    const id = 'minsar-dark-mode';
    let style = document.getElementById(id);

    if (enabled) {
      if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = `
        body.admin__scope,
        .admin__scope .page-wrapper,
        .admin__scope .admin__menu,
        .admin__scope .page-content { background: #1a1a2e !important; color: #e0e0e0 !important; }
        .admin__scope .page-title, .admin__scope h1, .admin__scope h2, .admin__scope h3, .admin__scope h4 { color: #e0e0e0 !important; }
        .admin__scope .admin__data-grid-outer-wrap, .admin__scope .admin__data-grid-wrap { background: #16213e !important; }
        .admin__scope table.data-grid { background: #16213e !important; }
        .admin__scope table.data-grid th { background: #0f3460 !important; color: #e0e0e0 !important; }
        .admin__scope table.data-grid td { background: #16213e !important; color: #e0e0e0 !important; border-color: #2a2a4a !important; }
        .admin__scope table.data-grid tr:hover td { background: #1e2a4a !important; }
        .admin__scope .admin__control-text, .admin__scope input[type="text"], .admin__scope textarea, .admin__scope select { background: #16213e !important; color: #e0e0e0 !important; border-color: #2a2a4a !important; }
        .admin__scope .admin__fieldset, .admin__scope .admin__field { border-color: #2a2a4a !important; }
        .admin__scope .admin__page-section { background: #16213e !important; border-color: #2a2a4a !important; }
        .admin__scope .page-main-actions { background: #1a1a2e !important; }
        .admin__scope .admin__menu { background: #0f0f23 !important; }
        .admin__scope .admin__menu li a { color: #8892a4 !important; }
        .admin__scope .admin__menu li a:hover, .admin__scope .admin__menu li._active > a { color: #e94560 !important; }
        .admin__scope .modal-popup .modal-inner-wrap { background: #1a1a2e !important; color: #e0e0e0 !important; }
        .admin__scope .admin__action-dropdown-menu { background: #16213e !important; border-color: #2a2a4a !important; }
        .admin__scope label, .admin__scope .admin__field-label span { color: #c0c0c0 !important; }
        .admin__scope .message { border-radius: 4px; }
        .admin__scope a { color: #e94560 !important; }
        .admin__scope .page-header { background: #0f0f23 !important; }
        .admin__scope .page-header .admin-user .admin__action-dropdown { background: #16213e !important; }
      `;
    } else if (style) {
      style.remove();
    }
  }

  function applyCompactMode(enabled) {
    const id = 'minsar-compact-mode';
    let style = document.getElementById(id);

    if (enabled) {
      if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = `
        .admin__scope .page-header { min-height: 40px !important; padding: 4px 16px !important; }
        .admin__scope .page-header .logo { height: 28px !important; }
        .admin__scope .page-title-wrapper { padding: 8px 0 !important; margin: 0 !important; }
        .admin__scope .page-title { font-size: 18px !important; margin: 0 !important; }
        .admin__scope .page-main-actions { padding: 8px 16px !important; margin: 0 !important; }
        .admin__scope .admin__data-grid-header { padding: 8px !important; }
        .admin__scope table.data-grid td, .admin__scope table.data-grid th { padding: 6px 10px !important; font-size: 12px !important; }
        .admin__scope .admin__data-grid-pager { padding: 4px 8px !important; }
        .admin__scope .page-content { padding: 8px 16px !important; }
        .admin__scope .admin__fieldset { padding: 8px !important; }
        .admin__scope .admin__field { padding: 4px 0 !important; }
        .admin__scope .page-columns .page-columns-wrapper { padding: 0 !important; }
        .admin__scope .admin__page-nav { padding: 8px !important; }
        .admin__scope .admin__page-section { margin-bottom: 8px !important; padding: 8px !important; }
        .admin__scope .page-wrapper > .page-content { padding-top: 0 !important; }
        .admin__scope .admin__data-grid-filters-wrap { padding: 4px 8px !important; }
      `;
    } else if (style) {
      style.remove();
    }
  }

  // ── Feature 7: Store Info ──
  async function loadStoreInfo() {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: getStoreInfo
      });
      const info = result?.result;
      if (info) {
        const badge = document.getElementById('store-info-badge');
        badge.textContent = info.version ? `v${info.version}` : 'M2';
        badge.title = `Magento ${info.version || '2.x'}`;
        badge.classList.remove('hidden');
      }
    } catch { /* ignore */ }
  }

  function getStoreInfo() {
    let version = '';

    // Get version from footer
    const footer = document.querySelector('.admin__footer, .page-footer');
    if (footer) {
      const match = footer.textContent.match(/(\d+\.\d+\.\d+[\w.-]*)/);
      if (match) version = match[1];
    }

    return { version };
  }

  // ── Feature 8: Bookmarks ──
  async function loadBookmarks() {
    const data = await chrome.storage.local.get('minsarBookmarks');
    const bookmarks = data.minsarBookmarks || [];
    renderBookmarks(bookmarks);
  }

  // ── Utility: escape HTML ──
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderBookmarks(bookmarks) {
    const list = document.getElementById('bookmarks-list');
    if (bookmarks.length === 0) {
      list.innerHTML = '<p class="empty-state">No bookmarks yet. Click "+ Add" to save this page.</p>';
      return;
    }
    list.innerHTML = bookmarks.map((b, i) => `
      <div class="bookmark-item" data-url="${esc(b.url)}">
        <span>📌</span>
        <span class="bookmark-title">${esc(b.title)}</span>
        <button class="remove-btn" data-index="${i}" title="Remove">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) return;
        chrome.tabs.update(currentTab.id, { url: item.dataset.url });
        window.close();
      });
    });

    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        bookmarks.splice(idx, 1);
        await chrome.storage.local.set({ minsarBookmarks: bookmarks });
        renderBookmarks(bookmarks);
        showToast('Bookmark removed', 'info');
      });
    });
  }

  async function addBookmark() {
    const data = await chrome.storage.local.get('minsarBookmarks');
    const bookmarks = data.minsarBookmarks || [];

    const exists = bookmarks.some(b => b.url === currentTab.url);
    if (exists) {
      showToast('Already bookmarked', 'info');
      return;
    }

    // Get page title from tab
    let title = currentTab.title || 'Untitled';
    title = title.replace(/Magento Admin/i, '').replace(/\|/g, '').trim() || 'Admin Page';

    bookmarks.push({ url: currentTab.url, title });
    await chrome.storage.local.set({ minsarBookmarks: bookmarks });
    renderBookmarks(bookmarks);
    showToast('📌 Page bookmarked!', 'success');
  }

  // ── Feature 9: Activity History ──
  async function loadHistory() {
    const data = await chrome.storage.local.get('minsarHistory');
    const history = data.minsarHistory || [];
    renderHistory(history);
  }

  function renderHistory(history) {
    const list = document.getElementById('history-list');
    if (history.length === 0) {
      list.innerHTML = '<p class="empty-state">History will appear as you navigate.</p>';
      return;
    }
    list.innerHTML = history.slice(0, 15).map(h => {
      const ago = timeAgo(h.time);
      const title = h.title.replace(/Magento Admin/i, '').replace(/\|/g, '').trim() || 'Admin Page';
      return `
        <div class="history-item" data-url="${esc(h.url)}">
          <span>${esc(title)}</span>
          <span class="history-time">${ago}</span>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        chrome.tabs.update(currentTab.id, { url: item.dataset.url });
        window.close();
      });
    });
  }

  function timeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // ── Load Toggle States ──
  async function loadToggles() {
    const data = await chrome.storage.local.get(['minsarDarkMode', 'minsarCompactMode']);
    document.getElementById('toggle-dark').checked = data.minsarDarkMode || false;
    document.getElementById('toggle-compact').checked = data.minsarCompactMode || false;
  }

  // ── Settings ──
  function showSettings() {
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('settings-panel').classList.remove('hidden');
    loadEnvSettings();
  }

  function hideSettings() {
    document.getElementById('settings-panel').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
  }

  async function loadEnvSettings() {
    const data = await chrome.storage.local.get('minsarEnvSettings');
    const settings = data.minsarEnvSettings || {};
    document.querySelectorAll('.env-url').forEach(input => {
      const env = input.dataset.env;
      input.value = settings[env] || '';
    });
  }

  async function saveEnvSettings() {
    const settings = {};
    document.querySelectorAll('.env-url').forEach(input => {
      const env = input.dataset.env;
      const val = input.value.trim();
      if (val) settings[env] = val;
    });
    await chrome.storage.local.set({ minsarEnvSettings: settings });
    showToast('✅ Environment settings saved!', 'success');
  }

  // ── Toast ──
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  // ── Start ──
  init();
})();
