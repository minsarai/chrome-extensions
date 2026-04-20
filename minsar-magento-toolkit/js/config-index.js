/**
 * Minsar — Magento Admin Toolkit
 * Config Index — Pre-indexed Magento 2 Admin Pages & Config Paths
 *
 * This file powers the Omni-Search (Ctrl+K) feature in the popup.
 * It contains a pre-built index of all common Magento 2 admin pages,
 * system configuration sections, and quick actions.
 *
 * Path conventions:
 *   - Paths starting with /admin/admin/ are Magento_Backend routes
 *     (cache, config, users, import/export, etc.)
 *   - Paths starting with /admin/{module}/ are module-specific routes
 *     (sales, catalog, customer, cms, etc.)
 *   - The first /admin is stripped by navigateToPath() and replaced
 *     with the actual admin frontname from the current URL.
 *
 * To add new pages: add an entry with { name, path, icon, keywords }
 */

const MINSAR_INDEX = {
  // Admin Menu Pages
  pages: [
    { name: 'Dashboard', path: '/admin/dashboard/', icon: '📊', keywords: 'home overview' },
    { name: 'Orders', path: '/admin/sales/order/', icon: '📦', keywords: 'sales order list' },
    { name: 'Invoices', path: '/admin/sales/invoice/', icon: '🧾', keywords: 'sales invoice billing' },
    { name: 'Shipments', path: '/admin/sales/shipment/', icon: '🚚', keywords: 'sales shipping delivery' },
    { name: 'Credit Memos', path: '/admin/sales/creditmemo/', icon: '💳', keywords: 'sales refund return' },
    { name: 'Transactions', path: '/admin/sales/transactions/', icon: '💰', keywords: 'payment transaction' },
    { name: 'Products', path: '/admin/catalog/product/', icon: '🛍️', keywords: 'catalog product list inventory' },
    { name: 'Categories', path: '/admin/catalog/category/', icon: '📁', keywords: 'catalog category tree' },
    { name: 'Customers', path: '/admin/customer/index/', icon: '👥', keywords: 'customer list accounts' },
    { name: 'Customer Groups', path: '/admin/customer/group/', icon: '👥', keywords: 'customer group wholesale retail' },
    { name: 'Cart Price Rules', path: '/admin/sales_rule/promo_quote/', icon: '🏷️', keywords: 'promo coupon discount cart rule' },
    { name: 'Catalog Price Rules', path: '/admin/catalog_rule/promo_catalog/', icon: '🏷️', keywords: 'promo catalog discount price rule' },
    { name: 'Pages', path: '/admin/cms/page/', icon: '📝', keywords: 'cms page content' },
    { name: 'Blocks', path: '/admin/cms/block/', icon: '🧱', keywords: 'cms block static content' },
    { name: 'Widgets', path: '/admin/widget_instance/', icon: '🔲', keywords: 'cms widget frontend' },
    { name: 'Product Attributes', path: '/admin/catalog/product_attribute/', icon: '🏷️', keywords: 'attribute product eav' },
    { name: 'Attribute Sets', path: '/admin/catalog/product_set/', icon: '🏷️', keywords: 'attribute set product group' },
    { name: 'Product Reviews', path: '/admin/review/product/', icon: '⭐', keywords: 'review rating product' },
    { name: 'Search Terms', path: '/admin/search/term/', icon: '🔍', keywords: 'search term catalog' },
    { name: 'URL Rewrites', path: '/admin/admin/url_rewrite/', icon: '🔗', keywords: 'url rewrite redirect seo' },
    { name: 'Cache Management', path: '/admin/admin/cache/', icon: '🗑️', keywords: 'cache flush clean' },
    { name: 'Index Management', path: '/admin/indexer/indexer/list/', icon: '🔄', keywords: 'index reindex indexer' },
    { name: 'All Stores', path: '/admin/admin/system_store/', icon: '🏪', keywords: 'store website store view' },
    { name: 'Configuration', path: '/admin/admin/system_config/', icon: '⚙️', keywords: 'system config settings' },
    { name: 'Admin Users', path: '/admin/admin/user/', icon: '👤', keywords: 'admin user account role' },
    { name: 'User Roles', path: '/admin/admin/user_role/', icon: '🔐', keywords: 'admin role permission acl' },
    { name: 'Email Templates', path: '/admin/admin/email_template/', icon: '📧', keywords: 'email template transactional' },
    { name: 'Newsletter Subscribers', path: '/admin/newsletter/subscriber/', icon: '📬', keywords: 'newsletter subscriber email' },
    { name: 'Newsletter Queue', path: '/admin/newsletter/queue/', icon: '📬', keywords: 'newsletter queue send' },
    { name: 'Import', path: '/admin/admin/import/', icon: '📥', keywords: 'import data csv product customer' },
    { name: 'Export', path: '/admin/admin/export/', icon: '📤', keywords: 'export data csv product customer' },
    { name: 'Cron Schedule', path: '/admin/cron/schedule/', icon: '⏰', keywords: 'cron job schedule task' },
    { name: 'System Report', path: '/admin/reports/report/system/', icon: '📊', keywords: 'report system status' },
    { name: 'Order Report', path: '/admin/reports/report_sales/sales/', icon: '📊', keywords: 'report sales order revenue' },
    { name: 'Tax Rules', path: '/admin/tax/rule/', icon: '💲', keywords: 'tax rule rate vat' },
    { name: 'Tax Zones & Rates', path: '/admin/tax/rate/', icon: '💲', keywords: 'tax rate zone country' },
    { name: 'Currency Rates', path: '/admin/admin/system_currency/', icon: '💱', keywords: 'currency rate exchange' },
    { name: 'Shipping Methods', path: '/admin/admin/system_config/edit/section/carriers/', icon: '🚚', keywords: 'shipping method carrier delivery' },
    { name: 'Payment Methods', path: '/admin/admin/system_config/edit/section/payment/', icon: '💳', keywords: 'payment method gateway checkout' },
    { name: 'Inventory Sources', path: '/admin/inventory/source/', icon: '📦', keywords: 'inventory source stock msi' },
    { name: 'Inventory Stocks', path: '/admin/inventory/stock/', icon: '📦', keywords: 'inventory stock msi' },
  ],

  // System Configuration Sections
  configs: [
    { name: 'General', path: '/admin/admin/system_config/edit/section/general/', icon: '⚙️', keywords: 'general store info country locale' },
    { name: 'Web', path: '/admin/admin/system_config/edit/section/web/', icon: '🌐', keywords: 'web base url https secure unsecure' },
    { name: 'Design', path: '/admin/admin/system_config/edit/section/design/', icon: '🎨', keywords: 'design theme logo header footer' },
    { name: 'Currency Setup', path: '/admin/admin/system_config/edit/section/currency/', icon: '💱', keywords: 'currency default allowed rates' },
    { name: 'Store Email Addresses', path: '/admin/admin/system_config/edit/section/trans_email/', icon: '📧', keywords: 'email sender address store contact' },
    { name: 'Catalog', path: '/admin/admin/system_config/edit/section/catalog/', icon: '🛍️', keywords: 'catalog product listing search layered navigation' },
    { name: 'Catalog Search', path: '/admin/admin/system_config/edit/section/catalog/', icon: '🔍', keywords: 'search engine elasticsearch opensearch catalog' },
    { name: 'Inventory', path: '/admin/admin/system_config/edit/section/cataloginventory/', icon: '📦', keywords: 'inventory stock backorders out of stock' },
    { name: 'Customers', path: '/admin/admin/system_config/edit/section/customer/', icon: '👥', keywords: 'customer account login registration address' },
    { name: 'Sales', path: '/admin/admin/system_config/edit/section/sales/', icon: '📦', keywords: 'sales order invoice shipment minimum order' },
    { name: 'Sales Emails', path: '/admin/admin/system_config/edit/section/sales_email/', icon: '📧', keywords: 'sales email order confirmation invoice shipment' },
    { name: 'Checkout', path: '/admin/admin/system_config/edit/section/checkout/', icon: '🛒', keywords: 'checkout cart guest onepage' },
    { name: 'Payment Methods', path: '/admin/admin/system_config/edit/section/payment/', icon: '💳', keywords: 'payment method paypal braintree stripe checkout.com tamara tabby' },
    { name: 'Shipping Settings', path: '/admin/admin/system_config/edit/section/shipping/', icon: '🚚', keywords: 'shipping origin country region' },
    { name: 'Shipping Methods', path: '/admin/admin/system_config/edit/section/carriers/', icon: '🚚', keywords: 'shipping carrier flat rate free table rates dhl ups fedex' },
    { name: 'Google API', path: '/admin/admin/system_config/edit/section/google/', icon: '🔍', keywords: 'google analytics gtag recaptcha api' },
    { name: 'Tax', path: '/admin/admin/system_config/edit/section/tax/', icon: '💲', keywords: 'tax class calculation vat display price' },
    { name: 'Admin', path: '/admin/admin/system_config/edit/section/admin/', icon: '🔐', keywords: 'admin security session captcha url password' },
    { name: 'Security', path: '/admin/admin/system_config/edit/section/admin/', icon: '🔐', keywords: 'security admin session lifetime password lockout' },
    { name: 'Advanced', path: '/admin/admin/system_config/edit/section/advanced/', icon: '⚙️', keywords: 'advanced admin developer debug log' },
    { name: 'Developer', path: '/admin/admin/system_config/edit/section/dev/', icon: '🛠️', keywords: 'developer debug template hints log css js merge minify' },
    { name: 'System', path: '/admin/admin/system_config/edit/section/system/', icon: '⚙️', keywords: 'system cron mail smtp backup' },
    { name: 'Two Factor Auth', path: '/admin/admin/system_config/edit/section/twofactorauth/', icon: '🔐', keywords: 'two factor auth 2fa google authenticator' },
    { name: 'Content Security', path: '/admin/admin/system_config/edit/section/csp/', icon: '🛡️', keywords: 'csp content security policy whitelist' },
    { name: 'New Relic', path: '/admin/admin/system_config/edit/section/newrelicreporting/', icon: '📊', keywords: 'new relic reporting monitoring apm' },
  ],

  // Quick Actions (executable from search)
  actions: [
    { name: 'Flush All Caches', icon: '🗑️', action: 'flush-all', keywords: 'cache flush clean all' },
    { name: 'Flush Config Cache', icon: '⚙️', action: 'flush-config', keywords: 'cache config configuration' },
    { name: 'Flush Layout Cache', icon: '📐', action: 'flush-layout', keywords: 'cache layout xml' },
    { name: 'Flush Full Page Cache', icon: '📄', action: 'flush-fpc', keywords: 'cache full page fpc varnish' },
    { name: 'Flush Block HTML Cache', icon: '🧱', action: 'flush-block', keywords: 'cache block html output' },
    { name: 'Flush Translation Cache', icon: '🌐', action: 'flush-translate', keywords: 'cache translation locale i18n' },
    { name: 'Toggle Dark Mode', icon: '🌙', action: 'toggle-dark', keywords: 'dark mode theme night' },
    { name: 'Toggle Compact Mode', icon: '📐', action: 'toggle-compact', keywords: 'compact mode dense grid' },
    { name: 'Add Bookmark', icon: '📌', action: 'add-bookmark', keywords: 'bookmark save page favorite' },
  ]
};
