import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient, type Client } from '@libsql/client'

function createPrismaClient() {
  let url = process.env.DATABASE_URL || 'file:./db/custom.db'

  // On Vercel (production), SQLite file paths must use /tmp (only writable dir)
  // Auto-redirect file: URLs to /tmp/ on Vercel
  const isVercel = !!process.env.VERCEL
  if (isVercel && url.startsWith('file:')) {
    url = 'file:/tmp/aladin.db'
  }

  // If URL starts with libsql://, use the Turso adapter
  if (url.startsWith('libsql://')) {
    const libsql: Client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({
      adapter,
      log: ['error'],
    })
  }

  // SQLite file (local dev or Vercel /tmp)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db