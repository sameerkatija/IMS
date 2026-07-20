require("dotenv").config();
const prisma = require("../config/prisma");

async function main() {
  const users = await prisma.user.findMany();
  console.log("USERS:", JSON.stringify(users, null, 2));

  const categories = await prisma.category.findMany();
  console.log("CATEGORIES:", JSON.stringify(categories, null, 2));

  const products = await prisma.product.findMany();
  console.log("PRODUCTS:", JSON.stringify(products.slice(0, 10), null, 2));
}

main().catch(console.error);
