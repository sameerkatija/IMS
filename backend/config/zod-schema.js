const z = require("zod");

exports.signUpSchema = z.object({
  name: z
    .string({ required_error: "Name is required." })
    .trim()
    .min(2, { message: "Name must be at least 2 characters." })
    .max(100, { message: "Name cannot exceed 100 characters." })
    .regex(/^[A-Za-z\s]+$/, {
      message: "Name can only contain letters and spaces.",
    }),

  username: z
    .string({ required_error: "Username is required." })
    .trim()
    .min(3, { message: "Username must be at least 3 characters." })
    .max(30, { message: "Username cannot exceed 30 characters." }),

  email: z
    .string({ required_error: "Email is required." })
    .trim()
    .toLowerCase()
    .email({ message: "Email must be valid." })
    .optional()
    .or(z.literal("")),

  role: z.enum(["ADMIN", "STAFF"], {
    errorMap: () => ({ message: "Role must be either ADMIN or STAFF." })
  }).optional(),

  password: z
    .string({ required_error: "Password is required." })
    .min(8, { message: "Password must be at least 8 characters." })
    .max(100, { message: "Password cannot exceed 100 characters." }),

  confirmPassword: z
    .string({ required_error: "Confirm Password is required." })
    .min(8, { message: "Confirm Password must be at least 8 characters." })
    .max(100, { message: "Confirm Password cannot exceed 100 characters." }),

  registrationSecret: z.string({ required_error: "Registration secret is required." }).optional(),
});

exports.signInSchema = z.object({
  username: z
    .string({ required_error: "Username is required." })
    .trim()
    .min(3, { message: "Username must be at least 3 characters." })
    .max(30, { message: "Username cannot exceed 30 characters." }),
  password: z
    .string({ required_error: "Password is required." })
    .min(8, { message: "Password must be at least 8 characters." })
    .max(100, { message: "Password cannot exceed 100 characters." }),
});

exports.CategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required." })
    .trim()
    .min(1, { message: "Category name cannot be empty." })
    .max(100, { message: "Category name cannot exceed 100 characters." }),
  // isActive: z
  //   .boolean({ invalid_type_error: "isActive must be a boolean." })
  //   .optional(),

});

// Create Expense
exports.createExpenseSchema = z.object({
  categoryId: z
    .number({
      required_error: "Expense category is required.",
      invalid_type_error: "Expense category must be a number.",
    })
    .int({ message: "Expense category must be a valid integer." })
    .positive({ message: "Expense category must be greater than 0." }),

  amount: z
    .number({
      required_error: "Amount is required.",
      invalid_type_error: "Amount must be a number.",
    })
    .positive({ message: "Amount must be greater than 0." }),

  expenseDate: z
    .coerce.date({
      required_error: "Expense date is required.",
      invalid_type_error: "Expense date must be a valid date.",
    })
    .optional(),

  description: z
    .string()
    .trim()
    .max(255, {
      message: "Description cannot exceed 255 characters.",
    })
    .optional(),
});

// Update Expense
exports.updateExpenseSchema = z.object({
  categoryId: z
    .number({
      required_error: "Expense category is required.",
      invalid_type_error: "Expense category must be a number.",
    })
    .int({ message: "Expense category must be a valid integer." })
    .positive({ message: "Expense category must be greater than 0." }),

  amount: z
    .number({
      required_error: "Amount is required.",
      invalid_type_error: "Amount must be a number.",
    })
    .positive({ message: "Amount must be greater than 0." }),

  expenseDate: z
    .coerce.date({
      required_error: "Expense date is required.",
      invalid_type_error: "Expense date must be a valid date.",
    })
    .optional(),

  description: z
    .string()
    .trim()
    .max(255, {
      message: "Description cannot exceed 255 characters.",
    })
    .optional(),
});

