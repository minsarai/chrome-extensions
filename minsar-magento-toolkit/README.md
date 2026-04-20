# ⚡ Minsar — Magento Admin Toolkit

The command center every Magento developer deserves.

**No server module needed. Install the Chrome extension → works immediately on any Magento 2 admin.**

## Features

| Feature | Description |
|---------|-------------|
| ⌨️ **Ctrl+K Omni-Search** | Search all admin pages, configs, and actions from one command palette |
| 🗑️ **One-Click Cache Flush** | Flush all or individual cache types from any page |
| 🚦 **Environment Bar** | Color-coded bar showing DEV / STAGING / PRODUCTION |
| 📦 **Order Quick Search** | Search orders by #, email, or name from any page |
| 📐 **Compact Mode** | 3x more data visible — removes wasted whitespace |
| 🌙 **Dark Mode** | Full dark theme for Magento admin |
| 📊 **Store Info** | Magento version and deploy mode at a glance |
| 📌 **Smart Bookmarks** | Save and access your favorite admin pages |
| 🕐 **Activity History** | Auto-tracks your last 30 visited admin pages |
| ⌨️ **Keyboard Shortcuts** | Ctrl+Shift+K, C, D for search, cache, dark mode |

## Install

### From Chrome Web Store (Recommended)
Coming soon.

### Manual Install (Developer Mode)
1. Clone this repo: `git clone https://github.com/minsarai/chrome-extensions.git`
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" → select the `minsar-magento-toolkit` folder
5. Navigate to your Magento admin → click the Minsar icon

## How It Works

Minsar is a Chrome extension that injects into Magento 2 admin pages. It uses:
- **CSS injection** for dark mode, compact mode, and environment bar
- **Magento's built-in form_key** for cache flush operations
- **Chrome storage** for bookmarks, history, and settings
- **Pre-indexed database** of all Magento admin pages and config paths

No server-side module, no composer, no SSH access needed.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+K` | Open Omni-Search |
| `Ctrl+Shift+C` | Flush All Caches |
| `Ctrl+Shift+D` | Toggle Dark Mode |

## Privacy

Minsar does NOT:
- Collect any personal data
- Send data to any external server
- Track your browsing activity
- Access any data outside Magento admin pages

All settings are stored locally in your browser using Chrome's storage API.

## Built By

**Saif Ali** — Lead Magento Developer, Adobe Certified Expert
- LinkedIn: [saif-ali-rehman](https://linkedin.com/in/saif-ali-rehman-250287)
- GitHub: [minsarai](https://github.com/minsarai)

## License

MIT
