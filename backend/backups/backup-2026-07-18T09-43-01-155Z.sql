-- Sameer Distributors IMS Database Backup
-- Generated at: 2026-07-18T09:43:01.111Z
-- Disable constraint triggers temporarily

SET session_replication_role = 'replica';

-- Clean existing data before inserting
TRUNCATE TABLE "CustomerLedger", "StockAdjustment", "Supplier", "Customer", "Product", "Salesman", "Purchase", "SalesTarget", "User", "Category", "PurchaseItem", "StockMovement", "PurchaseReturn", "PurchaseReturnItem", "InvoiceItem", "SalesReturnItem", "SupplierLedger", "Invoice", "CustomerPayment", "SupplierPayment", "SalesReturn", "ExpenseCategory", "Expense" RESTART IDENTITY CASCADE;

-- ==========================================
-- Table: CustomerLedger
-- ==========================================
-- No data for table CustomerLedger

-- ==========================================
-- Table: StockAdjustment
-- ==========================================
-- No data for table StockAdjustment

-- ==========================================
-- Table: Supplier
-- ==========================================
-- No data for table Supplier

-- ==========================================
-- Table: Customer
-- ==========================================
-- No data for table Customer

-- ==========================================
-- Table: Product
-- ==========================================
-- No data for table Product

-- ==========================================
-- Table: Salesman
-- ==========================================
-- No data for table Salesman

-- ==========================================
-- Table: Purchase
-- ==========================================
-- No data for table Purchase

-- ==========================================
-- Table: SalesTarget
-- ==========================================
-- No data for table SalesTarget

-- ==========================================
-- Table: User
-- ==========================================
INSERT INTO "User" ("id", "name", "username", "email", "password", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt") VALUES (1, 'Sameer Katija', 'sameer', 'sameerkatija@gmail.com', '$2b$10$KAB5B2pmUnJd70BvED7Owe6EKMLTeXweqTJ.Yc/Bn5ffnuZYeeWtC', 'ADMIN', true, '2026-07-18T09:42:52.831Z', '2026-07-18T09:29:35.611Z', '2026-07-18T09:42:52.855Z');

-- Reset identity sequence for User
SELECT setval(pg_get_serial_sequence('public."User"', 'id'), COALESCE(max(id), 1)) FROM "User";

-- ==========================================
-- Table: Category
-- ==========================================
-- No data for table Category

-- ==========================================
-- Table: PurchaseItem
-- ==========================================
-- No data for table PurchaseItem

-- ==========================================
-- Table: StockMovement
-- ==========================================
-- No data for table StockMovement

-- ==========================================
-- Table: PurchaseReturn
-- ==========================================
-- No data for table PurchaseReturn

-- ==========================================
-- Table: PurchaseReturnItem
-- ==========================================
-- No data for table PurchaseReturnItem

-- ==========================================
-- Table: InvoiceItem
-- ==========================================
-- No data for table InvoiceItem

-- ==========================================
-- Table: SalesReturnItem
-- ==========================================
-- No data for table SalesReturnItem

-- ==========================================
-- Table: SupplierLedger
-- ==========================================
-- No data for table SupplierLedger

-- ==========================================
-- Table: Invoice
-- ==========================================
-- No data for table Invoice

-- ==========================================
-- Table: CustomerPayment
-- ==========================================
-- No data for table CustomerPayment

-- ==========================================
-- Table: SupplierPayment
-- ==========================================
-- No data for table SupplierPayment

-- ==========================================
-- Table: SalesReturn
-- ==========================================
-- No data for table SalesReturn

-- ==========================================
-- Table: ExpenseCategory
-- ==========================================
-- No data for table ExpenseCategory

-- ==========================================
-- Table: Expense
-- ==========================================
-- No data for table Expense

SET session_replication_role = 'origin';