exports.productSchema = z.object({
  name: z
    .string({ required_error: "Product name is required." })
    .trim()
    .min(2, { message: "Product name must be at least 2 characters." })
    .max(150, { message: "Product name cannot exceed 150 characters." }),
  barcode: z
    .string()
    .trim()
    .max(50, { message: "Barcode cannot exceed 50 characters." })
    .optional()
    .nullable(),
  sku: z
    .string()
    .trim()
    .max(50, { message: "SKU cannot exceed 50 characters." })
    .optional()
    .nullable(),
  size: z
    .string()
    .trim()
    .max(50, { message: "Size cannot exceed 50 characters." })
    .optional()
    .nullable(),
  categoryId: z
    .coerce.number({ required_error: "Category ID is required.", invalid_type_error: "Category ID must be a number." })
    .int({ message: "Category ID must be a valid integer." })
    .positive({ message: "Category ID must be a positive integer." }),
  costPrice: z
    .coerce.number({ required_error: "Cost price is required.", invalid_type_error: "Cost price must be a number." })
    .positive({ message: "Cost price must be greater than 0." }),
  sellingPrice: z
    .coerce.number({ required_error: "Selling price is required.", invalid_type_error: "Selling price must be a number." })
    .positive({ message: "Selling price must be greater than 0." }),
  lowStockLevel: z
    .coerce.number({ invalid_type_error: "Low stock level must be a number." })
    .int({ message: "Low stock level must be an integer." })
    .nonnegative({ message: "Low stock level cannot be negative." })
    .default(0),
  piecesPerCarton: z
    .coerce.number({ invalid_type_error: "Pieces per carton must be a number." })
    .int({ message: "Pieces per carton must be an integer." })
    .positive({ message: "Pieces per carton must be a positive integer." })
    .optional()
    .nullable(),
  isActive: z
    .boolean({ invalid_type_error: "isActive must be a boolean." })
    .optional(),
});

exports.customerSchema = z.object({
  name: z
    .string({ required_error: "Customer name is required." })
    .trim()
    .min(2, { message: "Customer name must be at least 2 characters." })
    .max(150, { message: "Customer name cannot exceed 150 characters." }),
  phone: z
    .string()
    .trim()
    .min(10, { message: "Phone number must be at least 10 characters." })
    .max(14, { message: "Phone number cannot exceed 14 characters." })
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .max(255, { message: "Address cannot exceed 255 characters." })
    .optional()
    .nullable(),
  isActive: z
    .boolean({ invalid_type_error: "isActive must be a boolean." })
    .optional(),
});

exports.supplierSchema = z.object({
  name: z
    .string({ required_error: "Supplier name is required." })
    .trim()
    .min(2, { message: "Supplier name must be at least 2 characters." })
    .max(150, { message: "Supplier name cannot exceed 150 characters." }),
  phone: z
    .string()
    .trim()
    .min(10, { message: "Phone number must be at least 10 characters." })
    .max(14, { message: "Phone number cannot exceed 14 characters." })
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .max(255, { message: "Address cannot exceed 255 characters." })
    .optional()
    .nullable(),
  isActive: z
    .boolean({ invalid_type_error: "isActive must be a boolean." })
    .optional(),
});

exports.salesmanSchema = z.object({
  name: z
    .string({ required_error: "Salesman name is required." })
    .trim()
    .min(2, { message: "Salesman name must be at least 2 characters." })
    .max(150, { message: "Salesman name cannot exceed 150 characters." }),
  phone: z
    .string()
    .trim()
    .min(10, { message: "Phone number must be at least 10 characters." })
    .max(14, { message: "Phone number cannot exceed 14 characters." })
    .optional()
    .nullable(),
  isActive: z
    .boolean({ invalid_type_error: "isActive must be a boolean." })
    .optional(),
});

exports.setTargetSchema = z.object({
  salesmanId: z
    .coerce.number({ required_error: "Salesman ID is required.", invalid_type_error: "Salesman ID must be a number." })
    .int({ message: "Salesman ID must be an integer." })
    .positive({ message: "Salesman ID must be a positive integer." }),
  month: z
    .string({ required_error: "Month is required." })
    .regex(/^\d{4}-\d{2}$/, { message: "Month must be in YYYY-MM format." }),
  targetAmount: z
    .coerce.number({ required_error: "Target amount is required.", invalid_type_error: "Target amount must be a number." })
    .positive({ message: "Target amount must be a positive number." }),
  description: z
    .string()
    .trim()
    .max(255, { message: "Description cannot exceed 255 characters." })
    .optional()
    .nullable(),
});

exports.updateTargetSchema = z.object({
  targetAmount: z
    .coerce.number({ required_error: "Target amount is required.", invalid_type_error: "Target amount must be a number." })
    .positive({ message: "Target amount must be a positive number." }),
  description: z
    .string()
    .trim()
    .max(255, { message: "Description cannot exceed 255 characters." })
    .optional()
    .nullable(),
});

