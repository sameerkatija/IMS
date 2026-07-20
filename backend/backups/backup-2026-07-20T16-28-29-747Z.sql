-- Sameer Distributors IMS Database Backup
-- Generated at: 2026-07-20T16:28:29.697Z
-- Disable constraint triggers temporarily

SET session_replication_role = 'replica';

-- Clean existing data before inserting
TRUNCATE TABLE "Purchase", "PaymentAllocation", "Product", "Supplier", "User", "PurchaseReturnItem", "StockMovement", "SalesReturnItem", "IdempotencyKey", "Expense", "Customer", "Category", "PurchaseReturn", "SupplierLedger", "InvoiceItem", "CustomerPayment", "SalesReturn", "Salesman", "SalesTarget", "SupplierPayment", "CustomerLedger", "ExpenseCategory", "StockAdjustment", "PurchaseItem", "Invoice" RESTART IDENTITY CASCADE;

-- ==========================================
-- Table: Purchase
-- ==========================================
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied", "returnedAmount") VALUES (1, 'PUR-000001', 1, '2026-07-20T16:09:28.541Z', 5838000, 0, 5838000, NULL, 1, '2026-07-20T16:09:28.543Z', 5838000, 0, 'UNPAID', 0, 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied", "returnedAmount") VALUES (2, 'PUR-000002', 1, '2026-07-20T16:16:46.725Z', 4000, 200, 3800, NULL, 1, '2026-07-20T16:16:46.727Z', 3800, 0, 'UNPAID', 0, 0);

-- Reset identity sequence for Purchase
SELECT setval(pg_get_serial_sequence('public."Purchase"', 'id'), COALESCE(max(id), 1)) FROM "Purchase";

-- ==========================================
-- Table: PaymentAllocation
-- ==========================================
-- No data for table PaymentAllocation

