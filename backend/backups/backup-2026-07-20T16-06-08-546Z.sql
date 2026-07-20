-- Sameer Distributors IMS Database Backup
-- Generated at: 2026-07-20T16:06:08.501Z
-- Disable constraint triggers temporarily

SET session_replication_role = 'replica';

-- Clean existing data before inserting
TRUNCATE TABLE "Purchase", "PaymentAllocation", "Product", "Supplier", "User", "PurchaseReturnItem", "StockMovement", "SalesReturnItem", "IdempotencyKey", "Expense", "Customer", "Category", "PurchaseReturn", "SupplierLedger", "InvoiceItem", "CustomerPayment", "SalesReturn", "Salesman", "SalesTarget", "SupplierPayment", "CustomerLedger", "ExpenseCategory", "StockAdjustment", "PurchaseItem", "Invoice" RESTART IDENTITY CASCADE;

-- ==========================================
-- Table: Purchase
-- ==========================================
-- No data for table Purchase

-- ==========================================
-- Table: PaymentAllocation
-- ==========================================
-- No data for table PaymentAllocation

-- ==========================================
-- Table: Product
-- ==========================================
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (1, 'ROYAL PREMIUM', '4461859912573', NULL, 1, 810, 850, 0, 80, 8, true, '2026-07-18T19:10:21.943Z', '2026-07-18T19:28:37.098Z', 'N/B 50Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (2, 'Royal PREMIUM', '4461859912574', NULL, 1, 830, 875, 0, 80, 8, true, '2026-07-18T19:12:47.420Z', '2026-07-18T19:28:37.104Z', '1-2 50Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (3, 'Royal PREMIUM', '4461859912575', NULL, 1, 1040, 1100, 0, 80, 8, true, '2026-07-18T19:13:45.878Z', '2026-07-18T21:49:56.423Z', '4L 50Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (4, 'Royal PREMIUM', '4461859912576', NULL, 1, 1140, 1100, 0, 80, 8, true, '2026-07-18T19:14:22.494Z', '2026-07-18T19:28:37.113Z', '5xl 50Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (5, 'Royal PREMIUM', '4461859912577', NULL, 1, 1240, 1300, 0, 80, 8, true, '2026-07-18T19:15:08.030Z', '2026-07-18T19:28:37.116Z', 'XXl 50Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (6, 'Rahat Adult Diapers Pack', '2547484002581', NULL, 1, 800, 1000, 0, 80, 8, true, '2026-07-18T19:16:04.476Z', '2026-07-18T21:49:56.487Z', 'XL 10Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (7, 'Mamia  Baby Wipes', '5559666888873', NULL, 4, 88, 100, 0, 240, 24, true, '2026-07-18T19:17:21.241Z', '2026-07-18T21:51:18.123Z', '70 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (8, 'Rahat Soft pack Pink/w', '111555333', NULL, 5, 125, 150, 0, 360, 36, true, '2026-07-18T19:18:35.036Z', '2026-07-18T21:49:56.494Z', '300 Sheets', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (9, 'Rahat Pop-up Tissue Box', '5121477477777', NULL, 5, 139, 150, 0, 360, 36, true, '2026-07-18T19:19:43.451Z', '2026-07-18T21:49:56.496Z', '150 x 2Ply', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (10, 'Rahat Ultra Soft Tissue blue New', '1148088112280', NULL, 5, 150, 180, 0, 360, 36, true, '2026-07-18T19:20:27.636Z', '2026-07-18T21:49:56.498Z', 'Pack of 6', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (11, 'Rahat  Soft Tissue mini', '1148021867352', NULL, 5, 92, 100, 0, 360, 36, true, '2026-07-18T19:21:39.364Z', '2026-07-18T21:49:56.501Z', 'Pack of 6', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (12, 'Rahat Kleenex Body Razor', '1255131131607', NULL, 3, 12, 50, 0, 5760, 576, true, '2026-07-18T19:22:24.367Z', '2026-07-18T21:49:56.503Z', '1x12x48', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (13, 'Rahat Beauty Soap Black Refreshing 125GM', '8933897889095', NULL, 2, 88, 100, 0, 720, 72, true, '2026-07-18T19:23:04.364Z', '2026-07-18T21:49:56.505Z', '72 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (14, 'Rahat Beauty Soap Green Natures', '8933897888548', NULL, 2, 88, 100, 0, 720, 72, true, '2026-07-18T19:23:51.418Z', '2026-07-18T21:49:56.507Z', '72 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (15, 'Rahat Beauty Soap Pink Luxury', '8933897888982', NULL, 2, 88, 100, 0, 720, 72, true, '2026-07-18T19:24:24.021Z', '2026-07-18T21:49:56.508Z', '72 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (16, 'Rahat Beauty Soap Yellow Glowing 125GM', '8963389788889', NULL, 2, 88, 120, 0, 720, 72, true, '2026-07-18T19:24:53.695Z', '2026-07-18T21:49:56.509Z', '72 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (17, 'Royal PREMIUM', NULL, NULL, 1, 940, 1050, 0, 80, 8, true, '2026-07-20T16:02:53.652Z', '2026-07-20T16:02:53.652Z', '3M 50Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (18, 'Rahat Toilet Paper', NULL, NULL, 5, 40, 48, 0, 10, 100, true, '2026-07-20T16:05:33.071Z', '2026-07-20T16:05:33.071Z', 'Single piece', 0);

-- Reset identity sequence for Product
SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE(max(id), 1)) FROM "Product";

-- ==========================================
-- Table: Supplier
-- ==========================================
-- No data for table Supplier

-- ==========================================
-- Table: User
-- ==========================================
INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (1, 'Sameer Katija', 'sameer', 'sameerkatija@gmail.com', '$2b$10$MrD20jXX.WYwS/OTB1mFVuLRcD3nH5HlWqPiOIu3Rh/nXDV5t1Eqq', 'ADMIN', true, '2026-07-20T15:51:44.088Z', '2026-07-20T15:51:39.318Z', '2026-07-20T15:51:44.101Z');

-- Reset identity sequence for User
SELECT setval(pg_get_serial_sequence('public."User"', 'id'), COALESCE(max(id), 1)) FROM "User";

-- ==========================================
-- Table: PurchaseReturnItem
-- ==========================================
-- No data for table PurchaseReturnItem

-- ==========================================
-- Table: StockMovement
-- ==========================================
-- No data for table StockMovement

-- ==========================================
-- Table: SalesReturnItem
-- ==========================================
-- No data for table SalesReturnItem

-- ==========================================
-- Table: IdempotencyKey
-- ==========================================
-- No data for table IdempotencyKey

-- ==========================================
-- Table: Expense
-- ==========================================
-- No data for table Expense

-- ==========================================
-- Table: Customer
-- ==========================================
-- No data for table Customer

-- ==========================================
-- Table: Category
-- ==========================================
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (1, 'DIAPERS', '2026-07-20T15:52:05.415Z', '2026-07-20T15:52:05.415Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (2, 'SOAPS', '2026-07-20T15:52:13.104Z', '2026-07-20T15:52:13.104Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (3, 'RAZOR', '2026-07-20T15:52:19.856Z', '2026-07-20T15:52:19.856Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (4, 'WIPES', '2026-07-20T15:52:29.400Z', '2026-07-20T15:52:29.400Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (5, 'TISSUES', '2026-07-20T15:52:37.140Z', '2026-07-20T15:52:37.140Z', true);

-- Reset identity sequence for Category
SELECT setval(pg_get_serial_sequence('public."Category"', 'id'), COALESCE(max(id), 1)) FROM "Category";

-- ==========================================
-- Table: PurchaseReturn
-- ==========================================
-- No data for table PurchaseReturn

-- ==========================================
-- Table: SupplierLedger
-- ==========================================
-- No data for table SupplierLedger

-- ==========================================
-- Table: InvoiceItem
-- ==========================================
-- No data for table InvoiceItem

-- ==========================================
-- Table: CustomerPayment
-- ==========================================
-- No data for table CustomerPayment

-- ==========================================
-- Table: SalesReturn
-- ==========================================
-- No data for table SalesReturn

-- ==========================================
-- Table: Salesman
-- ==========================================
-- No data for table Salesman

-- ==========================================
-- Table: SalesTarget
-- ==========================================
-- No data for table SalesTarget

-- ==========================================
-- Table: SupplierPayment
-- ==========================================
-- No data for table SupplierPayment

-- ==========================================
-- Table: CustomerLedger
-- ==========================================
-- No data for table CustomerLedger

-- ==========================================
-- Table: ExpenseCategory
-- ==========================================
-- No data for table ExpenseCategory

-- ==========================================
-- Table: StockAdjustment
-- ==========================================
-- No data for table StockAdjustment

-- ==========================================
-- Table: PurchaseItem
-- ==========================================
-- No data for table PurchaseItem

-- ==========================================
-- Table: Invoice
-- ==========================================
-- No data for table Invoice

SET session_replication_role = 'origin';