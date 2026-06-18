import { PrismaClient } from '@prisma/client'
import { neon } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  // During build time on Vercel, DATABASE_URL may not be available
  // Return a minimal client that won't actually be used at build time
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

  // Strip channel_binding parameter — not supported by @neondatabase/serverless neon()
  const cleanUrl = connectionString.replace(/[&?]channel_binding=[^&]*/g, '')

  const sql = neon(cleanUrl)
  const adapter = new PrismaNeon(sql)

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db