# Backend

Node.js Express backend for Founder Match.

## Run

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

## Required environment

Use `backend/.env`:

- `DATABASE_URL` (Neon postgres for hosting)
- `JWT_SECRET`
- `OPENAI_API_KEY` (optional fallback supported)
- `FRONTEND_URL` (CORS, default `http://localhost:3000`)
- SMTP fields for email delivery

## API base

- Local: `http://localhost:4000/api`

## Demo seed

Loads **20 founders** and **5 investors** (`demo_founder_01` … `demo_investor_05`, password `demo123456`):

```bash
npm run seed:demo
```
