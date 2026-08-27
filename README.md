# AI Job Hunter

Local-first web app for discovering jobs, scoring them against a CV, and sending applications only after explicit approval.

**Job Match Score is profile-to-job similarity. It is not a probability of being hired.**

## Stack

- Next.js (web) + Fastify (API) + TypeScript
- PostgreSQL + Prisma
- Ollama by default; Grok / Groq / OpenRouter / Together / OpenAI / Gemini / custom OpenAI-compatible keys in Settings
- Public job APIs only (Remotive, RemoteOK, Arbeitnow, RSS, Greenhouse). LinkedIn and Indeed are not scraped.
- Nodemailer SMTP (Gmail / Outlook presets)

No n8n, Zapier, or Make.

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres
# optional local model:
# docker compose --profile ai up -d ollama
# docker compose exec ollama ollama pull llama3.2

npm install
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/health

If you are not using Docker, create a local PostgreSQL database and set `DATABASE_URL`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | API + web |
| `npm run build` | Production build |
| `npm run start` | Production start |
| `npm run lint` | Lint |
| `npm run typecheck` | TypeScript |
| `npm run test` | Unit + integration tests |
| `npm run db:migrate` | Prisma migrate |
| `npm run db:seed` | Labeled demo data |

## Safety

- Applications are never emailed automatically unless you enable **Allow auto-send** in Settings.
- Daily application limits are enforced.
- LinkedIn and Indeed are not scraped (login walls + terms). Discovery uses public APIs/feeds only.
- Scrapers fail closed: blocked sites are not bypassed.
- SMTP passwords and API keys are never returned to the frontend in full.
- Without AI, CV parsing and application emails still work. You can edit the profile and the email template.

Seed data uses clearly labeled demo companies and is not real job inventory.
