-- Sameer Distributors IMS Database Backup
-- Generated at: 2026-07-19T11:56:56.813Z
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
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (1, 1, 1, 824, 810, 667440);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (2, 1, 2, 1224, 830, 1015920);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (3, 1, 3, 752, 1040, 782080);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (4, 1, 4, 1224, 1140, 1395360);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (5, 1, 5, 1120, 1240, 1388800);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (6, 2, 3, 1200, 1040, 1248000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (7, 2, 6, 240, 800, 192000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (8, 2, 8, 720, 125, 90000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (9, 2, 9, 180, 139, 25000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (10, 2, 10, 3600, 150, 540000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (11, 2, 11, 360, 92, 33000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (12, 2, 7, 240, 88, 21000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (13, 2, 12, 2880, 12, 34560);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (14, 2, 13, 360, 88, 31500);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (15, 2, 14, 360, 88, 31500);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (16, 2, 15, 144, 88, 12600);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (17, 2, 16, 360, 88, 31500);

-- Reset identity sequence for PurchaseItem
SELECT setval(pg_get_serial_sequence('public."PurchaseItem"', 'id'), COALESCE(max(id), 1)) FROM "PurchaseItem";

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
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (1, 1, 'IN', 824, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-19T11:50:13.938Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (2, 2, 'IN', 1224, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-19T11:50:13.961Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (3, 3, 'IN', 752, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-19T11:50:13.973Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (4, 4, 'IN', 1224, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-19T11:50:13.986Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (5, 5, 'IN', 1120, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-19T11:50:13.994Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (6, 3, 'IN', 1200, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.225Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (7, 6, 'IN', 240, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.233Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (8, 8, 'IN', 720, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.239Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (9, 9, 'IN', 180, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.248Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (10, 10, 'IN', 3600, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.258Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (11, 11, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.266Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (12, 7, 'IN', 240, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.276Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (13, 12, 'IN', 2880, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.285Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (14, 13, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.294Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (15, 14, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.302Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (16, 15, 'IN', 144, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.311Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (17, 16, 'IN', 360, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-19T11:56:50.317Z');

-- Reset identity sequence for StockMovement
SELECT setval(pg_get_serial_sequence('public."StockMovement"', 'id'), COALESCE(max(id), 1)) FROM "StockMovement";

-- ==========================================
-- Table: SupplierLedger
-- ==========================================
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (1, 1, 0, 5249600, 5249600, 'PURCHASE', 1, 'Purchase PUR-000001', '2026-07-19T11:50:14.001Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (2, 1, 0, 2290660, 7540260, 'PURCHASE', 2, 'Purchase PUR-000002', '2026-07-19T11:56:50.325Z');

-- Reset identity sequence for SupplierLedger
SELECT setval(pg_get_serial_sequence('public."SupplierLedger"', 'id'), COALESCE(max(id), 1)) FROM "SupplierLedger";

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
INSERT INTO "Supplier" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (1, 'PRIME Sales & Marketing', NULL, 'Adil Plaza, Main Khanna Pul, Service Road, Islamabad', 7540260, true, '2026-07-19T11:34:33.010Z', '2026-07-19T11:56:50.320Z');

-- Reset identity sequence for Supplier
SELECT setval(pg_get_serial_sequence('public."Supplier"', 'id'), COALESCE(max(id), 1)) FROM "Supplier";

-- ==========================================
-- Table: Purchase
-- ==========================================
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (1, 'PUR-000001', 1, '2026-07-19T11:50:13.891Z', 5249600, 0, 5249600, NULL, 1, '2026-07-19T11:50:13.898Z', 5249600, 0, 'UNPAID', 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (2, 'PUR-000002', 1, '2026-07-19T11:56:50.212Z', 2291532, 872, 2290660, NULL, 1, '2026-07-19T11:56:50.214Z', 2290660, 0, 'UNPAID', 0);

-- Reset identity sequence for Purchase
SELECT setval(pg_get_serial_sequence('public."Purchase"', 'id'), COALESCE(max(id), 1)) FROM "Purchase";

-- ==========================================
-- Table: Invoice
-- ==========================================
-- No data for table Invoice

-- ==========================================
-- Table: Product
-- ==========================================
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (1, 'ROYAL PREMIUM', '4461859912573', NULL, 1, 810, 850, 824, 80, 8, true, '2026-07-18T19:10:21.943Z', '2026-07-19T11:50:13.929Z', 'N/B 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (2, 'Royal PREMIUM', '4461859912574', NULL, 1, 830, 875, 1224, 80, 8, true, '2026-07-18T19:12:47.420Z', '2026-07-19T11:50:13.955Z', '1-2 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (4, 'Royal PREMIUM', '4461859912576', NULL, 1, 1140, 1100, 1224, 80, 8, true, '2026-07-18T19:14:22.494Z', '2026-07-19T11:50:13.983Z', '5xl 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (5, 'Royal PREMIUM', '4461859912577', NULL, 1, 1240, 1300, 1120, 80, 8, true, '2026-07-18T19:15:08.030Z', '2026-07-19T11:50:13.992Z', 'XXl 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (3, 'Royal PREMIUM', '4461859912575', NULL, 1, 1040, 1100, 1952, 80, 8, true, '2026-07-18T19:13:45.878Z', '2026-07-19T11:56:50.222Z', '4L 50Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (6, 'Rahat Adult Diapers Pack', '2547484002581', NULL, 1, 800, 1000, 240, 80, 8, true, '2026-07-18T19:16:04.476Z', '2026-07-19T11:56:50.231Z', 'XL 10Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (8, 'Rahat Soft pack Pink/w', '111555333', NULL, 5, 125, 150, 720, 360, 36, true, '2026-07-18T19:18:35.036Z', '2026-07-19T11:56:50.237Z', '300 Sheets');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (9, 'Rahat Pop-up Tissue Box', '5121477477777', NULL, 5, 139, 150, 180, 360, 36, true, '2026-07-18T19:19:43.451Z', '2026-07-19T11:56:50.246Z', '150 x 2Ply');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (10, 'Rahat Ultra Soft Tissue blue New', '1148088112280', NULL, 5, 150, 180, 3600, 360, 36, true, '2026-07-18T19:20:27.636Z', '2026-07-19T11:56:50.255Z', 'Pack of 6');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (11, 'Rahat  Soft Tissue mini', '1148021867352', NULL, 5, 92, 100, 360, 360, 36, true, '2026-07-18T19:21:39.364Z', '2026-07-19T11:56:50.264Z', 'Pack of 6');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (7, 'Mamia  Baby Wipes', '5559666888873', NULL, 4, 88, 100, 240, 240, 24, true, '2026-07-18T19:17:21.241Z', '2026-07-19T11:56:50.272Z', '70 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (12, 'Rahat Kleenex Body Razor', '1255131131607', NULL, 3, 12, 50, 2880, 5760, 576, true, '2026-07-18T19:22:24.367Z', '2026-07-19T11:56:50.282Z', '1x12x48');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (13, 'Rahat Beauty Soap Black Refreshing 125GM', '8933897889095', NULL, 2, 88, 100, 360, 720, 72, true, '2026-07-18T19:23:04.364Z', '2026-07-19T11:56:50.291Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (14, 'Rahat Beauty Soap Green Natures', '8933897888548', NULL, 2, 88, 100, 360, 720, 72, true, '2026-07-18T19:23:51.418Z', '2026-07-19T11:56:50.299Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (15, 'Rahat Beauty Soap Pink Luxury', '8933897888982', NULL, 2, 88, 100, 144, 720, 72, true, '2026-07-18T19:24:24.021Z', '2026-07-19T11:56:50.309Z', '72 Pcs');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size") VALUES (16, 'Rahat Beauty Soap Yellow Glowing 125GM', '8963389788889', NULL, 2, 88, 120, 360, 720, 72, true, '2026-07-18T19:24:53.695Z', '2026-07-19T11:56:50.315Z', '72 Pcs');

-- Reset identity sequence for Product
SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE(max(id), 1)) FROM "Product";

-- ==========================================
-- Table: PaymentAllocation
-- ==========================================
-- No data for table PaymentAllocation

SET session_replication_role = 'origin';