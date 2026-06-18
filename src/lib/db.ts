import { PrismaClient } from '@prisma/client'

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    // During build time on Vercel, DATABASE_URL may not be available
    // Return a dummy client that won't be used
    if (process.env.NODE_ENV === 'production' && !connectionString) {
      return new PrismaClient({
        log: ['error'],
        datasources: {
          db: {
            url: 'postgresql://dummy:dummy@localhost/dummy',
          },
        },
      })
    }
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Strip channel_binding parameter — not supported by @neondatabase/serverless neon()
  connectionString = connectionString.replace(/[&?]channel_binding=[^&]*/g, '')

  // Use Neon serverless adapter for serverless/Vercel environments
  // Dynamic import to avoid issues at build time
  let client: PrismaClient

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require('@neondatabase/serverless')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require('@prisma/adapter-neon')

    const sql = neon(connectionString)
    const adapter = new PrismaNeon(sql)

    client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  } catch {
    // Fallback: use standard Prisma Client (works for local dev with direct PG connection)
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }

  return client
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db