# Founder Match MVP

AI-powered founder/investor matching platform with a split architecture:
- `frontend` (Next.js UI)
- `backend` (Node.js Express API with Prisma/OpenAI/SMTP)

## Stack

- Next.js 15 + TypeScript + Tailwind
- Prisma ORM
- PostgreSQL (`pgvector` column for embeddings)
- JWT + bcrypt username/password auth
- OpenAI for embeddings and match explanations
- SMTP email delivery after matching runs

## Environment

Copy `backend/.env.example` to `backend/.env` and set:

- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY` (optional for local dev fallback)
- `FRONTEND_URL`
- SMTP fields (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)

## Run (local)

```bash
# terminal 1
cd backend
npm install
npm run prisma:generate
npm run prisma:push
npm run dev

# terminal 2
cd frontend
npm install
npm run dev
```

## Database option (SQLite or Neon)

The app supports both local SQLite and Neon PostgreSQL.

- Use Neon (hosting default):
  - `cd backend`
  - `npm run db:use:neon`
  - set `DATABASE_URL` in `backend/.env`
  - `npm run prisma:generate && npm run prisma:push`

- Use SQLite (local testing):
  - `cd backend`
  - `npm run db:use:sqlite`
  - set `SQLITE_URL` in `backend/.env`
  - `npm run prisma:generate && npm run prisma:push`

Recommended for deployment: **Neon**.

## Demo data (20 founders + 5 investors)

From `backend` (uses `DATABASE_URL` in `backend/.env`):

```bash
cd backend
npm run seed:demo
```

Creates users `demo_founder_01` … `demo_founder_20` and `demo_investor_01` … `demo_investor_05`.  
Shared password: `demo123456`.  
Re-running removes previous `demo_founder_*` / `demo_investor_*` users and recreates them.

## Routes

- `/register`
- `/login`
- `/dashboard`
- `/admin`

## Notes

- This MVP intentionally excludes OAuth, email verification, payments, notifications, and complex RBAC.
- Matching ignores pairs below score `65`.
- Admin `Run Matching` regenerates all match records and sends SMTP summaries.
# foundersmatchmaking
