// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const userModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/user-model");

async function main() {
  console.log("=== Admin Password Reset Verification ===");

  const username = `staff-reset-${Date.now()}`;
  const email = `${username}@example.com`;

  // 1. Create a staff user
  const user = await userModel.createUser({
    name: "Staff Member",
    username,
    email,
    password: "oldpassword123",
    role: "STAFF"
  });
  console.log(`Created test user: ID = ${user.id}, Username = ${user.username}`);

  // Verify old password works
  const matchOld = await userModel.verifyPassword(user, "oldpassword123");
  console.log(`Password match with old password: ${matchOld} (Expected: true)`);
  if (!matchOld) {
    throw new Error("Password hashing verification failed on creation.");
  }

  // 2. Perform Admin Reset
  console.log("Admin resetting password to 'newpassword456'...");
  const updatedUser = await userModel.resetPassword(user.id, "newpassword456");

  // Verify new password works
  const matchNew = await userModel.verifyPassword(updatedUser, "newpassword456");
  console.log(`Password match with new password: ${matchNew} (Expected: true)`);
  if (!matchNew) {
    throw new Error("Reset password verification failed.");
  }

  // Verify old password no longer works
  const matchOldAfterReset = await userModel.verifyPassword(updatedUser, "oldpassword123");
  console.log(`Password match with old password after reset: ${matchOldAfterReset} (Expected: false)`);
  if (matchOldAfterReset) {
    throw new Error("Old password still works after reset!");
  }

  // 3. Clean up
  console.log("Cleaning up test user...");
  await prisma.user.delete({ where: { id: user.id } });
  console.log("Cleanup complete.");

  console.log("\n=== PASSWORD RESET VERIFICATION PASSED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("\n*** VERIFICATION FAILED ***", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
