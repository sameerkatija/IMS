-- Sameer Distributors IMS Database Backup
-- Generated at: 2026-07-18T21:43:09.570Z
-- Disable constraint triggers temporarily

SET session_replication_role = 'replica';

-- Clean existing data before inserting
TRUNCATE TABLE "PurchaseReturn", "CustomerLedger", "SalesReturnItem", "CustomerPayment", "SupplierPayment", "Supplier", "Customer", "Salesman", "Purchase", "Product", "SalesTarget", "User", "PurchaseReturnItem", "InvoiceItem", "SupplierLedger", "Invoice", "ExpenseCategory", "Category", "PurchaseItem", "StockMovement", "SalesReturn", "StockAdjustment", "Expense" RESTART IDENTITY CASCADE;

-- ==========================================
-- Table: PurchaseReturn
-- ==========================================
-- No data for table PurchaseReturn

-- ==========================================
-- Table: CustomerLedger
-- ==========================================
-- No data for table CustomerLedger

-- ==========================================
-- Table: SalesReturnItem
-- ==========================================
-- No data for table SalesReturnItem

-- ==========================================
-- Table: CustomerPayment
-- ==========================================
-- No data for table CustomerPayment

-- ==========================================
-- Table: SupplierPayment
-- ==========================================
-- No data for table SupplierPayment

-- ==========================================
-- Table: Supplier
-- ==========================================
INSERT INTO "Supplier" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (1, 'PRIME Sales & Marketing', NULL, 'Adil Plaza, Main Khanna Pul, Service Road, Islamabad', 7561260, true, '2026-07-18T19:25:47.028Z', '2026-07-18T21:15:17.241Z');

-- Reset identity sequence for Supplier
SELECT setval(pg_get_serial_sequence('public."Supplier"', 'id'), COALESCE(max(id), 1)) FROM "Supplier";

-- ==========================================
-- Table: Customer
-- ==========================================
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (1, 'Super Mart', NULL, 'Shop # 4 General road Lahore', 0, true, '2026-07-18T20:00:57.429Z', '2026-07-18T20:00:57.429Z');
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (2, 'Prem General Store', NULL, 'Prem General Store Zhob road loralai', 0, true, '2026-07-18T20:01:18.494Z', '2026-07-18T20:01:18.494Z');
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (3, 'MDS', NULL, 'MDS Quarry Road Quetta', 0, true, '2026-07-18T20:01:31.651Z', '2026-07-18T20:01:31.651Z');

-- Reset identity sequence for Customer
SELECT setval(pg_get_serial_sequence('public."Customer"', 'id'), COALESCE(max(id), 1)) FROM "Customer";

-- ==========================================
-- Table: Salesman
-- ==========================================
-- No data for table Salesman

