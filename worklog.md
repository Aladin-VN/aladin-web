---
Task ID: 1
Agent: Main Agent
Task: Prepare ALADIN B2B PWA for Vercel deployment with SQLite (Turso) and GitHub push

Work Log:
- Verified seed.ts works: 180 records across 20 models, 15 orders, 0 errors
- Switched Prisma schema back to provider=sqlite (Prisma 6 doesn't support libsql provider natively)
- Implemented @prisma/adapter-libsql pattern in db.ts — auto-detects libsql:// URL for Turso, falls back to local SQLite
- Created /api/setup endpoint for remote database seeding on Vercel (GET checks status, POST seeds)
- Extracted shared seed function to src/lib/seed.ts (used by both CLI seed.ts and API route)
- Pinned @prisma/client and prisma to exactly 6.11.1
- Updated next.config.ts with serverExternalPackages for @libsql/client
- Cleaned .gitignore: removed mobile/, db/, upload/, download/, skills/ from tracking
- Removed 522 non-essential files (mobile app, upload PDFs, PPTX workspace, skills, etc.)
- Created scripts/turso-setup.sh for one-command Turso DB setup
- Created .env.example with Turso + local dev configurations
- Verified build: 0 errors, 50+ routes
- Committed 306 source files, set remote to github.com/Aladin-VN/aladin-web.git

Stage Summary:
- Project is Vercel-ready with SQLite via Turso
- Build passes with 0 errors
- Git commit ready, remote set, needs user to push (no auth credentials)
- Deploy flow: Turso setup → Vercel import → env vars → POST /api/setup to seed