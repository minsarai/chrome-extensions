/**
 * Minsar — Magento Admin Toolkit
 * Content Script (detector.js)
 *
 * Injected into every page. Detects Magento 2 admin and provides:
 * dark mode, compact mode, environment bar, history tracking,
 * keyboard shortcuts, omni-search overlay, cache flush.
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // Message Listener — registered FIRST (before detection)
  // ═══════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.action) {
      case 'toggle-dark':
        chrome.storage.local.get('minsarDarkMode', (data) => {
          const next = !data.minsarDarkMode;
          chrome.storage.local.set({ minsarDarkMode: next });
          applyDarkMode(next);
        });
        break;
      case 'apply-dark': applyDarkMode(msg.enabled); break;
      case 'apply-compact': applyCompactMode(msg.enabled); break;
      case 'flush-all': flushAllCaches(); break;
      case 'open-omni-search': openOmniSearchOverlay(); break;
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Magento Detection
  // ═══════════════════════════════════════════════════════════

  function isMagentoAdmin() {
    return !!(
      document.querySelector('.admin__menu') ||
      document.body?.className?.includes('adminhtml-') ||
      document.getElementById('html-body')?.className?.includes('adminhtml-') ||
      document.body?.classList?.contains('admin__scope') ||
      document.getElementById('html-body')?.classList?.contains('admin__scope')
    );
  }

  function initIfMagento() {
    if (!isMagentoAdmin()) return false;
    trackPageVisit();
    applySavedSettings();
    injectEnvironmentBar();
    return true;
  }

  if (!initIfMagento()) {
    setTimeout(initIfMagento, 1500);
  }

  // ═══════════════════════════════════════════════════════════
  // History Tracking
  // ═══════════════════════════════════════════════════════════

  function trackPageVisit() {
    const entry = { url: window.location.href, title: document.title, time: Date.now() };
    chrome.storage.local.get('minsarHistory', (data) => {
      let history = data.minsarHistory || [];
      if (history.length > 0 && history[0].url === entry.url) return;
      history.unshift(entry);
      history = history.slice(0, 30);
      chrome.storage.local.set({ minsarHistory: history });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Apply Saved Settings
  // ═══════════════════════════════════════════════════════════

  function applySavedSettings() {
    chrome.storage.local.get(['minsarDarkMode', 'minsarCompactMode'], (data) => {
      if (data.minsarDarkMode) applyDarkMode(true);
      if (data.minsarCompactMode) applyCompactMode(true);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Environment Bar
  // ═══════════════════════════════════════════════════════════

  function injectEnvironmentBar() {
    chrome.storage.local.get('minsarEnvSettings', (data) => {
      const settings = data.minsarEnvSettings || {};
      const hostname = window.location.hostname;
      let env = null;

      for (const [key, value] of Object.entries(settings)) {
        if (hostname === value || hostname === 'www.' + value) { env = key; break; }
      }
      if (!env) {
        for (const [key, value] of Object.entries(settings)) {
          if (hostname.includes(value) && value.length > 3) { env = key; break; }
        }
      }
      if (!env) return;

      const colors = {
        dev: { bg: '#2ecc71', text: '#000', label: '🟢 DEVELOPMENT' },
        staging: { bg: '#f39c12', text: '#000', label: '🟡 STAGING' },
        production: { bg: '#e74c3c', text: '#fff', label: '🔴 PRODUCTION — Be careful!' }
      };
      const c = colors[env];
      if (!c) return;

      const bar = document.createElement('div');
      bar.id = 'minsar-env-bar';
      bar.style.cssText = `position:fixed;top:0;left:0;right:0;height:28px;background:${c.bg};color:${c.text};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:-apple-system,sans-serif;letter-spacing:1px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.2);`;
      bar.textContent = c.label;
      document.body.prepend(bar);
      document.body.style.paddingTop = '28px';
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Dark Mode — NO .admin__scope prefix (not present on all installs)
  // Uses #html-body and generic selectors instead
  // ═══════════════════════════════════════════════════════════

  function applyDarkMode(enabled) {
    const id = 'minsar-dark-mode';
    let el = document.getElementById(id);
    if (enabled) {
      if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
      // Professional dark theme — covers every Magento 2 admin element
      // Uses #html-body for highest specificity without !important where possible
      el.textContent = `
        /* ── Base ── */
        #html-body, body, .page-wrapper, .page-content, .page-columns {
          background-color: #1e1e2e !important; color: #cdd6f4 !important; }

        /* ── Header ── */
        .page-header { background: #181825 !important; border-bottom: 1px solid #313244 !important; }
        .page-header .admin-user .admin__action-dropdown { background: #1e1e2e !important; }
        .page-header .logo { filter: brightness(0.9); }

        /* ── Left Menu ── */
        .admin__menu { background: #11111b !important; }
        .admin__menu li a { color: #a6adc8 !important; }
        .admin__menu li a:hover { color: #cba6f7 !important; background: #1e1e2e !important; }
        .admin__menu li._active > a, .admin__menu li._current > a { color: #cba6f7 !important; background: #1e1e2e !important; }
        .admin__menu .submenu, .admin__menu ul ul, .admin__menu .level-1 { background: #181825 !important; }
        .admin__menu .submenu li a { color: #a6adc8 !important; }
        .admin__menu .submenu li a:hover { color: #cba6f7 !important; }

        /* ── Page Title & Actions ── */
        .page-title, h1, h2, h3, h4, h5 { color: #cdd6f4 !important; }
        .page-title-wrapper { background: transparent !important; }
        .page-main-actions { background: #1e1e2e !important; border-bottom: 1px solid #313244 !important; }

        /* ── Data Grids (Orders, Products, Customers) ── */
        .admin__data-grid-outer-wrap { background: #1e1e2e !important; }
        .admin__data-grid-wrap { background: #1e1e2e !important; border: 1px solid #313244 !important; }
        .admin__data-grid-header { background: #181825 !important; border-bottom: 1px solid #313244 !important; }
        .admin__data-grid-header-row { background: #181825 !important; }
        .admin__data-grid-filters-wrap { background: #181825 !important; }
        .admin__data-grid-action-columns { background: #181825 !important; }
        table.data-grid { background: #1e1e2e !important; }
        table.data-grid thead tr { background: #181825 !important; }
        table.data-grid th { background: #181825 !important; color: #a6adc8 !important; border-color: #313244 !important; }
        table.data-grid td { background: #1e1e2e !important; color: #cdd6f4 !important; border-color: #313244 !important; }
        table.data-grid tr:hover td { background: #313244 !important; }
        table.data-grid tr._odd-row td { background: #1e1e2e !important; }
        table.data-grid tr._even-row td { background: #181825 !important; }
        .data-grid-cell-content { color: #cdd6f4 !important; }

        /* ── Grid Toolbar, Pager, Filters ── */
        .admin__data-grid-pager { background: #181825 !important; border-top: 1px solid #313244 !important; }
        .admin__data-grid-pager-wrap { background: #181825 !important; }
        .admin__control-support-text { color: #a6adc8 !important; }
        .action-select-wrap .action-select { background: #313244 !important; color: #cdd6f4 !important; border-color: #45475a !important; }
        .admin__data-grid-filters .admin__action-multiselect { background: #1e1e2e !important; }

        /* ── Form Inputs ── */
        .admin__control-text, .admin__control-textarea, .admin__control-select,
        input[type="text"], input[type="email"], input[type="password"],
        input[type="number"], input[type="search"], input[type="url"],
        input[type="tel"], input[type="date"], textarea, select {
          background: #313244 !important; color: #cdd6f4 !important;
          border-color: #45475a !important; }
        input::placeholder, textarea::placeholder { color: #6c7086 !important; }

        /* ── Fieldsets, Sections, Panels ── */
        .admin__fieldset { border-color: #313244 !important; }
        .admin__field { border-color: #313244 !important; }
        .admin__page-section { background: #1e1e2e !important; border: 1px solid #313244 !important; }
        .admin__page-nav { background: #181825 !important; }
        .admin__page-nav-item { border-color: #313244 !important; }
        .admin__page-nav-item-link { color: #a6adc8 !important; }
        .admin__page-nav-item._active .admin__page-nav-item-link { color: #cba6f7 !important; }

        /* ── Buttons ── */
        .action-default, .action-secondary { background: #313244 !important; color: #cdd6f4 !important; border-color: #45475a !important; }
        .action-default:hover, .action-secondary:hover { background: #45475a !important; }
        .action-primary { background: #cba6f7 !important; color: #1e1e2e !important; border-color: #cba6f7 !important; }
        .action-primary:hover { background: #b4befe !important; }

        /* ── Labels, Links, Text ── */
        label, .admin__field-label span, .admin__field-label { color: #a6adc8 !important; }
        a { color: #89b4fa !important; }
        a:hover { color: #b4befe !important; }
        .admin__field-note { color: #6c7086 !important; }

        /* ── Dropdowns & Modals ── */
        .admin__action-dropdown-menu { background: #1e1e2e !important; border: 1px solid #313244 !important; }
        .admin__action-dropdown-menu li a { color: #cdd6f4 !important; }
        .admin__action-dropdown-menu li a:hover { background: #313244 !important; }
        .modal-popup .modal-inner-wrap { background: #1e1e2e !important; color: #cdd6f4 !important; }
        .modal-popup .modal-header { background: #181825 !important; border-bottom: 1px solid #313244 !important; }
        .modal-popup .modal-footer { background: #181825 !important; border-top: 1px solid #313244 !important; }

        /* ── Messages ── */
        .message-system-inner { background: #313244 !important; color: #cdd6f4 !important; }
        .message-system-inner a { color: #89b4fa !important; }
        .message { border-radius: 6px !important; }
        .message-warning { background: #45475a !important; color: #f9e2af !important; }
        .message-error { background: #45475a !important; color: #f38ba8 !important; }
        .message-success { background: #45475a !important; color: #a6e3a1 !important; }
        .message-notice { background: #45475a !important; color: #89b4fa !important; }

        /* ── Dashboard ── */
        .dashboard-container { background: #1e1e2e !important; }
        .dashboard-inner { background: #1e1e2e !important; }
        .dashboard-item { background: #181825 !important; border: 1px solid #313244 !important; border-radius: 8px !important; }
        .dashboard-item-primary { background: #181825 !important; }
        .dashboard-item-content { background: #181825 !important; color: #cdd6f4 !important; }
        .dashboard-item-title { color: #cdd6f4 !important; background: #181825 !important; border-bottom: 1px solid #313244 !important; padding: 12px 15px !important; }
        .dashboard-totals { background: #181825 !important; }
        .dashboard-totals-list { background: #181825 !important; }
        .dashboard-totals-item { background: #181825 !important; border-color: #313244 !important; }
        .dashboard-totals-label { color: #a6adc8 !important; }
        .dashboard-totals-value { color: #cdd6f4 !important; }
        .dashboard-totals-decimals { color: #a6adc8 !important; }
        .dashboard-sales-value { color: #cdd6f4 !important; }
        .dashboard-sales-decimals { color: #a6adc8 !important; }
        .dashboard-diagram { background: #181825 !important; }
        .dashboard-diagram-container { background: #181825 !important; }
        .dashboard-diagram-switcher { background: #181825 !important; }
        .dashboard-diagram-tab-content { background: #181825 !important; }
        .dashboard-diagram-disabled { background: #181825 !important; color: #a6adc8 !important; }
        .dashboard-store-stats { background: #181825 !important; }
        .dashboard-store-stats-content { background: #181825 !important; }
        .dashboard-secondary { background: #1e1e2e !important; }
        .dashboard-main { background: #1e1e2e !important; }
        .dashboard-data, .admin__table-primary { background: #181825 !important; color: #cdd6f4 !important; }
        .admin__table-primary th { background: #11111b !important; color: #a6adc8 !important; border-color: #313244 !important; }
        .admin__table-primary td { background: #181825 !important; color: #cdd6f4 !important; border-color: #313244 !important; }
        .admin__table-secondary th { background: #11111b !important; color: #a6adc8 !important; border-color: #313244 !important; }
        .admin__table-secondary td { background: #181825 !important; color: #cdd6f4 !important; border-color: #313244 !important; }
        .left-col-block { background: #181825 !important; border: 1px solid #313244 !important; border-radius: 8px !important; }
        .searches-results { background: #181825 !important; }
        .switcher { background: #181825 !important; color: #cdd6f4 !important; }
        .page-actions { background: #1e1e2e !important; }
        .page-actions-inner { background: #1e1e2e !important; }
        .page-actions-buttons { background: #1e1e2e !important; }

        /* ── Tabs ── */
        .ui-tabs-nav { background: #181825 !important; border-color: #313244 !important; }
        .ui-tabs-nav li a { color: #a6adc8 !important; }
        .ui-tabs-nav li.ui-tabs-active a { color: #cba6f7 !important; }
        .ui-tabs-panel { background: #1e1e2e !important; }

        /* ── Footer ── */
        .page-footer, .admin__footer { background: #11111b !important; color: #6c7086 !important; border-top: 1px solid #313244 !important; }

        /* ── Scrollbars ── */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1e1e2e; }
        ::-webkit-scrollbar-thumb { background: #45475a; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #585b70; }

        /* ── Misc ── */
        .admin__control-support-text, .empty-text, .no-data-msg { color: #6c7086 !important; }
        hr { border-color: #313244 !important; }
        .separator { border-color: #313244 !important; }
        .col-period, .col-name, .col-id { color: #cdd6f4 !important; }
      `;
    } else if (el) { el.remove(); }
  }

  // ═══════════════════════════════════════════════════════════
  // Compact Mode
  // ═══════════════════════════════════════════════════════════

  function applyCompactMode(enabled) {
    const id = 'minsar-compact-mode';
    let el = document.getElementById(id);
    if (enabled) {
      if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
      el.textContent = `
        .page-header { min-height: 40px !important; padding: 4px 16px !important; }
        .page-header .logo { height: 28px !important; }
        .page-title-wrapper { padding: 8px 0 !important; margin: 0 !important; }
        .page-title { font-size: 18px !important; margin: 0 !important; }
        .page-main-actions { padding: 8px 16px !important; margin: 0 !important; }
        .admin__data-grid-header { padding: 8px !important; }
        table.data-grid td, table.data-grid th { padding: 6px 10px !important; font-size: 12px !important; }
        .admin__data-grid-pager { padding: 4px 8px !important; }
        .page-content { padding: 8px 16px !important; }
        .admin__fieldset { padding: 8px !important; }
        .admin__field { padding: 4px 0 !important; }
        .admin__page-section { margin-bottom: 8px !important; padding: 8px !important; }
        .page-wrapper > .page-content { padding-top: 0 !important; }
      `;
    } else if (el) { el.remove(); }
  }

  // ═══════════════════════════════════════════════════════════
  // Cache Flush (Ctrl+Shift+C)
  // ═══════════════════════════════════════════════════════════

  function flushAllCaches() {
    const formKey = document.querySelector('input[name="form_key"]')?.value;
    if (!formKey) return;

    // URL structure: http://domain.com/admin/admin/cache/flushAll/
    // First /admin = custom admin path, second /admin = route frontName
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const adminPath = pathParts[0] || 'admin';
    const adminBase = `${window.location.origin}/${adminPath}`;

    const body = new URLSearchParams();
    body.append('form_key', formKey);

    fetch(`${adminBase}/admin/cache/flushAll/`, {
      method: 'POST', body: body, credentials: 'same-origin'
    }).then(() => {
      const n = document.createElement('div');
      n.textContent = '✅ Minsar: All caches flushed!';
      n.style.cssText = 'position:fixed;top:40px;right:20px;background:#2ecc71;color:#000;padding:10px 20px;border-radius:8px;z-index:999999;font-family:sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 3000);
    }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════
  // Omni-Search Overlay (Ctrl+Shift+K)
  // ═══════════════════════════════════════════════════════════

  function openOmniSearchOverlay() {
    if (document.getElementById('minsar-omni-overlay')) {
      document.getElementById('minsar-omni-overlay').remove();
      return;
    }

    // Scrape REAL menu links from the page (they have valid secret keys)
    const realLinks = [];
    document.querySelectorAll('.admin__menu a[href]').forEach(a => {
      const href = a.getAttribute('href');
      const text = a.textContent.trim();
      if (href && text && href.startsWith('http') && !href.endsWith('#') && text.length > 0) {
        realLinks.push({ name: text, url: href, icon: '📄' });
      }
    });

    // Deduplicate by name
    const seen = new Set();
    const searchItems = realLinks.filter(l => {
      if (seen.has(l.name) || l.name.length === 0) return false;
      seen.add(l.name);
      return true;
    });

    const overlay = document.createElement('div');
    overlay.id = 'minsar-omni-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:15vh;font-family:-apple-system,sans-serif;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;width:560px;max-height:400px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,0.5);';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '⚡ Search pages...';
    input.style.cssText = 'width:100%;padding:16px 20px;background:transparent;border:none;border-bottom:1px solid #2a2a4a;color:#e0e0e0;font-size:16px;outline:none;box-sizing:border-box;';

    const resultsDiv = document.createElement('div');
    resultsDiv.style.cssText = 'max-height:320px;overflow-y:auto;';

    box.appendChild(input);
    box.appendChild(resultsDiv);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();

    let hi = -1;

    function render(q) {
      const query = q.toLowerCase();
      const matches = query.length < 1
        ? searchItems.slice(0, 10)
        : searchItems.filter(i => i.name.toLowerCase().includes(query)).slice(0, 10);

      resultsDiv.innerHTML = matches.map((m, i) => `
        <div data-idx="${i}" style="padding:10px 20px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2a2a4a;color:#e0e0e0;font-size:14px;background:${i === hi ? '#0f3460' : 'transparent'};">
          <span style="font-size:16px;width:24px;text-align:center;">${m.icon}</span>
          <span>${m.name}</span>
        </div>
      `).join('') || '<div style="padding:20px;text-align:center;color:#8892a4;">No results</div>';

      resultsDiv.querySelectorAll('[data-idx]').forEach(el => {
        el.addEventListener('click', () => {
          const match = matches[parseInt(el.dataset.idx)];
          if (match) window.location.href = match.url;
        });
        el.addEventListener('mouseenter', () => { el.style.background = '#0f3460'; });
        el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
      });
    }

    render('');

    input.addEventListener('input', () => { hi = -1; render(input.value.trim()); });
    input.addEventListener('keydown', (e) => {
      const items = resultsDiv.querySelectorAll('[data-idx]');
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, items.length - 1); render(input.value.trim()); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); render(input.value.trim()); }
      else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); items[hi]?.click(); }
      else if (e.key === 'Escape') { overlay.remove(); }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }
})();
