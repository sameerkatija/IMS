// scripts/seed-basic-data.js

require("dotenv").config();

const prisma = require("../config/prisma");

async function main() {
  console.log("Clearing existing master data...");

  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.category.deleteMany();

  console.log("Creating Categories...");

  const categories = await Promise.all([
    prisma.category.create({ data: { name: "Accessories" } }),
    prisma.category.create({ data: { name: "Networking" } }),
    prisma.category.create({ data: { name: "Storage" } }),
    prisma.category.create({ data: { name: "Printers" } }),
    prisma.category.create({ data: { name: "Office" } }),
  ]);

  const categoryMap = {};
  categories.forEach((c) => {
    categoryMap[c.name] = c.id;
  });

  console.log("Creating Expense Categories...");

  const expenseCategories = [
    "Rent",
    "Electricity",
    "Internet",
    "Salary",
    "Fuel",
    "Office Supplies",
    "Tea & Refreshments",
    "Maintenance",
    "Freight",
    "Packaging",
    "Cleaning",
    "Marketing",
  ];

  await prisma.expenseCategory.createMany({
    data: expenseCategories.map((name) => ({ name })),
  });

  console.log("Creating Suppliers...");

  const suppliers = [
    "Tech Distributors",
    "Global Electronics",
    "Office Mart",
    "Digital World",
    "City Traders",
    "Metro Supplies",
    "Prime Technologies",
    "Future Electronics",
  ];

  await prisma.supplier.createMany({
    data: suppliers.map((name) => ({
      name
    })),
  });

  console.log("Creating Customers...");

  const customers = [
    "Ali Traders",
    "Ahmed Electronics",
    "Noor Enterprises",
    "Quetta Computers",
    "Baloch IT Solutions",
    "Smart Solutions",
    "Horizon Tech",
    "Zubair Traders",
    "Al-Madina Store",
    "Pak Computers",
    "New Vision IT",
    "Khan Electronics",
    "Eagle Technologies",
    "Tech Zone",
    "Alpha Systems",
  ];

  await prisma.customer.createMany({
    data: customers.map((name) => ({
      name
    })),
  });

  console.log("Creating Products...");

  const products = [
    // Accessories
    {
      name: "Dell Mouse",
      category: "Accessories",
      cost: 700,
      sell: 1000,
    },
    {
      name: "HP Keyboard",
      category: "Accessories",
      cost: 1200,
      sell: 1700,
    },
    {
      name: "Logitech Wireless Mouse",
      category: "Accessories",
      cost: 1400,
      sell: 1900,
    },
    {
      name: "Logitech Webcam",
      category: "Accessories",
      cost: 4200,
      sell: 5200,
    },
    {
      name: "Laptop Stand",
      category: "Accessories",
      cost: 1500,
      sell: 2200,
    },
    {
      name: "Cooling Pad",
      category: "Accessories",
      cost: 1100,
      sell: 1700,
    },
    {
      name: "HDMI Cable",
      category: "Accessories",
      cost: 300,
      sell: 500,
    },
    {
      name: "USB Hub",
      category: "Accessories",
      cost: 500,
      sell: 800,
    },
    {
      name: "USB Flash Drive 64GB",
      category: "Accessories",
      cost: 900,
      sell: 1300,
    },
    {
      name: "USB Flash Drive 128GB",
      category: "Accessories",
      cost: 1500,
      sell: 2100,
    },

    // Networking
    {
      name: "TP-Link Router",
      category: "Networking",
      cost: 3500,
      sell: 4500,
    },
    {
      name: "TP-Link Switch 8 Port",
      category: "Networking",
      cost: 4200,
      sell: 5500,
    },
    {
      name: "LAN Cable 10m",
      category: "Networking",
      cost: 250,
      sell: 450,
    },
    {
      name: "RJ45 Connector Pack",
      category: "Networking",
      cost: 180,
      sell: 350,
    },

    // Storage
    {
      name: "Samsung SSD 500GB",
      category: "Storage",
      cost: 7000,
      sell: 8500,
    },
    {
      name: "Samsung SSD 1TB",
      category: "Storage",
      cost: 12000,
      sell: 14500,
    },
    {
      name: "WD HDD 1TB",
      category: "Storage",
      cost: 5200,
      sell: 6800,
    },
    {
      name: "Kingston RAM 8GB",
      category: "Storage",
      cost: 2800,
      sell: 3600,
    },
    {
      name: "Kingston RAM 16GB",
      category: "Storage",
      cost: 5200,
      sell: 6500,
    },

    // Printers
    {
      name: "Epson Printer L3250",
      category: "Printers",
      cost: 21000,
      sell: 25000,
    },
    {
      name: "HP LaserJet Printer",
      category: "Printers",
      cost: 28000,
      sell: 33000,
    },

    // Office
    {
      name: "Office Chair",
      category: "Office",
      cost: 8500,
      sell: 11000,
    },
    {
      name: "Office Desk",
      category: "Office",
      cost: 15000,
      sell: 19000,
    },
    {
      name: "Monitor Stand",
      category: "Office",
      cost: 1800,
      sell: 2600,
    },
    {
      name: "Extension Board",
      category: "Office",
      cost: 700,
      sell: 1200,
    },
  ];

  await prisma.product.createMany({
    data: products.map((p) => ({
      name: p.name,
      categoryId: categoryMap[p.category],
      costPrice: p.cost,
      sellingPrice: p.sell,
      stockQuantity: 0,
      lowStockLevel: 5,
    })),
  });

  console.log("==================================");
  console.log("Basic ERP data seeded successfully");
  console.log("Categories:", categories.length);
  console.log("Expense Categories:", expenseCategories.length);
  console.log("Suppliers:", suppliers.length);
  console.log("Customers:", customers.length);
  console.log("Products:", products.length);
  console.log("==================================");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });