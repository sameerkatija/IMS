const { PrismaClient } = require("../generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ adapter });
} else {
  // Prevent multiple instances during development (e.g., hot reload)
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      adapter,
      log: ["warn", "error"] , // ["query", "info", "warn", "error"],
    });
  }

  prisma = global.prisma;
}

module.exports = prisma;