import { PrismaClient } from '@prisma/client'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  // During build time on Vercel, DATABASE_URL may not be available
  if (!connectionString) {
    return new PrismaClient({
      log: [],
      datasources: {
        db: {
          url: 'postgresql://dummy:dummy@localhost/dummy',
        },
      },
    })
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db