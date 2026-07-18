-- Sameer Distributors IMS Database Backup
-- Generated at: 2026-07-18T09:25:11.502Z
-- Disable constraint triggers temporarily

SET session_replication_role = 'replica';

-- Clean existing data before inserting
TRUNCATE TABLE "CustomerLedger", "Expense", "Category", "StockMovement", "StockAdjustment", "Supplier", "Customer", "Product", "Salesman", "CustomerPayment", "SupplierPayment", "Purchase", "SalesTarget", "User", "PurchaseItem", "PurchaseReturn", "PurchaseReturnItem", "InvoiceItem", "SalesReturnItem", "SupplierLedger", "Invoice", "SalesReturn", "ExpenseCategory" RESTART IDENTITY CASCADE;

-- ==========================================
-- Table: CustomerLedger
-- ==========================================
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (36, 20, 39000, 0, 39000, 'INVOICE', 18, 'Credit sale for Invoice INV-000002', '2026-07-17T12:27:35.647Z');
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (37, 20, 25000, 0, 64000, 'INVOICE', 20, 'Credit sale for Invoice INV-000004', '2026-07-17T12:32:53.629Z');
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (38, 20, 0, 20000, 44000, 'INVOICE', 20, 'Cash payment upfront for Invoice INV-000004', '2026-07-17T12:32:53.637Z');
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (39, 21, 7000, 0, 7000, 'INVOICE', 21, 'Credit sale for Invoice INV-000005', '2026-07-17T12:41:19.203Z');
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (40, 21, 0, 5000, 2000, 'INVOICE', 21, 'Cash payment upfront for Invoice INV-000005', '2026-07-17T12:41:19.217Z');
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (41, 21, 0, 2000, 0, 'INVOICE', 21, 'Payment for Invoice #INV-000005', '2026-07-17T12:41:44.934Z');
INSERT INTO "CustomerLedger" ("id", "customerId", "debit", "credit", "balance", "referenceType", "referenceId", "description", "createdAt") VALUES (42, 20, 0, 12500, 31500, 'SALES_RETURN', 12, 'Sales Return SR-000002 for Invoice INV-000004', '2026-07-17T22:24:07.576Z');

-- Reset identity sequence for CustomerLedger
SELECT setval(pg_get_serial_sequence('public."CustomerLedger"', 'id'), COALESCE(max(id), 1)) FROM "CustomerLedger";

