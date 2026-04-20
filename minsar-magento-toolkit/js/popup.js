/**
 * Minsar — Magento Admin Toolkit
 * Popup Controller
 *
 * This is the main logic for the extension popup UI.
 * It handles all 10 features:
 *   1. Omni-Search (Ctrl+K command palette)
 *   2. One-click cache flush
 *   3. Environment indicator (via settings)
 *   4. Order quick search
 *   5. Compact mode toggle
 *   6. Dark mode toggle
 *   7. Store info badge
 *   8. Smart bookmarks
 *   9. Activity history
 *  10. Keyboard shortcuts (handled by background.js)
 *
 * Architecture:
 *   - popup.js runs in the popup context (isolated from the page)
 *   - It communicates with the page via chrome.scripting.executeScript
 *     (for detection, cache flush, store info)
 *   - It communicates with detector.js via chrome.tabs.sendMessage
 *     (for dark mode, compact mode toggles)
 *   - Settings are stored in chrome.storage.local
 */
(function () {
  'use strict';

  /** @type {chrome.tabs.Tab} Current active tab */
  let currentTab = null;

  /** @type {string} Detected Magento admin base URL */
  let adminBaseUrl = '';

  /** @type {boolean} Whether current page is a Magento admin */
  let isMagento = false;

  /** @type {Array<{name: string, url: string}>} Scraped admin menu links with secret keys */
  let menuLinks = [];

  // ═══════════════════════════════════════════════════════════
  // Initialization
  // ═══════════════════════════════════════════════════════════

  /**
   * Initialize the popup — detect Magento, load data, bind events.
   */
  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Inject a detection function into the active tab to check if it's Magento admin
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: detectMagento
      });
      isMagento = result?.result?.isMagento || false;
      adminBaseUrl = result?.result?.baseUrl || '';
      menuLinks = result?.result?.menuLinks || [];
    } catch {
      isMagento = false;
    }

    // Show appropriate UI based on detection
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

  /**
   * Detect if the current page is a Magento 2 admin panel.
   * Also scrapes the admin menu links (which include secret keys).
   * @returns {{ isMagento: boolean, baseUrl: string, menuLinks: Array }}
   */
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
    const menuLinks = [];

    if (isMage) {
      // Try to extract BASE_URL from inline scripts (most reliable)
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.textContent.includes('BASE_URL')) {
          const match = s.textContent.match(/BASE_URL["']?\s*[:=]\s*["']([^"']+)["']/);
          if (match) { baseUrl = match[1]; break; }
        }
      }
      // Fallback: extract from current URL (first path segment is admin path)
      if (!baseUrl) {
        const url = window.location.href;
        const adminMatch = url.match(/(https?:\/\/[^/]+\/[^/]+)\//);
        if (adminMatch) baseUrl = adminMatch[1];
      }

      // Scrape admin menu links — these include the secret key in the URL
      // Top-level items link to "#", sub-menu items have real URLs
      document.querySelectorAll('.admin__menu a[href]').forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent.trim();
        if (href && text && href.startsWith('http') && !href.endsWith('#') && text.length > 0) {
          menuLinks.push({ name: text, url: href });
        }
      });
    }

    return { isMagento: isMage, baseUrl, menuLinks };
  }

  /**
   * Bind all UI event listeners.
   */
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

    // View Toggles
    document.getElementById('toggle-dark').addEventListener('change', toggleDarkMode);
    document.getElementById('toggle-compact').addEventListener('change', toggleCompactMode);

    // Bookmarks
    document.getElementById('btn-add-bookmark').addEventListener('click', addBookmark);

    // Settings
    document.getElementById('btn-settings').addEventListener('click', showSettings);
    document.getElementById('btn-back').addEventListener('click', hideSettings);
    document.getElementById('btn-save-env').addEventListener('click', saveEnvSettings);
  }

  // ═══════════════════════════════════════════════════════════
  // Feature 1: Omni-Search (Command Palette)
  // ═══════════════════════════════════════════════════════════

  /** @type {number} Currently highlighted search result index */
  let searchHighlight = -1;

  /**
   * Handle search input — query the config index and render results.
   */
  function handleOmniSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    const resultsEl = document.getElementById('search-results');

    // Require at least 2 characters to search
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

    // Attach click handlers to each result
    resultsEl.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => executeSearchResult(item));
    });
  }

  /**
   * Handle keyboard navigation in search results (↑/↓/Enter/Escape).
   */
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

  /**
   * Update visual highlight on search results.
   */
  function updateHighlight(items) {
    items.forEach((item, i) => {
      item.style.background = i === searchHighlight ? 'var(--bg-hover)' : '';
    });
  }

  /**
   * Search the MINSAR_INDEX and scraped menu links for matching items.
   * Menu links are prioritized because they have valid secret keys.
   * @param {string} query - Lowercase search query
   * @returns {Array} Matching items
   */
  function searchIndex(query) {
    const results = [];

    // Search scraped menu links first (these have valid URLs with secret keys)
    for (const link of menuLinks) {
      if (link.name.toLowerCase().includes(query)) {
        results.push({
          name: link.name,
          path: link.url, // Full URL with secret key
          icon: '📄',
          type: 'menu',
          keywords: ''
        });
      }
    }

    // Then search the pre-built index
    const all = [
      ...MINSAR_INDEX.pages.map(p => ({ ...p, type: 'page' })),
      ...MINSAR_INDEX.configs.map(c => ({ ...c, type: 'config' })),
      ...MINSAR_INDEX.actions.map(a => ({ ...a, type: 'action' }))
    ];

    for (const item of all) {
      const searchable = `${item.name} ${item.keywords || ''} ${item.path || ''}`.toLowerCase();
      if (searchable.includes(query)) {
        // Skip if we already have a menu link with the same name
        if (!results.some(r => r.name.toLowerCase() === item.name.toLowerCase())) {
          results.push(item);
        }
      }
    }

    // Sort: menu links first, then exact name matches, then by type
    results.sort((a, b) => {
      if (a.type === 'menu' && b.type !== 'menu') return -1;
      if (b.type === 'menu' && a.type !== 'menu') return 1;
      const aExact = a.name.toLowerCase().startsWith(query) ? 0 : 1;
      const bExact = b.name.toLowerCase().startsWith(query) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const typeOrder = { menu: 0, action: 1, page: 2, config: 3 };
      return (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4);
    });

    return results;
  }

  /**
   * Execute a search result — navigate to page or run action.
   */
  function executeSearchResult(item) {
    const type = item.dataset.type;
    const path = item.dataset.path;
    const action = item.dataset.action;

    if (type === 'action') {
      executeAction(action);
    } else if (type === 'menu' && path.startsWith('http')) {
      // Menu links have full URLs with secret keys — use directly
      chrome.tabs.update(currentTab.id, { url: path });
      window.close();
    } else if (path) {
      navigateToPath(path);
    }
  }

  /**
   * Execute a quick action from search results.
   */
  function executeAction(action) {
    switch (action) {
      case 'flush-all': flushCache('all'); break;
      case 'flush-config': flushCache('config'); break;
      case 'flush-layout': flushCache('layout'); break;
      case 'flush-fpc': flushCache('full_page'); break;
      case 'flush-block': flushCache('block_html'); break;
      case 'flush-translate': flushCache('translate'); break;
      case 'toggle-dark': document.getElementById('toggle-dark').click(); break;
      case 'toggle-compact': document.getElementById('toggle-compact').click(); break;
      case 'add-bookmark': addBookmark(); break;
    }
  }

  /**
   * Navigate to a Magento admin page.
   *
   * Magento admin URLs require a secret key (/key/{hash}/) when
   * "Add Secret Key to URLs" is enabled (default). We can't generate
   * these keys from the extension, so we:
   *   1. First try to match against scraped menu links (which have valid keys)
   *   2. Fall back to direct URL construction (works if secret key is disabled)
   *
   * @param {string} path - Path from config-index (starts with /admin/)
   */
  function navigateToPath(path) {
    // Try to find a matching menu link (these have valid secret keys)
    const pathKeywords = path.replace(/\//g, ' ').replace(/admin/g, '').trim().split(/\s+/);
    const matchedLink = menuLinks.find(link => {
      const linkUrl = link.url.toLowerCase();
      return pathKeywords.every(kw => kw.length > 2 && linkUrl.includes(kw));
    });

    if (matchedLink) {
      // Use the menu link URL (includes secret key)
      chrome.tabs.update(currentTab.id, { url: matchedLink.url });
    } else {
      // Fallback: construct URL directly (works if secret key is disabled)
      const url = currentTab.url;
      const match = url.match(/(https?:\/\/[^/]+\/[^/]+)\//);
      if (match) {
        const cleanPath = path.replace(/^\/admin/, '');
        chrome.tabs.update(currentTab.id, { url: match[1] + cleanPath });
      } else {
        const origin = new URL(url).origin;
        chrome.tabs.update(currentTab.id, { url: origin + path });
      }
    }
    window.close();
  }

  // ═══════════════════════════════════════════════════════════
  // Feature 2: One-Click Cache Flush
  // ═══════════════════════════════════════════════════════════

  /**
   * Flush a specific cache type or all caches.
   * Injects executeCacheFlush into the page context via executeScript.
   * @param {string} type - Cache type ID ('all', 'config', 'layout', etc.)
   */
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

      btn.classList.remove('loading');
      btn.classList.add('success');
      showToast(`✅ ${type === 'all' ? 'All caches' : type + ' cache'} flushed!`, 'success');
      setTimeout(() => btn.classList.remove('success'), 2000);
    } catch (err) {
      btn.classList.remove('loading');
      showToast(`❌ Failed: ${err.message}`, 'error');
    }
  }

  /**
   * Execute cache flush in the PAGE context (not popup).
   * This function is serialized and injected via chrome.scripting.executeScript.
   *
   * Magento cache controller routes:
   *   - FlushAll:     POST /{admin}/admin/cache/flushAll/     (flushes all cache storage)
   *   - MassRefresh:  POST /{admin}/admin/cache/massRefresh/  (refreshes specific cache types)
   *
   * Both require form_key for CSRF validation.
   *
   * @param {string} type - 'all' for FlushAll, or a cache type ID for MassRefresh
   */
  function executeCacheFlush(type) {
    // Get CSRF token from hidden input (Magento puts this in every admin page)
    const formKey = document.querySelector('input[name="form_key"]')?.value
      || document.querySelector('meta[name="form_key"]')?.content;

    if (!formKey) return;

    // Detect admin base URL from current page path
    // e.g., /admin/dashboard/index/key/xxx/ → admin base = https://domain.com/admin
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const adminPath = pathParts[0] || 'admin';
    const adminBase = `${window.location.origin}/${adminPath}`;

    if (type === 'all') {
      // FlushAll — flushes entire cache storage
      const body = new URLSearchParams();
      body.append('form_key', formKey);
      fetch(`${adminBase}/admin/cache/flushAll/`, {
        method: 'POST',
        body: body,
        credentials: 'same-origin'
      }).catch(() => {});
    } else {
      // MassRefresh — refreshes only the specified cache type
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

  // ═══════════════════════════════════════════════════════════
  // Feature 4: Order Quick Search
  // ═══════════════════════════════════════════════════════════

  /**
   * Navigate to the orders grid with a search filter applied.
   * Uses Magento's built-in grid search parameter.
   */
  function handleOrderSearch() {
    const query = document.getElementById('order-search').value.trim();
    if (!query) return;

    const searchParam = encodeURIComponent(query);
    navigateToPath(`/admin/sales/order/?search=${searchParam}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Feature 5 & 6: Dark Mode & Compact Mode
  // ═══════════════════════════════════════════════════════════

  /**
   * Toggle dark mode — saves preference and sends message to content script.
   * The content script (detector.js) handles the actual CSS injection.
   */
  async function toggleDarkMode(e) {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ minsarDarkMode: enabled });
    chrome.tabs.sendMessage(currentTab.id, { action: 'apply-dark', enabled });
    showToast(enabled ? '🌙 Dark mode enabled' : '☀️ Light mode restored', 'info');
  }

  /**
   * Toggle compact mode — saves preference and sends message to content script.
   * The content script (detector.js) handles the actual CSS injection.
   */
  async function toggleCompactMode(e) {
    const enabled = e.target.checked;
    await chrome.storage.local.set({ minsarCompactMode: enabled });
    chrome.tabs.sendMessage(currentTab.id, { action: 'apply-compact', enabled });
    showToast(enabled ? '📐 Compact mode enabled' : '📐 Compact mode disabled', 'info');
  }

  // ═══════════════════════════════════════════════════════════
  // Feature 7: Store Info Badge
  // ═══════════════════════════════════════════════════════════

  /**
   * Load Magento version from the admin page footer and display in header badge.
   */
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
    } catch { /* ignore — non-critical feature */ }
  }

  /**
   * Extract Magento version from the admin page footer.
   * Injected into the page via executeScript.
   * @returns {{ version: string }}
   */
  function getStoreInfo() {
    let version = '';
    const footer = document.querySelector('.admin__footer, .page-footer');
    if (footer) {
      const match = footer.textContent.match(/(\d+\.\d+\.\d+[\w.-]*)/);
      if (match) version = match[1];
    }
    return { version };
  }

  // ═══════════════════════════════════════════════════════════
  // Feature 8: Smart Bookmarks
  // ═══════════════════════════════════════════════════════════

  /**
   * Load saved bookmarks from chrome.storage.
   */
  async function loadBookmarks() {
    const data = await chrome.storage.local.get('minsarBookmarks');
    const bookmarks = data.minsarBookmarks || [];
    renderBookmarks(bookmarks);
  }

  /**
   * Escape HTML to prevent XSS when inserting user-generated content.
   * @param {string} str - Raw string
   * @returns {string} HTML-escaped string
   */
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /**
   * Render bookmarks list in the popup.
   * @param {Array<{url: string, title: string}>} bookmarks
   */
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

    // Navigate on click
    list.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) return;
        chrome.tabs.update(currentTab.id, { url: item.dataset.url });
        window.close();
      });
    });

    // Remove on ✕ click
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

  /**
   * Add the current page as a bookmark.
   */
  async function addBookmark() {
    const data = await chrome.storage.local.get('minsarBookmarks');
    const bookmarks = data.minsarBookmarks || [];

    // Prevent duplicates
    if (bookmarks.some(b => b.url === currentTab.url)) {
      showToast('Already bookmarked', 'info');
      return;
    }

    // Clean up the page title (remove "Magento Admin" prefix)
    let title = currentTab.title || 'Untitled';
    title = title.replace(/Magento Admin/i, '').replace(/\|/g, '').trim() || 'Admin Page';

    bookmarks.push({ url: currentTab.url, title });
    await chrome.storage.local.set({ minsarBookmarks: bookmarks });
    renderBookmarks(bookmarks);
    showToast('📌 Page bookmarked!', 'success');
  }

  // ═══════════════════════════════════════════════════════════
  // Feature 9: Activity History
  // ═══════════════════════════════════════════════════════════

  /**
   * Load page visit history from chrome.storage.
   * History is tracked by the content script (detector.js).
   */
  async function loadHistory() {
    const data = await chrome.storage.local.get('minsarHistory');
    const history = data.minsarHistory || [];
    renderHistory(history);
  }

  /**
   * Render recent page history in the popup.
   * @param {Array<{url: string, title: string, time: number}>} history
   */
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

  /**
   * Convert a timestamp to a human-readable relative time string.
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} e.g., "just now", "5m ago", "2h ago", "1d ago"
   */
  function timeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // ═══════════════════════════════════════════════════════════
  // Toggle State Persistence
  // ═══════════════════════════════════════════════════════════

  /**
   * Load saved toggle states (dark mode, compact mode) from storage
   * and update the checkbox UI to match.
   */
  async function loadToggles() {
    const data = await chrome.storage.local.get(['minsarDarkMode', 'minsarCompactMode']);
    document.getElementById('toggle-dark').checked = data.minsarDarkMode || false;
    document.getElementById('toggle-compact').checked = data.minsarCompactMode || false;
  }

  // ═══════════════════════════════════════════════════════════
  // Settings Panel
  // ═══════════════════════════════════════════════════════════

  /** Show the settings panel, hide main content. */
  function showSettings() {
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('settings-panel').classList.remove('hidden');
    loadEnvSettings();
  }

  /** Hide settings panel, show main content. */
  function hideSettings() {
    document.getElementById('settings-panel').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
  }

  /** Load saved environment URL mappings into the settings form. */
  async function loadEnvSettings() {
    const data = await chrome.storage.local.get('minsarEnvSettings');
    const settings = data.minsarEnvSettings || {};
    document.querySelectorAll('.env-url').forEach(input => {
      const env = input.dataset.env;
      input.value = settings[env] || '';
    });
  }

  /** Save environment URL mappings from the settings form. */
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

  // ═══════════════════════════════════════════════════════════
  // Toast Notifications
  // ═══════════════════════════════════════════════════════════

  /**
   * Show a brief toast notification at the bottom of the popup.
   * @param {string} message - Toast message text
   * @param {'success'|'error'|'info'} type - Toast style
   */
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  // ═══════════════════════════════════════════════════════════
  // Start
  // ═══════════════════════════════════════════════════════════
  init();
})();
