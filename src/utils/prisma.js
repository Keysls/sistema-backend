const { PrismaClient } = require('@prisma/client');

// Singleton — evita crear múltiples conexiones en desarrollo (hot-reload)
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
