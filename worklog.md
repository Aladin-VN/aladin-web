---
Task ID: 1
Agent: Main Agent
Task: Prepare ALADIN project for local development + Neon PostgreSQL + Netlify deployment

Work Log:
- Updated prisma/schema.prisma: Changed datasource from SQLite to PostgreSQL with directUrl support for Neon connection pooling
- Updated next.config.ts: Removed `output: "standalone"` for Netlify compatibility (Netlify uses @netlify/plugin-nextjs)
- Updated package.json: Updated all scripts to use `npx` prefix, added `postinstall` for auto Prisma generate, added `db:seed`
- Created netlify.toml with build config and @netlify/plugin-nextjs plugin
- Created env-example.txt with all required environment variables documented
- Generated comprehensive deployment guide DOCX (7 chapters, 43 headings)
- Ran TOC post-processing and validation checks (0 errors)

Stage Summary:
- Project files modified for deployment: schema.prisma, next.config.ts, package.json
- New files created: netlify.toml, env-example.txt
- Generated: /home/z/my-project/download/ALADIN-Deployment-Guide.docx
- Document covers: Prerequisites, Local Dev Setup, Neon PostgreSQL, Netlify Deploy, Config Details, Troubleshooting, Quick Reference Checklist