-- ==========================================
-- Table: Expense
-- ==========================================
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (14, 17, 6500, '2026-07-14T10:30:00.000Z', 'Pay to mazdoor', '2026-07-17T09:32:31.228Z', '2026-07-17T09:32:31.228Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (15, 16, 80000, '2026-07-13T10:30:00.000Z', 'Current Month Office Rent', '2026-07-17T09:33:19.167Z', '2026-07-17T09:33:19.167Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (16, 18, 25000, '2026-07-01T10:30:00.000Z', 'Paid to vicky', '2026-07-17T09:33:52.194Z', '2026-07-17T09:33:52.194Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (20, 19, 160, '2026-07-17T14:09:26.321Z', 'Inventory Adjustment (Loss): 2 pcs of Pampers Premium Big 4 (Reason: Damaged)', '2026-07-17T14:09:26.321Z', '2026-07-17T14:09:26.321Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (23, 20, 200000, '2026-07-17T00:00:00.000Z', 'aasa', '2026-07-17T21:00:15.644Z', '2026-07-17T21:00:15.644Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (22, 14, 20000, '2026-07-16T00:00:00.000Z', 'Parathas etc', '2026-07-17T20:32:52.052Z', '2026-07-17T21:08:13.982Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (25, 19, 6000, '2026-07-17T21:12:10.484Z', 'Inventory Adjustment (Loss): 20 pcs of Johnsons Baby Wipes 80s (Reason: Damaged)', '2026-07-17T21:12:10.484Z', '2026-07-17T21:12:10.484Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (26, 19, 18000, '2026-07-17T21:12:22.061Z', 'Inventory Adjustment (Loss): 100 pcs of Soft Box Tissue (Reason: Damaged)', '2026-07-17T21:12:22.061Z', '2026-07-17T21:12:22.061Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (27, 19, 18000, '2026-07-17T21:13:01.457Z', 'Inventory Adjustment (Loss): 100 pcs of Soft Box Tissue (Reason: Damaged)', '2026-07-17T21:13:01.457Z', '2026-07-17T21:13:01.457Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (28, 19, 18000, '2026-07-17T21:14:46.403Z', 'Inventory Adjustment (Loss): 100 pcs of Soft Box Tissue (Reason: Expired)', '2026-07-17T21:14:46.403Z', '2026-07-17T21:14:46.403Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (29, 19, 15000, '2026-07-17T21:47:09.169Z', 'Inventory Adjustment (Loss): 100 pcs of Rose Petal Tissue Pack (Reason: Recount)', '2026-07-17T21:47:09.169Z', '2026-07-17T21:47:09.169Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (30, 19, 3000, '2026-07-17T21:55:49.661Z', 'Inventory Adjustment (Loss): 10 pcs of Johnsons Baby Wipes 80s (Reason: Damaged)', '2026-07-17T21:55:49.661Z', '2026-07-17T21:55:49.661Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (31, 19, 3000, '2026-07-17T21:56:09.858Z', 'Inventory Adjustment (Loss): 10 pcs of Johnsons Baby Wipes 80s (Reason: Expired)', '2026-07-17T21:56:09.858Z', '2026-07-17T21:56:09.858Z', 13);
INSERT INTO "Expense" ("id", "categoryId", "amount", "expenseDate", "description", "createdAt", "updatedAt", "createdById") VALUES (32, 19, 3200, '2026-07-17T22:22:30.926Z', 'Inventory Adjustment (Loss): 10 pcs of Sensodyne Rapid Action 70g (Reason: Damaged)', '2026-07-17T22:22:30.926Z', '2026-07-17T22:22:30.926Z', 13);

-- Reset identity sequence for Expense
SELECT setval(pg_get_serial_sequence('public."Expense"', 'id'), COALESCE(max(id), 1)) FROM "Expense";

-- ==========================================
-- Table: Category
-- ==========================================
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (11, 'diapers', '2026-07-17T09:18:06.232Z', '2026-07-17T09:18:06.232Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (12, 'tissues', '2026-07-17T09:18:14.117Z', '2026-07-17T09:18:14.117Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (13, 'wipes', '2026-07-17T09:18:20.884Z', '2026-07-17T09:18:20.884Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (14, 'soaps', '2026-07-17T09:18:28.311Z', '2026-07-17T09:19:24.359Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (16, 'adult diapers', '2026-07-17T13:37:11.080Z', '2026-07-17T13:52:41.543Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (17, 'SOAPS', '2026-07-17T22:00:05.650Z', '2026-07-17T22:00:05.650Z', true);
INSERT INTO "Category" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (18, 'TEST', '2026-07-17T22:00:16.946Z', '2026-07-17T22:00:16.946Z', true);

-- Reset identity sequence for Category
SELECT setval(pg_get_serial_sequence('public."Category"', 'id'), COALESCE(max(id), 1)) FROM "Category";

-- ==========================================
-- Table: StockMovement
-- ==========================================
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (48, 26, 'IN', 100, 'PURCHASE', 12, 13, 'Purchase PUR-000001', '2026-07-17T10:28:14.295Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (49, 27, 'IN', 200, 'PURCHASE', 12, 13, 'Purchase PUR-000001', '2026-07-17T10:28:14.302Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (50, 25, 'IN', 100, 'PURCHASE', 13, 13, 'Purchase PUR-000002', '2026-07-17T10:38:59.629Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (51, 29, 'IN', 200, 'PURCHASE', 13, 13, 'Purchase PUR-000002', '2026-07-17T10:38:59.632Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (52, 28, 'IN', 100, 'PURCHASE', 14, 13, 'Purchase PUR-000003', '2026-07-17T10:41:08.464Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (54, 28, 'IN', 1000, 'PURCHASE', 16, 13, 'Purchase PUR-000004', '2026-07-17T11:01:53.647Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (55, 27, 'IN', 10, 'PURCHASE', 17, 13, 'Purchase PUR-000005', '2026-07-17T11:09:20.400Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (57, 28, 'OUT', 100, 'PURCHASE_RETURN', 4, 13, 'Defective stock', '2026-07-17T11:13:22.659Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (58, 29, 'IN', 100, 'PURCHASE', 19, 13, 'Purchase PUR-000006', '2026-07-17T11:30:42.167Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (59, 29, 'OUT', 100, 'PURCHASE_RETURN', 5, 13, 'Defective stock', '2026-07-17T11:32:15.466Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (60, 26, 'OUT', 10, 'INVOICE', 11, 13, 'Invoice INV-000001', '2026-07-17T12:10:24.553Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (61, 26, 'IN', 3, 'SALES_RETURN', 7, 13, 'Defective items', '2026-07-17T12:10:24.614Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (62, 26, 'OUT', 5, 'INVOICE', 12, 13, 'Invoice INV-000002', '2026-07-17T12:10:24.649Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (63, 26, 'OUT', 5, 'INVOICE', 13, 13, 'Invoice INV-000003', '2026-07-17T12:10:24.681Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (64, 26, 'IN', 2, 'SALES_RETURN', 8, 13, 'Changed mind', '2026-07-17T12:10:24.718Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (65, 27, 'OUT', 10, 'INVOICE', 14, 13, 'Invoice INV-000001', '2026-07-17T12:11:23.256Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (66, 27, 'IN', 3, 'SALES_RETURN', 9, 13, 'Defective items', '2026-07-17T12:11:23.321Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (67, 27, 'OUT', 5, 'INVOICE', 15, 13, 'Invoice INV-000002', '2026-07-17T12:11:23.361Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (68, 27, 'OUT', 5, 'INVOICE', 16, 13, 'Invoice INV-000003', '2026-07-17T12:11:23.394Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (69, 27, 'IN', 2, 'SALES_RETURN', 10, 13, 'Changed mind', '2026-07-17T12:11:23.435Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (70, 29, 'OUT', 20, 'INVOICE', 17, 13, 'Invoice INV-000001', '2026-07-17T12:16:59.108Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (71, 27, 'OUT', 195, 'INVOICE', 18, 13, 'Invoice INV-000002', '2026-07-17T12:27:35.626Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (72, 25, 'OUT', 15, 'INVOICE', 19, 13, 'Invoice INV-000003', '2026-07-17T12:30:56.614Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (73, 28, 'OUT', 100, 'INVOICE', 19, 13, 'Invoice INV-000003', '2026-07-17T12:30:56.623Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (74, 28, 'OUT', 100, 'INVOICE', 20, 13, 'Invoice INV-000004', '2026-07-17T12:32:53.613Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (75, 29, 'OUT', 20, 'INVOICE', 21, 13, 'Invoice INV-000005', '2026-07-17T12:41:19.184Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (76, 29, 'IN', 20, 'SALES_RETURN', 11, 13, 'Don''t Like Product', '2026-07-17T12:45:49.097Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (77, 29, 'OUT', 10, 'ADJUSTMENT', 7, 13, NULL, '2026-07-17T13:59:05.218Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (78, 25, 'OUT', 2, 'ADJUSTMENT', 8, 13, 'Lost during audit testing', '2026-07-17T14:09:26.305Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (79, 29, 'IN', 10, 'ADJUSTMENT', 9, 13, 'testing', '2026-07-17T14:23:17.408Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (80, 29, 'IN', 20, 'ADJUSTMENT', 10, 13, NULL, '2026-07-17T21:11:56.837Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (81, 29, 'OUT', 20, 'ADJUSTMENT', 11, 13, NULL, '2026-07-17T21:12:10.481Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (82, 28, 'OUT', 100, 'ADJUSTMENT', 12, 13, NULL, '2026-07-17T21:12:22.056Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (83, 28, 'OUT', 100, 'ADJUSTMENT', 13, 13, 'z', '2026-07-17T21:13:01.453Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (84, 28, 'OUT', 100, 'ADJUSTMENT', 14, 13, NULL, '2026-07-17T21:14:46.399Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (85, 27, 'IN', 100, 'ADJUSTMENT', 15, 13, 'Added', '2026-07-17T21:46:25.825Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (86, 27, 'OUT', 100, 'ADJUSTMENT', 16, 13, NULL, '2026-07-17T21:47:09.158Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (87, 29, 'IN', 20, 'ADJUSTMENT', 17, 13, NULL, '2026-07-17T21:54:21.340Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (88, 29, 'OUT', 100, 'ADJUSTMENT', 18, 13, NULL, '2026-07-17T21:55:23.209Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (89, 29, 'OUT', 10, 'ADJUSTMENT', 19, 13, NULL, '2026-07-17T21:55:49.651Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (90, 29, 'OUT', 10, 'ADJUSTMENT', 20, 13, NULL, '2026-07-17T21:56:09.853Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (91, 36, 'OUT', 10, 'ADJUSTMENT', 21, 13, NULL, '2026-07-17T22:22:30.910Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (92, 36, 'IN', 10, 'ADJUSTMENT', 22, 13, NULL, '2026-07-17T22:22:56.384Z');
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "referenceType", "referenceId", "createdById", "description", "createdAt") VALUES (93, 28, 'IN', 50, 'SALES_RETURN', 12, 13, 'Awein', '2026-07-17T22:24:07.559Z');

-- Reset identity sequence for StockMovement
SELECT setval(pg_get_serial_sequence('public."StockMovement"', 'id'), COALESCE(max(id), 1)) FROM "StockMovement";

-- ==========================================
-- Table: StockAdjustment
-- ==========================================
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (7, 29, -10, 'Expired', NULL, 13, '2026-07-17T13:59:05.184Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (8, 25, -2, 'Damaged', 'Lost during audit testing', 13, '2026-07-17T14:09:26.284Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (9, 29, 10, 'Recount', 'testing', 13, '2026-07-17T14:23:17.386Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (10, 29, 20, 'Damaged', NULL, 13, '2026-07-17T21:11:56.828Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (11, 29, -20, 'Damaged', NULL, 13, '2026-07-17T21:12:10.476Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (12, 28, -100, 'Damaged', NULL, 13, '2026-07-17T21:12:22.053Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (13, 28, -100, 'Damaged', 'z', 13, '2026-07-17T21:13:01.449Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (14, 28, -100, 'Expired', NULL, 13, '2026-07-17T21:14:46.395Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (15, 27, 100, 'Recount', 'Added', 13, '2026-07-17T21:46:25.817Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (16, 27, -100, 'Recount', NULL, 13, '2026-07-17T21:47:09.154Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (17, 29, 20, 'Recount', NULL, 13, '2026-07-17T21:54:21.317Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (18, 29, -100, 'Recount', NULL, 13, '2026-07-17T21:55:23.205Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (19, 29, -10, 'Damaged', NULL, 13, '2026-07-17T21:55:49.647Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (20, 29, -10, 'Expired', NULL, 13, '2026-07-17T21:56:09.850Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (21, 36, -10, 'Damaged', NULL, 13, '2026-07-17T22:22:30.889Z');
INSERT INTO "StockAdjustment" ("id", "productId", "quantity", "reason", "notes", "createdById", "createdAt") VALUES (22, 36, 10, 'Recount', NULL, 13, '2026-07-17T22:22:56.375Z');

-- Reset identity sequence for StockAdjustment
SELECT setval(pg_get_serial_sequence('public."StockAdjustment"', 'id'), COALESCE(max(id), 1)) FROM "StockAdjustment";

-- ==========================================
-- Table: Supplier
-- ==========================================
INSERT INTO "Supplier" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (15, 'P&G Distributor', '03151234567', 'Karachi, Sindh', 700, true, '2026-07-17T09:52:31.582Z', '2026-07-17T11:09:20.414Z');
INSERT INTO "Supplier" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (18, 'Unilever Pakistan INT', '03001234567', 'Karachi, Sindh', 0, true, '2026-07-17T09:54:24.581Z', '2026-07-17T11:10:28.254Z');
INSERT INTO "Supplier" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (16, 'Unilever Pakistan', '03001234567', 'Karachi, Sindh', 220000, true, '2026-07-17T09:52:55.717Z', '2026-07-17T11:32:15.467Z');

-- Reset identity sequence for Supplier
SELECT setval(pg_get_serial_sequence('public."Supplier"', 'id'), COALESCE(max(id), 1)) FROM "Supplier";

-- ==========================================
-- Table: Customer
-- ==========================================
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (21, 'Sigma Mart', '03001234567', 'Jail Road, Quetta', 0, true, '2026-07-17T09:46:44.652Z', '2026-07-17T12:41:44.931Z');
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (20, 'Super Mart', '03001234567', 'Jail Road, Quetta', 31500, true, '2026-07-17T09:45:48.178Z', '2026-07-17T22:24:07.568Z');
INSERT INTO "Customer" ("id", "name", "phone", "address", "balance", "isActive", "createdAt", "updatedAt") VALUES (19, 'Ahmed Khan', '03151234567', 'Jinnah Road, Quetta', 0, true, '2026-07-17T09:44:20.125Z', '2026-07-17T09:46:28.249Z');

-- Reset identity sequence for Customer
SELECT setval(pg_get_serial_sequence('public."Customer"', 'id'), COALESCE(max(id), 1)) FROM "Customer";

-- ==========================================
-- Table: Product
-- ==========================================
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (25, 'Pampers Premium Big 4', '8964001234558', 'PAMP-PC-J03', 11, 80, 100, 98, 10, 10, true, '2026-07-17T09:23:53.408Z', '2026-07-17T14:09:26.301Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (30, 'Premium D A', NULL, 'SHEILD-ROK-j2', 16, 600, 2000, 0, 10, 30, true, '2026-07-17T21:26:32.745Z', '2026-07-17T21:26:32.745Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (31, 'Pampers Active Baby Size 3', '8001090123451', 'PAMP-AB-S3', 11, 2200, 2500, 50, 10, 48, true, '2026-07-17T21:29:03.782Z', '2026-07-17T21:29:03.782Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (32, 'Rose Petal Maxob Roll', '8961012345671', 'RP-MAXOB', 12, 180, 220, 120, 25, 12, true, '2026-07-17T21:29:03.789Z', '2026-07-17T21:29:03.789Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (33, 'Johnson''s Baby Powder 200g', '3574660456123', 'JB-POWDER200', 13, 450, 520, 80, 15, 24, true, '2026-07-17T21:29:03.792Z', '2026-07-17T21:29:03.792Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (34, 'Lux Soft Touch Soap 150g', '8901030753421', 'LUX-SOFT150', 14, 110, 135, 200, 30, 72, true, '2026-07-17T21:29:03.795Z', '2026-07-17T21:29:03.795Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (35, 'Safeguard Lemon Fresh 135g', '4902430752189', 'SG-LEMON135', 14, 115, 140, 150, 20, 72, true, '2026-07-17T21:29:03.798Z', '2026-07-17T21:29:03.798Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (27, 'Rose Petal Tissue Pack', NULL, 'RP-TISSUE', 12, 150, 200, 0, 50, NULL, true, '2026-07-17T09:26:00.340Z', '2026-07-17T21:47:09.157Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (29, 'Johnsons Baby Wipes 80s', NULL, 'JB-WIPES80', 13, 300, 380, 80, 30, NULL, true, '2026-07-17T09:29:47.460Z', '2026-07-17T21:56:09.852Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (36, 'Sensodyne Rapid Action 70g', '5010158063012', 'SENSO-RAPID70', 14, 320, 380, 90, 15, 48, true, '2026-07-17T21:29:03.801Z', '2026-07-17T22:22:56.380Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (28, 'Soft Box Tissue', NULL, 'SOFT-TISSUE', 12, 180, 250, 550, 10, NULL, true, '2026-07-17T09:26:57.851Z', '2026-07-17T22:24:07.554Z');
INSERT INTO "Product" ("id", "name", "barcode", "sku", "categoryId", "costPrice", "sellingPrice", "stockQuantity", "lowStockLevel", "piecesPerCarton", "isActive", "createdAt", "updatedAt") VALUES (26, 'Pampers Premium Adult', '8964001234559', 'PAMP-PC-J01', 11, 100, 120, 95, 5, 20, true, '2026-07-17T09:24:44.455Z', '2026-07-17T12:10:24.717Z');

-- Reset identity sequence for Product
SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE(max(id), 1)) FROM "Product";

-- ==========================================
-- Table: Salesman
-- ==========================================
INSERT INTO "Salesman" ("id", "name", "phone", "isActive", "createdAt", "updatedAt") VALUES (12, 'Akram Khan', '03151234567', true, '2026-07-17T09:56:43.459Z', '2026-07-17T09:57:50.374Z');
INSERT INTO "Salesman" ("id", "name", "phone", "isActive", "createdAt", "updatedAt") VALUES (13, 'Sudheer', '03322223222', true, '2026-07-17T12:42:44.214Z', '2026-07-17T12:42:44.214Z');

-- Reset identity sequence for Salesman
SELECT setval(pg_get_serial_sequence('public."Salesman"', 'id'), COALESCE(max(id), 1)) FROM "Salesman";

-- ==========================================
-- Table: CustomerPayment
-- ==========================================
INSERT INTO "CustomerPayment" ("id", "customerId", "invoiceId", "amount", "paymentDate", "description", "createdById", "createdAt") VALUES (16, 20, 19, 26500, '2026-07-16T00:00:00.000Z', 'Cash paid upfront for Invoice INV-000003', 13, '2026-07-17T12:30:56.626Z');
INSERT INTO "CustomerPayment" ("id", "customerId", "invoiceId", "amount", "paymentDate", "description", "createdById", "createdAt") VALUES (17, 20, 20, 20000, '2026-07-17T12:32:53.597Z', 'Cash paid upfront for Invoice INV-000004', 13, '2026-07-17T12:32:53.618Z');
INSERT INTO "CustomerPayment" ("id", "customerId", "invoiceId", "amount", "paymentDate", "description", "createdById", "createdAt") VALUES (18, 21, 21, 5000, '2026-07-17T12:41:19.172Z', 'Cash paid upfront for Invoice INV-000005', 13, '2026-07-17T12:41:19.189Z');
INSERT INTO "CustomerPayment" ("id", "customerId", "invoiceId", "amount", "paymentDate", "description", "createdById", "createdAt") VALUES (19, 21, 21, 2000, '2026-07-17T00:00:00.000Z', NULL, 13, '2026-07-17T12:41:44.921Z');

-- Reset identity sequence for CustomerPayment
SELECT setval(pg_get_serial_sequence('public."CustomerPayment"', 'id'), COALESCE(max(id), 1)) FROM "CustomerPayment";

-- ==========================================
-- Table: SupplierPayment
-- ==========================================
INSERT INTO "SupplierPayment" ("id", "supplierId", "purchaseId", "amount", "paymentDate", "description", "createdById", "createdAt") VALUES (6, 16, 12, 20000, '2026-07-16T00:00:00.000Z', 'Cash paid for Purchase PUR-000001', 13, '2026-07-17T10:28:14.305Z');
INSERT INTO "SupplierPayment" ("id", "supplierId", "purchaseId", "amount", "paymentDate", "description", "createdById", "createdAt") VALUES (7, 16, 14, 18000, '2026-07-15T00:00:00.000Z', 'Cash paid for Purchase PUR-000003', 13, '2026-07-17T10:41:08.466Z');
INSERT INTO "SupplierPayment" ("id", "supplierId", "purchaseId", "amount", "paymentDate", "description", "createdById", "createdAt") VALUES (10, 16, 19, 30000, '2026-07-17T00:00:00.000Z', 'Cash paid for Purchase PUR-000006', 13, '2026-07-17T11:30:42.169Z');

-- Reset identity sequence for SupplierPayment
SELECT setval(pg_get_serial_sequence('public."SupplierPayment"', 'id'), COALESCE(max(id), 1)) FROM "SupplierPayment";

-- ==========================================
-- Table: Purchase
-- ==========================================
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (12, 'PUR-000001', 16, '2026-07-16T00:00:00.000Z', 40000, 0, 40000, 'Supplier buy-in', 13, '2026-07-17T10:28:14.279Z', 20000, 20000, 'PARTIALLY_PAID', 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (13, 'PUR-000002', 16, '2026-07-17T00:00:00.000Z', 68000, 0, 68000, 'Supplier buy-in', 13, '2026-07-17T10:38:59.623Z', 68000, 0, 'UNPAID', 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (14, 'PUR-000003', 16, '2026-07-15T00:00:00.000Z', 18000, 0, 18000, 'Supplier buy-in', 13, '2026-07-17T10:41:08.459Z', 0, 18000, 'PAID', 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (16, 'PUR-000004', 16, '2026-07-17T11:01:53.626Z', 180000, 0, 180000, 'Soap Buying', 13, '2026-07-17T11:01:53.635Z', 180000, 0, 'UNPAID', 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (17, 'PUR-000005', 15, '2026-07-17T11:09:20.355Z', 1000, 0, 1000, 'Verification Base Purchase', 13, '2026-07-17T11:09:20.384Z', 1000, 0, 'UNPAID', 0);
INSERT INTO "Purchase" ("id", "purchaseNo", "supplierId", "purchaseDate", "subtotal", "discount", "total", "description", "createdById", "createdAt", "balanceDue", "paidAmount", "status", "creditApplied") VALUES (19, 'PUR-000006', 16, '2026-07-17T00:00:00.000Z', 30000, 0, 30000, 'Supplier buy-in', 13, '2026-07-17T11:30:42.153Z', 0, 30000, 'PAID', 0);

-- Reset identity sequence for Purchase
SELECT setval(pg_get_serial_sequence('public."Purchase"', 'id'), COALESCE(max(id), 1)) FROM "Purchase";

-- ==========================================
-- Table: SalesTarget
-- ==========================================
INSERT INTO "SalesTarget" ("id", "salesmanId", "month", "targetAmount", "description", "createdById", "createdAt", "updatedAt") VALUES (12, 12, '2026-06-01T00:00:00.000Z', 15000, 'July FMCG sales target', 13, '2026-07-17T10:00:37.992Z', '2026-07-17T10:01:12.264Z');
INSERT INTO "SalesTarget" ("id", "salesmanId", "month", "targetAmount", "description", "createdById", "createdAt", "updatedAt") VALUES (13, 12, '2026-07-01T00:00:00.000Z', 15000, 'FMCG target', 13, '2026-07-17T10:05:03.763Z', '2026-07-17T10:05:03.763Z');

-- Reset identity sequence for SalesTarget
SELECT setval(pg_get_serial_sequence('public."SalesTarget"', 'id'), COALESCE(max(id), 1)) FROM "SalesTarget";

-- ==========================================
-- Table: User
-- ==========================================
INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (13, 'Sameer Katija', 'sameer', 'sameerkatija@gmail.com', '$2b$10$Q4GZ7A688Q1IoHQ9R4l66ezpkWlpB613Bn5eeT9S/DMvAlyi9ZuMa', 'ADMIN', true, '2026-07-17T13:44:36.901Z', '2026-07-17T09:12:17.606Z', '2026-07-17T13:44:36.930Z');
INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (14, 'Staff', 'staff', NULL, '$2b$10$maJs9F1wEH2fsmkf/rhjK.Jz8YD2oO4jO4p.JeTumHDakHh.Ejjg2', 'STAFF', true, '2026-07-17T21:24:09.340Z', '2026-07-17T21:18:10.935Z', '2026-07-17T21:24:09.342Z');

-- Reset identity sequence for User
SELECT setval(pg_get_serial_sequence('public."User"', 'id'), COALESCE(max(id), 1)) FROM "User";

-- ==========================================
-- Table: PurchaseItem
-- ==========================================
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (17, 12, 26, 100, 100, 10000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (18, 12, 27, 200, 150, 30000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (19, 13, 25, 100, 80, 8000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (20, 13, 29, 200, 300, 60000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (21, 14, 28, 100, 180, 18000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (23, 16, 28, 1000, 180, 180000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (24, 17, 27, 10, 100, 1000);
INSERT INTO "PurchaseItem" ("id", "purchaseId", "productId", "quantity", "unitCost", "totalCost") VALUES (26, 19, 29, 100, 300, 30000);

-- Reset identity sequence for PurchaseItem
SELECT setval(pg_get_serial_sequence('public."PurchaseItem"', 'id'), COALESCE(max(id), 1)) FROM "PurchaseItem";

-- ==========================================
-- Table: PurchaseReturn
-- ==========================================
INSERT INTO "PurchaseReturn" ("id", "returnNo", "supplierId", "purchaseId", "returnDate", "totalAmount", "reason", "createdById", "createdAt") VALUES (4, 'PR-000001', 16, 14, '2026-07-17T00:00:00.000Z', 18000, 'Defective stock', 13, '2026-07-17T11:13:22.645Z');
INSERT INTO "PurchaseReturn" ("id", "returnNo", "supplierId", "purchaseId", "returnDate", "totalAmount", "reason", "createdById", "createdAt") VALUES (5, 'PR-000002', 16, 19, '2026-07-17T00:00:00.000Z', 30000, 'Defective stock', 13, '2026-07-17T11:32:15.459Z');

-- Reset identity sequence for PurchaseReturn
SELECT setval(pg_get_serial_sequence('public."PurchaseReturn"', 'id'), COALESCE(max(id), 1)) FROM "PurchaseReturn";

-- ==========================================
-- Table: PurchaseReturnItem
-- ==========================================
INSERT INTO "PurchaseReturnItem" ("id", "purchaseReturnId", "productId", "quantity", "unitCost", "totalCost") VALUES (4, 4, 28, 100, 180, 18000);
INSERT INTO "PurchaseReturnItem" ("id", "purchaseReturnId", "productId", "quantity", "unitCost", "totalCost") VALUES (5, 5, 29, 100, 300, 30000);

-- Reset identity sequence for PurchaseReturnItem
SELECT setval(pg_get_serial_sequence('public."PurchaseReturnItem"', 'id'), COALESCE(max(id), 1)) FROM "PurchaseReturnItem";

-- ==========================================
-- Table: InvoiceItem
-- ==========================================
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (21, 17, 29, 20, 380, 300, 7600);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (22, 18, 27, 195, 200, 150, 39000);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (23, 19, 25, 15, 100, 80, 1500);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (24, 19, 28, 100, 250, 180, 25000);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (25, 20, 28, 100, 250, 180, 25000);
INSERT INTO "InvoiceItem" ("id", "invoiceId", "productId", "quantity", "unitPrice", "costPriceAtSale", "totalPrice") VALUES (26, 21, 29, 20, 380, 300, 7600);

-- Reset identity sequence for InvoiceItem
SELECT setval(pg_get_serial_sequence('public."InvoiceItem"', 'id'), COALESCE(max(id), 1)) FROM "InvoiceItem";

-- ==========================================
-- Table: SalesReturnItem
-- ==========================================
INSERT INTO "SalesReturnItem" ("id", "salesReturnId", "productId", "quantity", "unitPrice", "totalPrice") VALUES (11, 11, 29, 20, 300, 6000);
INSERT INTO "SalesReturnItem" ("id", "salesReturnId", "productId", "quantity", "unitPrice", "totalPrice") VALUES (12, 12, 28, 50, 250, 12500);

-- Reset identity sequence for SalesReturnItem
SELECT setval(pg_get_serial_sequence('public."SalesReturnItem"', 'id'), COALESCE(max(id), 1)) FROM "SalesReturnItem";

-- ==========================================
-- Table: SupplierLedger
-- ==========================================
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (20, 16, 0, 40000, 40000, 'PURCHASE', 12, 'Purchase PUR-000001', '2026-07-17T10:28:14.314Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (21, 16, 20000, 0, 20000, 'PURCHASE', 12, 'Payment for Purchase PUR-000001', '2026-07-17T10:28:14.318Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (22, 16, 0, 68000, 88000, 'PURCHASE', 13, 'Purchase PUR-000002', '2026-07-17T10:38:59.635Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (23, 16, 0, 18000, 106000, 'PURCHASE', 14, 'Purchase PUR-000003', '2026-07-17T10:41:08.469Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (24, 16, 18000, 0, 88000, 'PURCHASE', 14, 'Payment for Purchase PUR-000003', '2026-07-17T10:41:08.473Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (27, 16, 0, 180000, 268000, 'PURCHASE', 16, 'Purchase PUR-000004', '2026-07-17T11:01:53.655Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (28, 15, 0, 1000, 1000, 'PURCHASE', 17, 'Purchase PUR-000005', '2026-07-17T11:09:20.406Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (30, 16, 18000, 0, 250000, 'PURCHASE_RETURN', 4, 'Purchase Return PR-000001 for Purchase PUR-000003', '2026-07-17T11:13:22.665Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (31, 16, 0, 30000, 280000, 'PURCHASE', 19, 'Purchase PUR-000006', '2026-07-17T11:30:42.175Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (32, 16, 30000, 0, 250000, 'PURCHASE', 19, 'Payment for Purchase PUR-000006', '2026-07-17T11:30:42.180Z');
INSERT INTO "SupplierLedger" ("id", "supplierId", "debit", "credit", "balance", "referenceType", "referenceId", "notes", "createdAt") VALUES (33, 16, 30000, 0, 220000, 'PURCHASE_RETURN', 5, 'Purchase Return PR-000002 for Purchase PUR-000006', '2026-07-17T11:32:15.468Z');

-- Reset identity sequence for SupplierLedger
SELECT setval(pg_get_serial_sequence('public."SupplierLedger"', 'id'), COALESCE(max(id), 1)) FROM "SupplierLedger";

-- ==========================================
-- Table: Invoice
-- ==========================================
INSERT INTO "Invoice" ("id", "invoiceNo", "customerId", "salesmanId", "saleType", "invoiceDate", "subtotal", "discount", "total", "paidAmount", "balanceDue", "status", "description", "createdById", "createdAt", "creditApplied") VALUES (17, 'INV-000001', NULL, NULL, 'CASH', '2026-07-17T12:16:59.040Z', 7600, 0, 7600, 7600, 0, 'PAID', NULL, 13, '2026-07-17T12:16:59.071Z', 0);
INSERT INTO "Invoice" ("id", "invoiceNo", "customerId", "salesmanId", "saleType", "invoiceDate", "subtotal", "discount", "total", "paidAmount", "balanceDue", "status", "description", "createdById", "createdAt", "creditApplied") VALUES (18, 'INV-000002', 20, NULL, 'CREDIT', '2026-07-16T00:00:00.000Z', 39000, 0, 39000, 0, 39000, 'UNPAID', 'Invoice sale', 13, '2026-07-17T12:27:35.610Z', 0);
INSERT INTO "Invoice" ("id", "invoiceNo", "customerId", "salesmanId", "saleType", "invoiceDate", "subtotal", "discount", "total", "paidAmount", "balanceDue", "status", "description", "createdById", "createdAt", "creditApplied") VALUES (19, 'INV-000003', 20, NULL, 'CASH', '2026-07-16T00:00:00.000Z', 26500, 0, 26500, 26500, 0, 'PAID', 'Invoice sale', 13, '2026-07-17T12:30:56.598Z', 0);
INSERT INTO "Invoice" ("id", "invoiceNo", "customerId", "salesmanId", "saleType", "invoiceDate", "subtotal", "discount", "total", "paidAmount", "balanceDue", "status", "description", "createdById", "createdAt", "creditApplied") VALUES (20, 'INV-000004', 20, 12, 'CREDIT', '2026-07-17T12:32:53.597Z', 25000, 0, 25000, 20000, 5000, 'PARTIALLY_PAID', NULL, 13, '2026-07-17T12:32:53.600Z', 0);
INSERT INTO "Invoice" ("id", "invoiceNo", "customerId", "salesmanId", "saleType", "invoiceDate", "subtotal", "discount", "total", "paidAmount", "balanceDue", "status", "description", "createdById", "createdAt", "creditApplied") VALUES (21, 'INV-000005', 21, NULL, 'CREDIT', '2026-07-17T12:41:19.172Z', 7600, 600, 7000, 7000, 0, 'PAID', NULL, 13, '2026-07-17T12:41:19.174Z', 0);

-- Reset identity sequence for Invoice
SELECT setval(pg_get_serial_sequence('public."Invoice"', 'id'), COALESCE(max(id), 1)) FROM "Invoice";

-- ==========================================
-- Table: SalesReturn
-- ==========================================
INSERT INTO "SalesReturn" ("id", "returnNo", "customerId", "invoiceId", "returnDate", "totalAmount", "reason", "createdById", "createdAt", "refundType") VALUES (11, 'SR-000001', NULL, 17, '2026-07-17T00:00:00.000Z', 6000, 'Don''t Like Product', 13, '2026-07-17T12:45:49.084Z', 'CREDIT');
INSERT INTO "SalesReturn" ("id", "returnNo", "customerId", "invoiceId", "returnDate", "totalAmount", "reason", "createdById", "createdAt", "refundType") VALUES (12, 'SR-000002', 20, 20, '2026-07-17T22:24:07.538Z', 12500, 'Awein', 13, '2026-07-17T22:24:07.540Z', 'CREDIT');

-- Reset identity sequence for SalesReturn
SELECT setval(pg_get_serial_sequence('public."SalesReturn"', 'id'), COALESCE(max(id), 1)) FROM "SalesReturn";

-- ==========================================
-- Table: ExpenseCategory
-- ==========================================
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (16, 'office rent', '2026-07-17T09:16:55.163Z', '2026-07-17T09:16:55.163Z', true);
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (17, 'staff salaries', '2026-07-17T09:17:04.845Z', '2026-07-17T09:17:04.845Z', true);
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (18, 'fuel & van transport', '2026-07-17T09:17:19.486Z', '2026-07-17T09:17:19.486Z', true);
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (14, 'food', '2026-07-17T09:14:44.913Z', '2026-07-17T13:58:06.565Z', true);
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (19, 'inventory loss/shrinkage', '2026-07-17T14:09:26.316Z', '2026-07-17T14:09:26.316Z', true);
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (20, 'test', '2026-07-17T21:00:00.339Z', '2026-07-17T21:00:00.339Z', true);
INSERT INTO "ExpenseCategory" ("id", "name", "createdAt", "updatedAt", "isActive") VALUES (22, 'OFFICE', '2026-07-17T22:00:24.495Z', '2026-07-17T22:00:24.495Z', true);

-- Reset identity sequence for ExpenseCategory
SELECT setval(pg_get_serial_sequence('public."ExpenseCategory"', 'id'), COALESCE(max(id), 1)) FROM "ExpenseCategory";

SET session_replication_role = 'origin';