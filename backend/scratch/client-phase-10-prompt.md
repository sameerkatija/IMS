# Prompt: Implement Phase 10 — React Client Dashboard

You are an expert React frontend developer. Your task is to build a complete, production-ready React web application inside the `client/` directory that integrates with our backend API (located in the `backend/` directory).

---

### Step 1: Read the Backend Codebase
Before writing any code, thoroughly review the `backend/` directory:
- Inspect `backend/routes/index.js` to see how routes are mounted.
- Check `backend/routes/` and `backend/controllers/` to identify all available API endpoints, HTTP verbs, URL parameters, and query parameters.
- Check `backend/config/zod-schema.js` to understand the exact payload structures, field names, and validation constraints expected by the backend.
- Check `backend/prisma/schema.prisma` to understand the database entities, enums (like `Role`, `MovementType`, `ReferenceType`, `SaleType`, `InvoiceStatus`), and relations.

---

### Step 2: Client Project Setup
The `client/` folder is already initialized with Vite, React 19, and Tailwind CSS v4. Complete the configuration:

1. **Proxy Backend Requests**:
   Update `client/vite.config.js` to proxy `/api` requests to the backend server (typically running on `http://localhost:5000` or whatever `PORT` is defined in `backend/config/env.js`). For example:
   ```javascript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     server: {
       proxy: {
         '/api': {
           target: 'http://localhost:5000',
           changeOrigin: true,
         }
       }
     }
   })
   ```

2. **Install Core Frontend Dependencies**:
   Install the necessary libraries for routing, HTTP requests, icons, and charting. Make sure to use versions that are compatible with React 19:
   - `react-router-dom` (routing)
   - `axios` (HTTP client)
   - `lucide-react` (icon library)
   - `recharts` (or another modern React 19 compatible chart library)

---

### Step 3: Implement Auth & Token Management
Our backend auth controller issues a JWT token and sends it back in the `Authorization` header of the response upon successful registration or login:
- **Login Response Handling**: Extract the token from the response header (`response.headers['authorization']` or `response.headers.get('authorization')`) and store it securely in `localStorage` as `'token'`.
- **Axios Request Interceptor**: Create a central Axios client instance that automatically attaches the token to all outgoing requests:
  ```javascript
  axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  ```
- **Axios Response Interceptor**: If any API call returns `401 Unauthorized` (expired or invalid token), automatically clear the token from `localStorage` and redirect the user to the `/login` route.

---

### Step 4: UI Design System & Aesthetics
Ensure the user interface is modern, premium, and clean:
- **Styling**: Leverage Tailwind v4 utility classes.
- **Theme**: Integrate a toggleable Dark/Light mode using CSS variables.
- **Layout**: Implement a persistent Sidebar navigation for authenticated pages, featuring a responsive mobile drawer, user profile header, and logout button.
- **Components**: Create reusable UI components (e.g., standard table headers, paginators, action buttons, select fields, input fields with error messages, loading indicators, and toast alerts).

---

### Step 5: Screen Implementations

#### 1. Authentication Gates
- **Login Screen**: Inputs for username and password. On success, store the token and redirect to Dashboard.
- **Signup Screen**: Fields for Name, Username, Email (optional), Password, Confirm Password, and the required `registrationSecret` (used by the backend to guard signups).

#### 2. Main Dashboard (Landing View)
- **Top Metric Cards**: Today's Sales, Weekly Sales, Monthly Sales, Total Receivables, Total Payables, Monthly Overhead Expenses, and Net Profit.
- **Charts**: 
  - A line chart showing monthly sales trends.
  - A bar chart highlighting the top 5 revenue-generating products of the month.
  - A pie/donut chart showing the breakdown of expenses.
- **Alert Widget**: List products whose current stock is at or below their configured `lowStockLevel`.

#### 3. Master Data CRUDs
- **Product Categories**: List, create, and rename categories.
- **Products**: Paginated list with search and category filters. Form to add/edit products, capturing name, barcode, SKU, category, costPrice, sellingPrice, lowStockLevel, and piecesPerCarton.
- **Customers**: List customers showing their current outstanding balance. Details view showing customer info and a chronological running-balance statement (Customer Ledger).
- **Suppliers**: List suppliers showing balances. Details view showing supplier details and their chronological statement (Supplier Ledger).

#### 4. Purchases (Supplier Inflow)
- **List Purchases**: View past purchase orders with date range and supplier filters.
- **Record Purchase**: Interactive invoice form:
  - Select supplier and date.
  - Dynamic line items: search/select products, enter quantities in pieces, and input unit costs.
  - Compute subtotal, deduct discount, and display final total.
  - Submitting saves the purchase, adds stock (IN), and updates supplier balance in one transaction.

#### 5. Invoices (Sales Outflow)
- **List Invoices**: Filterable by sale type (CASH/CREDIT), date range, and customer.
- **Create Invoice**:
  - Select customer (required if CREDIT) and salesman (optional).
  - Select sale type (CASH/CREDIT).
  - Add items (search, enter quantity, unit price defaults to product's current selling price but is overridable).
  - Input overall discount and paidAmount.
  - Submitting prints an invoice, deducts stock (OUT), and updates ledger.
- **Print View**: Provide a clean, printer-friendly page layout for invoicing receipts.

#### 6. Payments
- **Customer Payments**: Form to record incoming payments from customers. Can be general (applied to overall customer balance) or tied directly to a specific unpaid invoice (reducing its `balanceDue` and transitioning its status).
- **Supplier Payments**: Form to record payments made to suppliers, validated to ensure you don't overpay.

#### 7. Salesmen & Targets
- **Salesmen Management**: Simple CRUD to add and edit salesmen.
- **Sales Target Management**: Set monthly targets for salesmen using format `YYYY-MM`.
- **Achievement Panel**: Select a salesman and month to view their achievement metrics (Target vs Actual net sales vs % target achieved progress bar).

#### 8. Expenses
- **Log Expense**: Enter category, amount, date, and description.
- **Expense List**: Chronological list of logged business expenses filterable by category and date.

#### 9. Returns & Stock Adjustments
- **Sales Returns**: Form to record products returned by customers. If an `invoiceId` is specified, validate that return quantities do not exceed the remaining returnable quantity from that invoice.
- **Purchase Returns**: Form to return products to a supplier, validated against the original purchase.
- **Stock Adjustments**: Log manual stock count overrides (e.g. recount adjustments, damaged pieces) by entering signed quantities (e.g. `+10` or `-5`).
- **Stock Movement Log**: An audit table showing all stock movements, searchable by product.
- **Integrity Diagnostic**: A button on the product details page that calls `/api/stock/verify/:productId` and displays whether the live stock matches the history logs.

#### 10. Reports Center
Provide filterable date range reports:
- **Sales Report**: Daily aggregate chart.
- **Profit Report**: Calculates overall gross profit based on `costPriceAtSale`.
- **Expense Report**: Totals expenses grouped by category.
- **Net Profit Report**: Gross profit minus total expenses.
- **Sales by Salesman**: Table of net sales credited to each salesman.
- **Stock Valuation**: Total inventory value at cost vs at selling price.
