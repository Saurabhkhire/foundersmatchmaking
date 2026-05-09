# Founder Match MVP

AI-powered founder and investor matchmaking with a split architecture:
- `frontend/`: Next.js UI
- `backend/`: Express API + Prisma + OpenAI + SMTP

## Stack

- Next.js 15 + TypeScript + Tailwind
- Node.js + Express
- Prisma ORM
- PostgreSQL (`pgvector`) or SQLite (local)
- JWT auth + bcrypt password hashing
- OpenAI (embeddings + match explanations + pitch generation)
- Nodemailer SMTP delivery

## Key Product Features

- Founder and investor registration/login (username/password/email).
- Founder profile includes:
  - LinkedIn URL
  - Startup one-liner
  - Industry type (dropdown)
  - ICP, GTM, biggest bottleneck
  - Looking for / can help with
  - Stage (dropdown), revenue (dropdown), money raised (dropdown)
  - Team size, users count, editable pitch
- Investor profile includes LinkedIn URL and thesis fields.
- Admin controls:
  - List users
  - Delete one user
  - Delete all non-admin users
  - Run matching + send emails
- Matching:
  - Mandatory founder room partners when founder count is even (20 founders -> 10 founder-founder room pairs)
  - Personalized email summaries with why-connect rationale and 3 tailored questions

## Environment

Copy `backend/.env.example` to `backend/.env` and set:
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY` (optional)
- `FRONTEND_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_COMPANY_NAME`

Frontend env:
- `NEXT_PUBLIC_API_BASE_URL` (backend base URL, no `/api` suffix)

## Local Run

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

## Demo Data (20 founders + 5 investors)

```bash
cd backend
npm run seed:demo
```

- Creates `demo_founder_01` ... `demo_founder_20` and `demo_investor_01` ... `demo_investor_05`
- Shared password: `demo123456`
- Re-runnable (existing demo users are removed first)
- Demo profiles include populated form fields and LinkedIn URLs

## Deploy Notes (Render)

- Deploy backend and frontend as separate services.
- Typical mapping:
  - Backend URL serves `/health` and `/api/*`
  - Frontend URL serves pages (`/register`, `/login`, `/dashboard`, `/admin`)
- Backend build should run Prisma commands:
  - `npm run prisma:generate`
  - `npm run prisma:push`

## User Routes

- `/register`
- `/login`
- `/dashboard`
- `/admin`