-- ==========================================
-- Table: Purchase
-- ==========================================
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (1, 'PUR-000001', 1, '2026-07-18T19:28:37.090Z', 5249600, 0, 5249600, NULL, 1, '2026-07-18T19:28:37.091Z', 5249600, 0, 'UNPAID', 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (2, 'PUR-000002', 1, '2026-07-18T19:57:45.599Z', 2291556, 896, 2290660, NULL, 1, '2026-07-18T19:57:45.609Z', 2290660, 0, 'UNPAID', 0);

-- Reset identity sequence for Purchase
SELECT setval(pg_get_serial_sequence('public."Purchase"', 'id'), COALESCE(max(id), 1)) FROM "Purchase";

-- ==========================================
-- Table: Product
-- ==========================================
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (3, 'Royal PREMIUM', '4461859912575', NULL, 1, 1039.78, 1100, 1952, 80, 8, true, '2026-07-18T19:13:45.878Z', '2026-07-18T21:42:54.299Z', '4L 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (1, 'ROYAL PREMIUM', '4461859912573', NULL, 1, 810, 850, 824, 80, 8, true, '2026-07-18T19:10:21.943Z', '2026-07-18T19:28:37.098Z', 'N/B 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (2, 'Royal PREMIUM', '4461859912574', NULL, 1, 830, 875, 1224, 80, 8, true, '2026-07-18T19:12:47.420Z', '2026-07-18T19:28:37.104Z', '1-2 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (6, 'Rahat Adult Diapers Pack', '2547484002581', NULL, 1, 799.73, 1000, 240, 80, 8, true, '2026-07-18T19:16:04.476Z', '2026-07-18T21:42:54.361Z', 'XL 10Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (4, 'Royal PREMIUM', '4461859912576', NULL, 1, 1140, 1100, 1224, 80, 8, true, '2026-07-18T19:14:22.494Z', '2026-07-18T19:28:37.113Z', '5xl 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (5, 'Royal PREMIUM', '4461859912577', NULL, 1, 1240, 1300, 1120, 80, 8, true, '2026-07-18T19:15:08.030Z', '2026-07-18T19:28:37.116Z', 'XXl 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (7, 'Mamia  Baby Wipes', '5559666888873', NULL, 4, 87.47, 100, 480, 240, 24, true, '2026-07-18T19:17:21.241Z', '2026-07-18T21:42:54.363Z', '70 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (8, 'Rahat Soft pack Pink/w', '111555333', NULL, 2, 124.96, 150, 720, 360, 36, true, '2026-07-18T19:18:35.036Z', '2026-07-18T21:42:54.366Z', '300 Sheets');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (9, 'Rahat Pop-up Tissue Box', '5121477477777', NULL, 2, 138.94, 150, 180, 360, 36, true, '2026-07-18T19:19:43.451Z', '2026-07-18T21:42:54.368Z', '150 x 2Ply');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (10, 'Rahat Ultra Soft Tissue blue New', '1148088112280', NULL, 2, 149.95, 180, 3600, 360, 36, true, '2026-07-18T19:20:27.636Z', '2026-07-18T21:42:54.370Z', 'Pack of 6');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (11, 'Rahat  Soft Tissue mini', '1148021867352', NULL, 2, 91.97, 100, 360, 360, 36, true, '2026-07-18T19:21:39.364Z', '2026-07-18T21:42:54.372Z', 'Pack of 6');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (12, 'Rahat Kleenex Body Razor', '1255131131607', NULL, 5, 12, 50, 2882, 5760, 576, true, '2026-07-18T19:22:24.367Z', '2026-07-18T21:42:54.375Z', '1x12x48');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (13, 'Rahat Beauty Soap Black Refreshing 125GM', '8933897889095', NULL, 3, 87.97, 100, 360, 720, 72, true, '2026-07-18T19:23:04.364Z', '2026-07-18T21:42:54.377Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (14, 'Rahat Beauty Soap Green Natures', '8933897888548', NULL, 3, 87.97, 100, 360, 720, 72, true, '2026-07-18T19:23:51.418Z', '2026-07-18T21:42:54.379Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (15, 'Rahat Beauty Soap Pink Luxury', '8933897888982', NULL, 3, 87.97, 100, 144, 720, 72, true, '2026-07-18T19:24:24.021Z', '2026-07-18T21:42:54.380Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (16, 'Rahat Beauty Soap Yellow Glowing 125GM', '8963389788889', NULL, 3, 87.97, 120, 360, 720, 72, true, '2026-07-18T19:24:53.695Z', '2026-07-18T21:42:54.381Z', '72 Pcs');

-- Reset identity sequence for Product
SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE(max(id), 1)) FROM "Product";

-- ==========================================
-- Table: SalesTarget
-- ==========================================
-- No data for table SalesTarget

-- ==========================================
-- Table: User
-- ==========================================
INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (1, 'Sameer Katija', 'sameer', 'sameerkatija@gmail.com', '$2b$10$QqSVuPv0ZwWvWk4Az6vPL.m5JrUkK1bo./s.QEaGqt.Zj9/QGxn0a', 'ADMIN', true, '2026-07-18T19:05:24.856Z', '2026-07-18T19:05:21.657Z', '2026-07-18T19:05:24.860Z');

-- Reset identity sequence for User
SELECT setval(pg_get_serial_sequence('public."User"', 'id'), COALESCE(max(id), 1)) FROM "User";

-- ==========================================
-- Table: PurchaseReturnItem
-- ==========================================
-- No data for table PurchaseReturnItem

-- ==========================================
-- Table: InvoiceItem
-- ==========================================
-- No data for table InvoiceItem

-- ==========================================
-- Table: SupplierLedger
-- ==========================================
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (1, 1, 0, 5249600, 5249600, 'PURCHASE', 1, 'Purchase PUR-000001', '2026-07-18T19:28:37.120Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (2, 1, 0, 2290660, 7540260, 'PURCHASE', 2, 'Purchase PUR-000002', '2026-07-18T19:57:45.661Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (3, 1, 0, 21000, 7561260, 'PURCHASE', 3, 'Purchase PUR-000003', '2026-07-18T20:25:35.826Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (4, 1, 0, 21000, 7582260, 'PURCHASE', 4, 'Purchase PUR-000004', '2026-07-18T20:37:57.047Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (5, 1, 21000, 0, 7561260, 'PURCHASE_RETURN', 1, 'Purchase Return PR-000001 (Goods Returned) for Purchase PUR-000004', '2026-07-18T20:58:45.936Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (6, 1, 21000, 0, 7540260, 'PURCHASE_RETURN', 2, 'Purchase Return PR-000002 (Goods Returned) for Purchase PUR-000003', '2026-07-18T20:59:17.893Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (7, 1, 0, 21120, 7561380, 'PURCHASE', 5, 'Purchase PUR-000005 (Gross)', '2026-07-18T21:15:17.240Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (8, 1, 120, 0, 7561260, 'PURCHASE', 5, 'Discount on Purchase PUR-000005', '2026-07-18T21:15:17.242Z');

-- Reset identity sequence for SupplierLedger
SELECT setval(pg_get_serial_sequence('public."SupplierLedger"', 'id'), COALESCE(max(id), 1)) FROM "SupplierLedger";

-- ==========================================
-- Table: Invoice
-- ==========================================
-- No data for table Invoice

-- ==========================================
-- Table: ExpenseCategory
-- ==========================================
-- No data for table ExpenseCategory

-- ==========================================
-- Table: Category
-- ==========================================
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (1, 'DIAPERS', '2026-07-18T19:06:09.945Z', '2026-07-18T19:06:09.945Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (2, 'TISSUES', '2026-07-18T19:06:19.086Z', '2026-07-18T19:06:19.086Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (3, 'SOAP', '2026-07-18T19:06:26.783Z', '2026-07-18T19:06:26.783Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (4, 'WIPES', '2026-07-18T19:06:30.719Z', '2026-07-18T19:06:30.719Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (5, 'RAZOR', '2026-07-18T19:06:39.873Z', '2026-07-18T19:06:39.873Z', true);

-- Reset identity sequence for Category
SELECT setval(pg_get_serial_sequence('public."Category"', 'id'), COALESCE(max(id), 1)) FROM "Category";

-- ==========================================
-- Table: PurchaseItem
-- ==========================================
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (1, 1, 1, 824, 810, 667440);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (2, 1, 2, 1224, 830, 1015920);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (3, 1, 3, 752, 1040, 782080);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (4, 1, 4, 1224, 1140, 1395360);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (5, 1, 5, 1120, 1240, 1388800);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (6, 2, 6, 240, 800, 192000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (7, 2, 3, 1200, 1040, 1248000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (8, 2, 7, 240, 88, 21120);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (9, 2, 8, 720, 125, 90000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (10, 2, 9, 180, 139, 25020);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (11, 2, 11, 360, 92, 33120);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (12, 2, 12, 2882, 12, 34584);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (13, 2, 13, 360, 88, 31680);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (14, 2, 14, 360, 88, 31680);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (15, 2, 15, 144, 88, 12672);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (16, 2, 16, 360, 88, 31680);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (17, 2, 10, 3600, 150, 540000);

-- Reset identity sequence for PurchaseItem
SELECT setval(pg_get_serial_sequence('public."PurchaseItem"', 'id'), COALESCE(max(id), 1)) FROM "PurchaseItem";

-- ==========================================
-- Table: StockMovement
-- ==========================================
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (1, 1, 'IN', 824, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-18T19:28:37.100Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (2, 2, 'IN', 1224, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-18T19:28:37.106Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (3, 3, 'IN', 752, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-18T19:28:37.110Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (4, 4, 'IN', 1224, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-18T19:28:37.113Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (5, 5, 'IN', 1120, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-18T19:28:37.117Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (6, 6, 'IN', 240, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.620Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (7, 3, 'IN', 1200, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.624Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (8, 7, 'IN', 240, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.628Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (9, 8, 'IN', 720, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.632Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (10, 9, 'IN', 180, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.636Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (11, 11, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.639Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (12, 12, 'IN', 2882, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.642Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (13, 13, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.645Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (14, 14, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.647Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (15, 15, 'IN', 144, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.650Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (16, 16, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.653Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (17, 10, 'IN', 3600, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-18T19:57:45.656Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (18, 7, 'IN', 240, 'PURCHASE', 3, 1, 'Purchase PUR-000003', '2026-07-18T20:25:35.821Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (19, 7, 'IN', 240, 'PURCHASE', 4, 1, 'Purchase PUR-000004', '2026-07-18T20:37:57.041Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (20, 7, 'OUT', 240, 'PURCHASE_RETURN', 1, 1, 'Unknown Entry', '2026-07-18T20:58:45.928Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (21, 7, 'OUT', 240, 'PURCHASE_RETURN', 2, 1, 'Unknown ENtry', '2026-07-18T20:59:17.890Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (22, 7, 'IN', 240, 'PURCHASE', 5, 1, 'Purchase PUR-000005', '2026-07-18T21:15:17.231Z');

-- Reset identity sequence for StockMovement
SELECT setval(pg_get_serial_sequence('public."StockMovement"', 'id'), COALESCE(max(id), 1)) FROM "StockMovement";

-- ==========================================
-- Table: SalesReturn
-- ==========================================
-- No data for table SalesReturn

-- ==========================================
-- Table: StockAdjustment
-- ==========================================
-- No data for table StockAdjustment

-- ==========================================
-- Table: Expense
-- ==========================================
-- No data for table Expense

SET session_replication_role = 'origin';