exports.createAdjustmentSchema = z.object({
  productId: z
    .coerce.number({ required_error: "Product ID is required.", invalid_type_error: "Product ID must be a number." })
    .int({ message: "Product ID must be an integer." })
    .positive({ message: "Product ID must be a positive integer." }),
  quantity: z
    .coerce.number({ required_error: "Quantity is required.", invalid_type_error: "Quantity must be a number." })
    .int({ message: "Quantity must be an integer." })
    .refine((val) => val !== 0, {
      message: "Quantity cannot be zero.",
    }),
  reason: z
    .string({ required_error: "Reason is required." })
    .trim()
    .min(1, { message: "Reason cannot be empty." }),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  secretKey: z
    .string({ required_error: "Secret key is required." })
    .trim()
    .min(1, { message: "Secret key cannot be empty." }),
});

exports.listMovementsQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "Page must be a number." }).int({ message: "Page must be an integer." }).min(1, { message: "Page must be at least 1." }).optional()
  ),
  limit: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "Limit must be a number." }).int({ message: "Limit must be an integer." }).min(1, { message: "Limit must be at least 1." }).optional()
  ),
  productId: z.preprocess(
    (val) => (val === undefined || val === "" ? undefined : Number(val)),
    z.number({ invalid_type_error: "Product ID must be a number." }).int({ message: "Product ID must be an integer." }).optional()
  ),
  type: z.enum(["IN", "OUT"], {
    errorMap: () => ({ message: "Type must be IN or OUT." })
  }).optional(),
  referenceType: z.enum(["PURCHASE", "INVOICE", "SALES_RETURN", "PURCHASE_RETURN", "ADJUSTMENT"], {
    errorMap: () => ({ message: "Reference type must be PURCHASE, INVOICE, SALES_RETURN, PURCHASE_RETURN, or ADJUSTMENT." })
  }).optional(),
});

exports.createPurchaseSchema = z.object({
  supplierId: z
    .coerce.number({ required_error: "Supplier ID is required.", invalid_type_error: "Supplier ID must be a number." })
    .int({ message: "Supplier ID must be an integer." })
    .positive({ message: "Supplier ID must be a positive integer." }),
  purchaseDate: z
    .coerce.date({ invalid_type_error: "Purchase date must be a valid date." })
    .optional(),
  discount: z
    .coerce.number({ invalid_type_error: "Discount must be a number." })
    .nonnegative({ message: "Discount must be a non-negative number." })
    .default(0)
    .optional(),
  paidAmount: z
    .coerce.number({ invalid_type_error: "Paid amount must be a number." })
    .nonnegative({ message: "Paid amount cannot be negative." })
    .default(0)
    .optional(),
  creditApplied: z
    .coerce.number({ invalid_type_error: "Credit applied must be a number." })
    .nonnegative({ message: "Credit applied cannot be negative." })
    .default(0)
    .optional(),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  items: z.array(
    z.object({
      productId: z
        .coerce.number({ required_error: "Product ID is required.", invalid_type_error: "Product ID must be a number." })
        .int({ message: "Product ID must be an integer." })
        .positive({ message: "Product ID must be a positive integer." }),
      quantity: z
        .coerce.number({ required_error: "Quantity is required.", invalid_type_error: "Quantity must be a number." })
        .int({ message: "Quantity must be an integer." })
        .positive({ message: "Quantity must be a positive integer." }),
      unitCost: z
        .coerce.number({ required_error: "Unit cost is required.", invalid_type_error: "Unit cost must be a number." })
        .nonnegative({ message: "Unit cost must be a non-negative number." }),
      discount: z
        .coerce.number({ invalid_type_error: "Discount must be a number." })
        .nonnegative({ message: "Discount must be a non-negative number." })
        .default(0)
        .optional(),
    })
  ).nonempty({ message: "Purchase must contain at least one item." }),
});

