const bcrypt = require('bcrypt');

const prisma = require('../config/prisma');
const SALT_ROUNDS = 10;

const findByUsername = (username) => {
  return prisma.user.findFirst({
    where: { username },
  });
}

const findByEmail = (email) => {
  return prisma.user.findFirst({
    where: { email },
  });
}

const findByUsernameOrEmail = (username, email) => {
  return prisma.user.findFirst({
    where: {
      OR: [
        { username },
        { email },
      ],
    },
  });
};

const findById = (id) => {
  return prisma.user.findUnique({
    where: { id: Number(id) },
  });
}

const createUser = async ({ name, username, email, password, role = 'STAFF' }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      name,
      username,
      email,
      password: passwordHash,
      role
    }
  });
}

const updateLastLogin = async (id) => {
  await prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}

const verifyPassword = async (user, password) => {
  return await bcrypt.compare(password, user.password);
}

const resetPassword = async (id, newPassword) => {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  return prisma.user.update({
    where: { id: Number(id) },
    data: { password: passwordHash }
  });
}

const updateUserStatus = (id, isActive) => {
  return prisma.user.update({
    where: { id: Number(id) },
    data: { isActive: Boolean(isActive) }
  });
};

const findAllUsers = () => {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true
    },
    orderBy: {
      id: "asc"
    }
  });
}

module.exports = {
  findByUsername,
  findById,
  findByEmail,
  findByUsernameOrEmail,
  createUser,
  verifyPassword,
  updateLastLogin,
  resetPassword,
  updateUserStatus,
  findAllUsers
}