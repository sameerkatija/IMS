-- Sameer Distributors IMS Database Backup
-- Generated at: 2026-07-19T11:45:11.995Z
-- Disable constraint triggers temporarily

SET session_replication_role = 'replica';

-- Clean existing data before inserting
TRUNCATE TABLE "User", "Customer", "Category", "ExpenseCategory", "StockAdjustment", "PurchaseReturn", "PurchaseItem", "PurchaseReturnItem", "Salesman", "SalesReturnItem", "SupplierPayment", "CustomerLedger", "Expense", "StockMovement", "SupplierLedger", "InvoiceItem", "SalesReturn", "CustomerPayment", "SalesTarget", "Supplier", "Purchase", "Invoice", "Product", "PaymentAllocation" RESTART IDENTITY CASCADE;

-- ==========================================
-- Table: User
-- ==========================================
INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (1, 'Sameer Katija', 'sameer', 'sameerkatija@gmail.com', '$2b$10$xVdS9UrQ/crxBbiS8me5nurP68KrSkQPc9j9.U6anydpAyG9kkVcS', 'ADMIN', true, '2026-07-19T11:33:27.846Z', '2026-07-19T11:33:19.231Z', '2026-07-19T11:33:27.859Z');

-- Reset identity sequence for User
SELECT setval(pg_get_serial_sequence('public."User"', 'id'), COALESCE(max(id), 1)) FROM "User";

-- ==========================================
-- Table: Customer
-- ==========================================
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (1, 'Super Mart', NULL, 'Shop # 4 General road Lahore', 0, true, '2026-07-18T20:00:57.429Z', '2026-07-18T20:00:57.429Z');
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (2, 'MDS', NULL, 'MDS Quarry Road Quetta', 0, true, '2026-07-18T20:01:31.651Z', '2026-07-18T20:01:31.651Z');
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (3, 'Prem General Store', NULL, 'Prem General Store Zhob road loralai', 0, true, '2026-07-18T20:01:18.494Z', '2026-07-18T20:01:18.494Z');

-- Reset identity sequence for Customer
SELECT setval(pg_get_serial_sequence('public."Customer"', 'id'), COALESCE(max(id), 1)) FROM "Customer";