exports.createPurchaseReturnSchema = z.object({
  supplierId: z
    .coerce.number({ required_error: "Supplier ID is required.", invalid_type_error: "Supplier ID must be a number." })
    .int({ message: "Supplier ID must be an integer." })
    .positive({ message: "Supplier ID must be a positive integer." }),
  purchaseId: z
    .coerce.number({ required_error: "Purchase ID is required.", invalid_type_error: "Purchase ID must be a number." })
    .int({ message: "Purchase ID must be an integer." })
    .positive({ message: "Purchase ID must be a positive integer." }),
  returnDate: z
    .coerce.date({ invalid_type_error: "Return date must be a valid date." })
    .optional(),
  reason: z
    .string()
    .trim()
    .optional()
    .nullable(),

  items: z.array(
    z.object({
      productId: z
        .coerce.number({ required_error: "Product ID is required.", invalid_type_error: "Product ID must be a number." })
        .int({ message: "Product ID must be an integer." })
        .positive({ message: "Product ID must be a positive integer." }),
      quantity: z
        .coerce.number({ required_error: "Quantity is required.", invalid_type_error: "Quantity must be a number." })
        .int({ message: "Quantity must be an integer." })
        .positive({ message: "Quantity must be a positive integer." }),
      unitCost: z
        .coerce.number({ required_error: "Unit cost is required.", invalid_type_error: "Unit cost must be a number." })
        .nonnegative({ message: "Unit cost must be a non-negative number." }),
    })
  ).nonempty({ message: "Purchase return must contain at least one item." }),
});

exports.createInvoiceSchema = z.object({
  customerId: z
    .coerce.number({ invalid_type_error: "Customer ID must be a number." })
    .int({ message: "Customer ID must be an integer." })
    .positive({ message: "Customer ID must be a positive integer." })
    .optional()
    .nullable(),
  salesmanId: z
    .coerce.number({ invalid_type_error: "Salesman ID must be a number." })
    .int({ message: "Salesman ID must be an integer." })
    .positive({ message: "Salesman ID must be a positive integer." })
    .optional()
    .nullable(),
  saleType: z.enum(["CASH", "CREDIT"], {
    errorMap: () => ({ message: "Sale type must be either CASH or CREDIT." })
  }).default("CASH").optional(),
  invoiceDate: z
    .coerce.date({ invalid_type_error: "Invoice date must be a valid date." })
    .optional(),
  discount: z
    .coerce.number({ invalid_type_error: "Discount must be a number." })
    .nonnegative({ message: "Discount must be a non-negative number." })
    .default(0)
    .optional(),
  transportDiscount: z
    .coerce.number({ invalid_type_error: "Transport discount must be a number." })
    .nonnegative({ message: "Transport discount must be a non-negative number." })
    .default(0)
    .optional(),
  paidAmount: z
    .coerce.number({ invalid_type_error: "Paid amount must be a number." })
    .nonnegative({ message: "Paid amount must be a non-negative number." })
    .default(0)
    .optional(),
  creditApplied: z
    .coerce.number({ invalid_type_error: "Credit applied must be a number." })
    .nonnegative({ message: "Credit applied must be a non-negative number." })
    .default(0)
    .optional(),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  items: z.array(
    z.object({
      productId: z
        .coerce.number({ required_error: "Product ID is required.", invalid_type_error: "Product ID must be a number." })
        .int({ message: "Product ID must be an integer." })
        .positive({ message: "Product ID must be a positive integer." }),
      quantity: z
        .coerce.number({ required_error: "Quantity is required.", invalid_type_error: "Quantity must be a number." })
        .int({ message: "Quantity must be an integer." })
        .positive({ message: "Quantity must be a positive integer." }),
      unitPrice: z
        .coerce.number({ invalid_type_error: "Unit price must be a number." })
        .nonnegative({ message: "Unit price must be a non-negative number." })
        .optional()
        .nullable(),
      discount: z
        .coerce.number({ invalid_type_error: "Discount must be a number." })
        .nonnegative({ message: "Discount must be a non-negative number." })
        .default(0)
        .optional(),
    })
  ).nonempty({ message: "Invoice must contain at least one item." }),
});

