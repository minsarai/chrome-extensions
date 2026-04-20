// Minsar — Content Script (injected into Magento admin pages)
(function () {
  'use strict';

  // Only run on Magento admin pages
  const isMagento = !!(
    document.querySelector('.admin__menu') ||
    document.querySelector('#html-body.admin__scope') ||
    document.body?.classList?.contains('admin__scope')
  );

  if (!isMagento) return;

  // ── Track History ──
  trackPageVisit();

  // ── Apply Saved Settings ──
  applySavedSettings();

  // ── Inject Environment Bar ──
  injectEnvironmentBar();

  // ── Listen for Commands from Background ──
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggle-dark') {
      chrome.storage.local.get('minsarDarkMode', (data) => {
        const next = !data.minsarDarkMode;
        chrome.storage.local.set({ minsarDarkMode: next });
        applyDarkMode(next);
      });
    }
    if (msg.action === 'flush-all') {
      flushAllCaches();
    }
    if (msg.action === 'open-omni-search') {
      openOmniSearchOverlay();
    }
  });

  // ── Track Page Visit ──
  function trackPageVisit() {
    const entry = {
      url: window.location.href,
      title: document.title,
      time: Date.now()
    };

    chrome.storage.local.get('minsarHistory', (data) => {
      let history = data.minsarHistory || [];
      // Don't add duplicate consecutive pages
      if (history.length > 0 && history[0].url === entry.url) return;
      history.unshift(entry);
      history = history.slice(0, 30); // Keep last 30
      chrome.storage.local.set({ minsarHistory: history });
    });
  }

  // ── Apply Saved Settings ──
  function applySavedSettings() {
    chrome.storage.local.get(['minsarDarkMode', 'minsarCompactMode'], (data) => {
      if (data.minsarDarkMode) applyDarkMode(true);
      if (data.minsarCompactMode) applyCompactMode(true);
    });
  }

  // ── Environment Bar ──
  function injectEnvironmentBar() {
    chrome.storage.local.get('minsarEnvSettings', (data) => {
      const settings = data.minsarEnvSettings || {};
      const hostname = window.location.hostname;
      let env = null;

      for (const [key, value] of Object.entries(settings)) {
        // Exact match or subdomain match — prevents "mystore.com" matching "staging.mystore.com"
        if (hostname === value || hostname === 'www.' + value) {
          env = key;
          break;
        }
      }

      // If no exact match, try contains as fallback (for partial entries like "staging")
      if (!env) {
        for (const [key, value] of Object.entries(settings)) {
          if (hostname.includes(value) && value.length > 3) {
            env = key;
            break;
          }
        }
      }

      if (!env) return;

      const colors = {
        dev: { bg: '#2ecc71', text: '#000', label: '🟢 DEVELOPMENT' },
        staging: { bg: '#f39c12', text: '#000', label: '🟡 STAGING' },
        production: { bg: '#e74c3c', text: '#fff', label: '🔴 PRODUCTION — Be careful!' }
      };

      const config = colors[env];
      if (!config) return;

      const bar = document.createElement('div');
      bar.id = 'minsar-env-bar';
      bar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 28px;
        background: ${config.bg};
        color: ${config.text};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 1px;
        z-index: 99999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      bar.textContent = config.label;

      document.body.prepend(bar);
      document.body.style.paddingTop = '28px';
    });
  }

  // ── Dark Mode (injected version) ──
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
        .admin__scope label, .admin__scope .admin__field-label span { color: #c0c0c0 !important; }
        .admin__scope a { color: #e94560 !important; }
        .admin__scope .page-header { background: #0f0f23 !important; }
      `;
    } else if (style) {
      style.remove();
    }
  }

  // ── Compact Mode (injected version) ──
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
        .admin__scope .admin__page-section { margin-bottom: 8px !important; padding: 8px !important; }
        .admin__scope .page-wrapper > .page-content { padding-top: 0 !important; }
      `;
    } else if (style) {
      style.remove();
    }
  }

  // ── Flush All Caches (from keyboard shortcut) ──
  function flushAllCaches() {
    const formKey = document.querySelector('input[name="form_key"]')?.value
      || document.querySelector('meta[name="form_key"]')?.content;

    if (!formKey) return;

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const adminPath = pathParts[0] || 'admin';
    const adminBase = `${window.location.origin}/${adminPath}`;

    // FlushAll still needs form_key for CSRF validation
    const body = new URLSearchParams();
    body.append('form_key', formKey);

    fetch(`${adminBase}/admin/cache/flushAll/`, {
      method: 'POST',
      body: body,
      credentials: 'same-origin'
    }).then(() => {
      const notif = document.createElement('div');
      notif.textContent = '✅ Minsar: All caches flushed!';
      notif.style.cssText = 'position:fixed;top:40px;right:20px;background:#2ecc71;color:#000;padding:10px 20px;border-radius:8px;z-index:999999;font-family:sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);
    }).catch(() => {});
  }

  // ── Omni Search Overlay (Ctrl+Shift+K from any page) ──
  function openOmniSearchOverlay() {
    if (document.getElementById('minsar-omni-overlay')) {
      document.getElementById('minsar-omni-overlay').remove();
      return;
    }

    // Detect admin base for navigation
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const adminPath = pathParts[0] || 'admin';
    const adminBase = `${window.location.origin}/${adminPath}`;

    // Inline search index (top items only for overlay)
    const searchItems = [
      { name: 'Dashboard', path: '/dashboard/', icon: '📊', keywords: 'home overview' },
      { name: 'Orders', path: '/sales/order/', icon: '📦', keywords: 'sales order list' },
      { name: 'Products', path: '/catalog/product/', icon: '🛍️', keywords: 'catalog product list' },
      { name: 'Categories', path: '/catalog/category/', icon: '📁', keywords: 'catalog category' },
      { name: 'Customers', path: '/customer/index/', icon: '👥', keywords: 'customer list' },
      { name: 'Cache Management', path: '/admin/cache/', icon: '🗑️', keywords: 'cache flush clean' },
      { name: 'Configuration', path: '/admin/system_config/', icon: '⚙️', keywords: 'system config settings' },
      { name: 'Index Management', path: '/indexer/indexer/list/', icon: '🔄', keywords: 'index reindex' },
      { name: 'CMS Pages', path: '/cms/page/', icon: '📝', keywords: 'cms page content' },
      { name: 'Cart Price Rules', path: '/sales_rule/promo_quote/', icon: '🏷️', keywords: 'promo coupon discount' },
      { name: 'Payment Methods', path: '/admin/system_config/edit/section/payment/', icon: '💳', keywords: 'payment gateway checkout' },
      { name: 'Shipping Methods', path: '/admin/system_config/edit/section/carriers/', icon: '🚚', keywords: 'shipping carrier delivery' },
      { name: 'Tax Rules', path: '/tax/rule/', icon: '💲', keywords: 'tax vat rate' },
      { name: 'Admin Users', path: '/admin/user/', icon: '👤', keywords: 'admin user role' },
      { name: 'Developer Config', path: '/admin/system_config/edit/section/dev/', icon: '🛠️', keywords: 'developer debug template hints' },
      { name: 'Invoices', path: '/sales/invoice/', icon: '🧾', keywords: 'invoice billing' },
      { name: 'Credit Memos', path: '/sales/creditmemo/', icon: '💳', keywords: 'refund return' },
      { name: 'Import', path: '/admin/import/', icon: '📥', keywords: 'import csv data' },
      { name: 'Export', path: '/admin/export/', icon: '📤', keywords: 'export csv data' },
      { name: 'URL Rewrites', path: '/admin/url_rewrite/', icon: '🔗', keywords: 'url redirect seo' },
    ];

    const overlay = document.createElement('div');
    overlay.id = 'minsar-omni-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); z-index: 999999;
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 15vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px;
      width: 560px; max-height: 400px; overflow: hidden;
      box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '⚡ Search pages, configs, actions...';
    input.style.cssText = `
      width: 100%; padding: 16px 20px; background: transparent; border: none;
      border-bottom: 1px solid #2a2a4a; color: #e0e0e0; font-size: 16px; outline: none;
      box-sizing: border-box;
    `;

    const resultsDiv = document.createElement('div');
    resultsDiv.style.cssText = 'max-height: 320px; overflow-y: auto;';

    box.appendChild(input);
    box.appendChild(resultsDiv);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();

    let highlightIdx = -1;

    function renderResults(query) {
      const q = query.toLowerCase();
      const matches = q.length < 2 ? searchItems.slice(0, 8) : searchItems.filter(item => {
        const text = `${item.name} ${item.keywords}`.toLowerCase();
        return text.includes(q);
      }).slice(0, 10);

      resultsDiv.innerHTML = matches.map((m, i) => `
        <div class="minsar-result" data-idx="${i}" style="
          padding: 10px 20px; cursor: pointer; display: flex; align-items: center; gap: 10px;
          border-bottom: 1px solid #2a2a4a; color: #e0e0e0; font-size: 14px;
          background: ${i === highlightIdx ? '#0f3460' : 'transparent'};
        ">
          <span style="font-size: 16px; width: 24px; text-align: center;">${m.icon}</span>
          <span>${m.name}</span>
        </div>
      `).join('') || '<div style="padding: 20px; text-align: center; color: #8892a4;">No results</div>';

      resultsDiv.querySelectorAll('.minsar-result').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          const match = (q.length < 2 ? searchItems.slice(0, 8) : searchItems.filter(item =>
            `${item.name} ${item.keywords}`.toLowerCase().includes(q)
          ))[idx];
          if (match) {
            window.location.href = adminBase + match.path;
          }
        });
        el.addEventListener('mouseenter', () => {
          el.style.background = '#0f3460';
        });
        el.addEventListener('mouseleave', () => {
          el.style.background = 'transparent';
        });
      });
    }

    // Show default results
    renderResults('');

    input.addEventListener('input', () => {
      highlightIdx = -1;
      renderResults(input.value.trim());
    });

    input.addEventListener('keydown', (e) => {
      const items = resultsDiv.querySelectorAll('.minsar-result');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightIdx = Math.min(highlightIdx + 1, items.length - 1);
        renderResults(input.value.trim());
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightIdx = Math.max(highlightIdx - 1, 0);
        renderResults(input.value.trim());
      } else if (e.key === 'Enter' && highlightIdx >= 0) {
        e.preventDefault();
        items[highlightIdx]?.click();
      } else if (e.key === 'Escape') {
        overlay.remove();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
})();