-- ==========================================
-- Table: Category
-- ==========================================
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (1, 'DIAPERS', '2026-07-19T11:36:14.949Z', '2026-07-19T11:36:14.949Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (2, 'SOAPS', '2026-07-19T11:36:19.460Z', '2026-07-19T11:36:19.460Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (3, 'RAZOR', '2026-07-19T11:36:23.977Z', '2026-07-19T11:36:23.977Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (4, 'WIPES', '2026-07-19T11:36:34.391Z', '2026-07-19T11:36:34.391Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (5, 'TISSUES', '2026-07-19T11:36:40.370Z', '2026-07-19T11:36:40.370Z', true);

-- Reset identity sequence for Category
SELECT setval(pg_get_serial_sequence('public."Category"', 'id'), COALESCE(max(id), 1)) FROM "Category";

-- ==========================================
-- Table: ExpenseCategory
-- ==========================================
-- No data for table ExpenseCategory

-- ==========================================
-- Table: StockAdjustment
-- ==========================================
-- No data for table StockAdjustment

-- ==========================================
-- Table: PurchaseReturn
-- ==========================================
-- No data for table PurchaseReturn

-- ==========================================
-- Table: PurchaseItem
-- ==========================================
-- No data for table PurchaseItem

-- ==========================================
-- Table: PurchaseReturnItem
-- ==========================================
-- No data for table PurchaseReturnItem

-- ==========================================
-- Table: Salesman
-- ==========================================
-- No data for table Salesman

-- ==========================================
-- Table: SalesReturnItem
-- ==========================================
-- No data for table SalesReturnItem

-- ==========================================
-- Table: SupplierPayment
-- ==========================================
-- No data for table SupplierPayment

-- ==========================================
-- Table: CustomerLedger
-- ==========================================
-- No data for table CustomerLedger

-- ==========================================
-- Table: Expense
-- ==========================================
-- No data for table Expense

-- ==========================================
-- Table: StockMovement
-- ==========================================
-- No data for table StockMovement

-- ==========================================
-- Table: SupplierLedger
-- ==========================================
-- No data for table SupplierLedger

-- ==========================================
-- Table: InvoiceItem
-- ==========================================
-- No data for table InvoiceItem

-- ==========================================
-- Table: SalesReturn
-- ==========================================
-- No data for table SalesReturn

-- ==========================================
-- Table: CustomerPayment
-- ==========================================
-- No data for table CustomerPayment

-- ==========================================
-- Table: SalesTarget
-- ==========================================
-- No data for table SalesTarget

-- ==========================================
-- Table: Supplier
-- ==========================================
INSERT INTO "Supplier" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (1, 'PRIME Sales & Marketing', NULL, 'Adil Plaza, Main Khanna Pul, Service Road, Islamabad', 0, true, '2026-07-19T11:34:33.010Z', '2026-07-19T11:34:33.010Z');

-- Reset identity sequence for Supplier
SELECT setval(pg_get_serial_sequence('public."Supplier"', 'id'), COALESCE(max(id), 1)) FROM "Supplier";

-- ==========================================
-- Table: Purchase
-- ==========================================
-- No data for table Purchase

-- ==========================================
-- Table: Invoice
-- ==========================================
-- No data for table Invoice

-- ==========================================
-- Table: Product
-- ==========================================
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (1, 'ROYAL PREMIUM', '4461859912573', NULL, 1, 810, 850, 824, 80, 8, true, '2026-07-18T19:10:21.943Z', '2026-07-18T19:28:37.098Z', 'N/B 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (2, 'Royal PREMIUM', '4461859912574', NULL, 1, 830, 875, 1224, 80, 8, true, '2026-07-18T19:12:47.420Z', '2026-07-18T19:28:37.104Z', '1-2 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (3, 'Royal PREMIUM', '4461859912575', NULL, 1, 1040, 1100, 1952, 80, 8, true, '2026-07-18T19:13:45.878Z', '2026-07-18T21:49:56.423Z', '4L 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (4, 'Royal PREMIUM', '4461859912576', NULL, 1, 1140, 1100, 1224, 80, 8, true, '2026-07-18T19:14:22.494Z', '2026-07-18T19:28:37.113Z', '5xl 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (5, 'Royal PREMIUM', '4461859912577', NULL, 1, 1240, 1300, 1120, 80, 8, true, '2026-07-18T19:15:08.030Z', '2026-07-18T19:28:37.116Z', 'XXl 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (6, 'Rahat Adult Diapers Pack', '2547484002581', NULL, 1, 800, 1000, 240, 80, 8, true, '2026-07-18T19:16:04.476Z', '2026-07-18T21:49:56.487Z', 'XL 10Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (7, 'Mamia  Baby Wipes', '5559666888873', NULL, 4, 88, 100, 480, 240, 24, true, '2026-07-18T19:17:21.241Z', '2026-07-18T21:51:18.123Z', '70 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (8, 'Rahat Soft pack Pink/w', '111555333', NULL, 5, 125, 150, 720, 360, 36, true, '2026-07-18T19:18:35.036Z', '2026-07-18T21:49:56.494Z', '300 Sheets');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (9, 'Rahat Pop-up Tissue Box', '5121477477777', NULL, 5, 139, 150, 180, 360, 36, true, '2026-07-18T19:19:43.451Z', '2026-07-18T21:49:56.496Z', '150 x 2Ply');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (10, 'Rahat Ultra Soft Tissue blue New', '1148088112280', NULL, 5, 150, 180, 3600, 360, 36, true, '2026-07-18T19:20:27.636Z', '2026-07-18T21:49:56.498Z', 'Pack of 6');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (11, 'Rahat  Soft Tissue mini', '1148021867352', NULL, 5, 92, 100, 360, 360, 36, true, '2026-07-18T19:21:39.364Z', '2026-07-18T21:49:56.501Z', 'Pack of 6');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (12, 'Rahat Kleenex Body Razor', '1255131131607', NULL, 3, 12, 50, 2882, 5760, 576, true, '2026-07-18T19:22:24.367Z', '2026-07-18T21:49:56.503Z', '1x12x48');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (13, 'Rahat Beauty Soap Black Refreshing 125GM', '8933897889095', NULL, 2, 88, 100, 360, 720, 72, true, '2026-07-18T19:23:04.364Z', '2026-07-18T21:49:56.505Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (14, 'Rahat Beauty Soap Green Natures', '8933897888548', NULL, 2, 88, 100, 360, 720, 72, true, '2026-07-18T19:23:51.418Z', '2026-07-18T21:49:56.507Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (15, 'Rahat Beauty Soap Pink Luxury', '8933897888982', NULL, 2, 88, 100, 144, 720, 72, true, '2026-07-18T19:24:24.021Z', '2026-07-18T21:49:56.508Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (16, 'Rahat Beauty Soap Yellow Glowing 125GM', '8963389788889', NULL, 2, 88, 120, 360, 720, 72, true, '2026-07-18T19:24:53.695Z', '2026-07-18T21:49:56.509Z', '72 Pcs');

-- Reset identity sequence for Product
SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE(max(id), 1)) FROM "Product";

-- ==========================================
-- Table: PaymentAllocation
-- ==========================================
-- No data for table PaymentAllocation

SET session_replication_role = 'origin';