exports.createSalesReturnSchema = z.object({
  customerId: z
    .coerce.number({ invalid_type_error: "Customer ID must be a number." })
    .int({ message: "Customer ID must be an integer." })
    .positive({ message: "Customer ID must be a positive integer." })
    .optional()
    .nullable(),
  invoiceId: z
    .coerce.number({ invalid_type_error: "Invoice ID must be a number." })
    .int({ message: "Invoice ID must be an integer." })
    .positive({ message: "Invoice ID must be a positive integer." })
    .optional()
    .nullable(),
  refundType: z
    .enum(["CREDIT", "CASH"], {
      errorMap: () => ({ message: "Refund type must be either CREDIT or CASH." })
    })
    .default("CREDIT")
    .optional(),
  returnDate: z
    .coerce.date({ invalid_type_error: "Return date must be a valid date." })
    .optional(),
  reason: z
    .string()
    .trim()
    .optional()
    .nullable(),

  items: z.array(
    z.object({
      productId: z
        .coerce.number({ required_error: "Product ID is required.", invalid_type_error: "Product ID must be a number." })
        .int({ message: "Product ID must be an integer." })
        .positive({ message: "Product ID must be a positive integer." }),
      quantity: z
        .coerce.number({ required_error: "Quantity is required.", invalid_type_error: "Quantity must be a number." })
        .int({ message: "Quantity must be an integer." })
        .positive({ message: "Quantity must be a positive integer." }),
      unitPrice: z
        .coerce.number({ invalid_type_error: "Unit price must be a number." })
        .nonnegative({ message: "Unit price must be a non-negative number." })
        .optional()
        .nullable(),
    })
  ).nonempty({ message: "Sales return must contain at least one item." }),
});

exports.createCustomerPaymentSchema = z.object({
  customerId: z
    .coerce.number({ required_error: "Customer ID is required.", invalid_type_error: "Customer ID must be a number." })
    .int({ message: "Customer ID must be an integer." })
    .positive({ message: "Customer ID must be a positive integer." }),
  invoiceId: z
    .coerce.number({ invalid_type_error: "Invoice ID must be a number." })
    .int({ message: "Invoice ID must be an integer." })
    .positive({ message: "Invoice ID must be a positive integer." })
    .optional()
    .nullable(),
  amount: z
    .coerce.number({ required_error: "Amount is required.", invalid_type_error: "Amount must be a number." })
    .positive({ message: "Amount must be a positive number." }),
  isCreditApplied: z
    .boolean({ invalid_type_error: "isCreditApplied must be a boolean." })
    .default(false)
    .optional(),
  paymentDate: z
    .coerce.date({ invalid_type_error: "Payment date must be a valid date." })
    .optional(),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  allocations: z
    .array(
      z.object({
        invoiceId: z
          .coerce.number({ required_error: "Invoice ID is required.", invalid_type_error: "Invoice ID must be a number." })
          .int({ message: "Invoice ID must be an integer." })
          .positive({ message: "Invoice ID must be a positive integer." }),
        amountAllocated: z
          .coerce.number({ required_error: "Amount allocated is required.", invalid_type_error: "Amount allocated must be a number." })
          .positive({ message: "Amount allocated must be a positive number." }),
      })
    )
    .optional()
    .nullable(),
});

exports.createSupplierPaymentSchema = z.object({
  supplierId: z
    .coerce.number({ required_error: "Supplier ID is required.", invalid_type_error: "Supplier ID must be a number." })
    .int({ message: "Supplier ID must be an integer." })
    .positive({ message: "Supplier ID must be a positive integer." }),
  purchaseId: z
    .coerce.number({ invalid_type_error: "Purchase ID must be a number." })
    .int({ message: "Purchase ID must be an integer." })
    .positive({ message: "Purchase ID must be a positive integer." })
    .optional()
    .nullable(),
  amount: z
    .coerce.number({ required_error: "Amount is required.", invalid_type_error: "Amount must be a number." })
    .positive({ message: "Amount must be a positive number." }),
  isCreditApplied: z
    .boolean({ invalid_type_error: "isCreditApplied must be a boolean." })
    .default(false)
    .optional(),
  paymentDate: z
    .coerce.date({ invalid_type_error: "Payment date must be a valid date." })
    .optional(),
  description: z
    .string()
    .trim()
    .optional()
    .nullable(),
  allocations: z
    .array(
      z.object({
        purchaseId: z
          .coerce.number({ required_error: "Purchase ID is required.", invalid_type_error: "Purchase ID must be a number." })
          .int({ message: "Purchase ID must be an integer." })
          .positive({ message: "Purchase ID must be a positive integer." }),
        amountAllocated: z
          .coerce.number({ required_error: "Amount allocated is required.", invalid_type_error: "Amount allocated must be a number." })
          .positive({ message: "Amount allocated must be a positive number." }),
      })
    )
    .optional()
    .nullable(),
});

exports.adminResetPasswordSchema = z.object({
  newPassword: z
    .string({ required_error: "New password is required." })
    .min(8, { message: "New password must be at least 8 characters." })
    .max(100, { message: "New password cannot exceed 100 characters." }),
});