-- ==========================================
-- Table: Product
-- ==========================================
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (5, 'Royal PREMIUM', '4461859912577', NULL, 1, 1240, 1300, 0, 80, 8, true, '2026-07-18T19:15:08.030Z', '2026-07-18T19:28:37.116Z', 'XXl 50Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (7, 'Mamia  Baby Wipes', '5559666888873', NULL, 4, 88, 100, 0, 240, 24, true, '2026-07-18T19:17:21.241Z', '2026-07-18T21:51:18.123Z', '70 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (8, 'Rahat Soft pack Pink/w', '111555333', NULL, 5, 125, 150, 0, 360, 36, true, '2026-07-18T19:18:35.036Z', '2026-07-18T21:49:56.494Z', '300 Sheets', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (9, 'Rahat Pop-up Tissue Box', '5121477477777', NULL, 5, 139, 150, 0, 360, 36, true, '2026-07-18T19:19:43.451Z', '2026-07-18T21:49:56.496Z', '150 x 2Ply', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (11, 'Rahat  Soft Tissue mini', '1148021867352', NULL, 5, 92, 100, 0, 360, 36, true, '2026-07-18T19:21:39.364Z', '2026-07-18T21:49:56.501Z', 'Pack of 6', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (12, 'Rahat Kleenex Body Razor', '1255131131607', NULL, 3, 12, 50, 0, 5760, 576, true, '2026-07-18T19:22:24.367Z', '2026-07-18T21:49:56.503Z', '1x12x48', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (13, 'Rahat Beauty Soap Black Refreshing 125GM', '8933897889095', NULL, 2, 88, 100, 0, 720, 72, true, '2026-07-18T19:23:04.364Z', '2026-07-18T21:49:56.505Z', '72 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (14, 'Rahat Beauty Soap Green Natures', '8933897888548', NULL, 2, 88, 100, 0, 720, 72, true, '2026-07-18T19:23:51.418Z', '2026-07-18T21:49:56.507Z', '72 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (16, 'Rahat Beauty Soap Yellow Glowing 125GM', '8963389788889', NULL, 2, 88, 120, 0, 720, 72, true, '2026-07-18T19:24:53.695Z', '2026-07-18T21:49:56.509Z', '72 Pcs', 0);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (4, 'Royal PREMIUM', '4461859912576', NULL, 1, 1140, 1100, 992, 80, 8, true, '2026-07-18T19:14:22.494Z', '2026-07-20T16:13:06.980Z', '5xl 50Pcs', 1140);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (3, 'Royal PREMIUM', '4461859912575', NULL, 1, 1040, 1100, 992, 80, 8, true, '2026-07-18T19:13:45.878Z', '2026-07-20T16:13:06.991Z', '4L 50Pcs', 1040);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (17, 'Royal PREMIUM', NULL, NULL, 1, 940, 1050, 992, 80, 8, true, '2026-07-20T16:02:53.652Z', '2026-07-20T16:13:06.998Z', '3M 50Pcs', 940);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (2, 'Royal PREMIUM', '4461859912574', NULL, 1, 830, 875, 992, 80, 8, true, '2026-07-18T19:12:47.420Z', '2026-07-20T16:13:07.006Z', '1-2 50Pcs', 830);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (1, 'ROYAL PREMIUM', '4461859912573', NULL, 1, 810, 850, 992, 80, 8, true, '2026-07-18T19:10:21.943Z', '2026-07-20T16:13:07.014Z', 'N/B 50Pcs', 810);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (6, 'Rahat Adult Diapers Pack', '2547484002581', NULL, 1, 800, 1000, 982, 80, 8, true, '2026-07-18T19:16:04.476Z', '2026-07-20T16:13:07.023Z', 'XL 10Pcs', 800);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (10, 'Rahat Ultra Soft Tissue blue New', '1148088112280', NULL, 5, 150, 180, 964, 360, 36, true, '2026-07-18T19:20:27.636Z', '2026-07-20T16:13:07.029Z', 'Pack of 6', 150);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (15, 'Rahat Beauty Soap Pink Luxury', '8933897888982', NULL, 2, 88, 100, 976, 720, 72, true, '2026-07-18T19:24:24.021Z', '2026-07-20T16:13:07.036Z', '72 Pcs', 88);
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt", "size", "weightedAvgCost") VALUES (18, 'Rahat Toilet Paper', NULL, NULL, 5, 40, 48, 1000, 10, 100, true, '2026-07-20T16:05:33.071Z', '2026-07-20T16:16:46.745Z', 'Single piece', 39.8);

-- Reset identity sequence for Product
SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE(max(id), 1)) FROM "Product";

-- ==========================================
-- Table: Supplier
-- ==========================================
INSERT INTO "Supplier" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (1, 'PRIME Sales & Marketing', NULL, 'Islamabad, Pakistan', 5841800, true, '2026-07-20T16:06:31.116Z', '2026-07-20T16:16:46.754Z');

-- Reset identity sequence for Supplier
SELECT setval(pg_get_serial_sequence('public."Supplier"', 'id'), COALESCE(max(id), 1)) FROM "Supplier";

-- ==========================================
-- Table: User
-- ==========================================
INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (1, 'Sameer Katija', 'sameer', 'sameerkatija@gmail.com', '$2b$10$MrD20jXX.WYwS/OTB1mFVuLRcD3nH5HlWqPiOIu3Rh/nXDV5t1Eqq', 'ADMIN', true, '2026-07-20T16:23:56.192Z', '2026-07-20T15:51:39.318Z', '2026-07-20T16:23:56.209Z');

-- Reset identity sequence for User
SELECT setval(pg_get_serial_sequence('public."User"', 'id'), COALESCE(max(id), 1)) FROM "User";

-- ==========================================
-- Table: PurchaseReturnItem
-- ==========================================
-- No data for table PurchaseReturnItem

-- ==========================================
-- Table: StockMovement
-- ==========================================
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (1, 18, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.576Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (2, 17, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.594Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (3, 4, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.610Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (4, 2, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.625Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (5, 1, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.642Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (6, 3, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.656Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (7, 6, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.671Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (8, 10, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.687Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (9, 15, 'IN', 1000, 'PURCHASE', 1, 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.698Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (10, 4, 'OUT', 8, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:06.983Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (11, 3, 'OUT', 8, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:06.992Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (12, 17, 'OUT', 8, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:07.000Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (13, 2, 'OUT', 8, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:07.008Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (14, 1, 'OUT', 8, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:07.017Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (15, 6, 'OUT', 18, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:07.024Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (16, 10, 'OUT', 36, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:07.030Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (17, 15, 'OUT', 24, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:07.038Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (18, 18, 'OUT', 100, 'INVOICE', 1, 1, 'Invoice INV-000001', '2026-07-20T16:13:07.044Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (19, 18, 'IN', 100, 'PURCHASE', 2, 1, 'Purchase PUR-000002', '2026-07-20T16:16:46.749Z');

-- Reset identity sequence for StockMovement
SELECT setval(pg_get_serial_sequence('public."StockMovement"', 'id'), COALESCE(max(id), 1)) FROM "StockMovement";

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
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (1, 'Eman Super Mart', NULL, 'A1 city Quetta', 69008, true, '2026-07-20T16:09:52.528Z', '2026-07-20T16:13:07.048Z');

-- Reset identity sequence for Customer
SELECT setval(pg_get_serial_sequence('public."Customer"', 'id'), COALESCE(max(id), 1)) FROM "Customer";

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
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (1, 1, 0, 5838000, 5838000, 'PURCHASE', 1, 'Purchase PUR-000001', '2026-07-20T16:09:28.706Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (2, 1, 0, 3800, 5841800, 'PURCHASE', 2, 'Purchase PUR-000002', '2026-07-20T16:16:46.758Z');

-- Reset identity sequence for SupplierLedger
SELECT setval(pg_get_serial_sequence('public."SupplierLedger"', 'id'), COALESCE(max(id), 1)) FROM "SupplierLedger";

-- ==========================================
-- Table: InvoiceItem
-- ==========================================
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (1, 1, 4, 8, 1250, 1140, 9500);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (2, 1, 3, 8, 1150, 1040, 8740);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (3, 1, 17, 8, 1050, 940, 7980);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (4, 1, 2, 8, 950, 830, 7220);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (5, 1, 1, 8, 900, 810, 6840);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (6, 1, 6, 18, 880, 800, 15048);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (7, 1, 10, 36, 200, 150, 6840);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (8, 1, 15, 24, 100, 88, 2280);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (9, 1, 18, 100, 48, 40, 4560);

-- Reset identity sequence for InvoiceItem
SELECT setval(pg_get_serial_sequence('public."InvoiceItem"', 'id'), COALESCE(max(id), 1)) FROM "InvoiceItem";

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
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (1, 1, 69008, 0, 69008, 'INVOICE', 1, 'Credit sale for Invoice INV-000001', '2026-07-20T16:13:07.052Z');

-- Reset identity sequence for CustomerLedger
SELECT setval(pg_get_serial_sequence('public."CustomerLedger"', 'id'), COALESCE(max(id), 1)) FROM "CustomerLedger";

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
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (1, 1, 18, 1000, 40, 40000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (2, 1, 17, 1000, 940, 940000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (3, 1, 4, 1000, 1140, 1140000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (4, 1, 2, 1000, 830, 830000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (5, 1, 1, 1000, 810, 810000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (6, 1, 3, 1000, 1040, 1040000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (7, 1, 6, 1000, 800, 800000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (8, 1, 10, 1000, 150, 150000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (9, 1, 15, 1000, 88, 88000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (10, 2, 18, 100, 40, 3800);

-- Reset identity sequence for PurchaseItem
SELECT setval(pg_get_serial_sequence('public."PurchaseItem"', 'id'), COALESCE(max(id), 1)) FROM "PurchaseItem";

-- ==========================================
-- Table: Invoice
-- ==========================================
INSERT INTO "Invoice" ("id", "invoiceNo", "customerId", "salesmanId", "saleType", "invoiceDate", "subtotal", "discount", "total", "paidAmount", "balanceDue", "status", "description", "createdById", "createdAt", "creditApplied", "returnedAmount") VALUES (1, 'INV-000001', 1, NULL, 'CREDIT', '2026-07-20T16:13:06.966Z', 72640, 3632, 69008, 0, 69008, 'UNPAID', NULL, 1, '2026-07-20T16:13:06.968Z', 0, 0);

-- Reset identity sequence for Invoice
SELECT setval(pg_get_serial_sequence('public."Invoice"', 'id'), COALESCE(max(id), 1)) FROM "Invoice";

SET session_replication_role = 'origin';