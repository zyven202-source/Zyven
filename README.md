# Zyven — POS & Inventory for Kenyan Shops

**Run your shop. Know your numbers.**

Zyven is a mobile-first Point of Sale, inventory, stock management, customer credit ledger, cash-shift auditing, and business analytics platform built specifically for Kenyan small retail shops (*dukas*).

The core workflow is **BUY → STOCK → SELL → GET PAID → TRACK → UNDERSTAND**. The screens are designed to make everyday shop actions fast on a phone, with a sidebar sidebar navigation and bottom-tab bar on mobile.

---

### What you can do

- **POS** — fast sales, cart management, discounts, receipt printing (58mm / 80mm), barcode scanning for stock receiving
- **Inventory** — product list, stock levels, low/stock-out/expiring filters, profit and margin per product
- **Stock receiving** — add stock by product, barcode scan-and-create, stock adjustments with reasons (Damaged / Expired / Lost / Theft / Counting correction)
- **Daftari (customer credit)** — credit customers, record repayments, view ledger entries
- **Expenses** — record expenses, group by category, see totals
- **Shifts** — open and close cash shifts, reconcile counted cash against expected cash
- **Inventory detail** — sales velocity (7/30 days), stock history, price history, estimated days of stock left
- **Transactions** — paginated sale history, transaction detail, receipt view and print
- **Dashboard** — today's sales, net profit, cash vs M-Pesa, outstanding credit, low-stock and overdue-customer alerts
- **Reports** — sales trends, top-selling products, category performance
- **Offline-first** — sales, restocks, and adjustments are queued locally when the network is down and synced when it returns
- **PWA** — installable on iOS and Android, with a service worker that caches the app shell
- **Barcode scanner** — camera-based scanning via `html5-qrcode`
- **Backup & restore** — export business data to JSON; import restores products, customers, suppliers, and expenses without touching sales history
- **Audit log** — every create/update/adjustment action is recorded with who did it and when
- **Row Level Security** — every shop-owned record is scoped to the logged-in shop; users cannot read or modify another shop's data

---

### Tech stack

- React 19, TypeScript, Vite
- Tailwind CSS 4 (dark, mobile-first design system)
- shadcn/ui components, Radix primitives
- Framer Motion for transitions
- Recharts for charts
- Lucide React for icons
- Supabase — authentication, PostgreSQL database, Row Level Security, storage, realtime
- `html5-qrcode` for barcode scanning

---

### Getting started

1. Install dependencies

```bash
bun install
```

2. Create a `.env` file (or use Vite environment variables) with your Supabase project URL and anon key:

```bash
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
```

3. Apply the database schema to your Supabase project. The full schema is in `supabase/schema.sql`.

4. Start the dev server

```bash
bun run dev
```

The app binds to `0.0.0.0` and respects the `PORT` environment variable.

---

### Database schema

Core tables: `profiles`, `shops`, `shop_members`, `customers`, `suppliers`, `categories`, `products`, `product_price_history`, `stock_movements`, `sales`, `sale_items`, `payments`, `customer_ledger_entries`, `expenses`, `shifts`, `cash_movements`, `audit_logs`, `settings`.

Every shop-owned record includes `shop_id` and is protected by Supabase Row Level Security.

---

### Deployment

**Vercel**

- The project includes `vercel.json` with SPA rewrites so client-side routes like `/pos` and `/transactions` do not 404.
- Set the build command to `node build.mjs`.
- Set the environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your Vercel project settings.
- The install/build command in the Vercel project should be configured to run `node build.mjs` (self-contained, Node-only). No Python or system packages are required.

**PWA / installability**

- `public/manifest.json`, `public/sw.js`, and `public/favicon.svg` are included.
- For installability on iOS, add a real `icon-192.png` and `icon-512.png` at the project root (`public/`), then redeploy. The manifest and `apple-touch-icon` reference those files.

---

### Scripts

- `bun run dev` — start the dev server
- `bun run build` — build for production with the included `build.mjs`
- `bun run preview` — preview the production build locally
- `bun run lint` — run Oxlint

---

### Offline behavior

When the device is offline:

- The top-bar badge shows "Offline" and the number of pending sales.
- Completed sales are saved into a local queue.
- When connectivity returns, the app syncs the queue. Each synced batch produces a toast.

LocalStorage is used as the offline queue and cache only; the real source of truth remains Supabase.

---

### Feature status

- Barcode scanning: real camera-based scanning, with product lookup and "create new" fallback
- Offline queue + sync: available
- Service worker: available
- Stock adjustments with reasons: available
- Product price history: available with price-history tab
- Transaction history page: available with detail and print
- Product detail page: available with overview, stock history, price history, and sales tabs
- Expiry tracking UI: available on inventory list and product detail
- Backup import/restore: available
- Receipt printing: available via Web Print API (print dialog)
- Dashboard skeleton loading: available
- Skeleton loading on list pages: available

---

### License

Internal project.
