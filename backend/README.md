# Backend

Express API for Founder Match.

## Run

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

## Required Environment (`backend/.env`)

- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY` (optional)
- `FRONTEND_URL` (CORS allow origin)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_COMPANY_NAME`

## API Base

- Local: `http://localhost:4000/api`

## Major Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/profile/generate-pitch`
- `GET /api/matches`
- `GET /api/admin/users`
- `DELETE /api/admin/users/:id`
- `DELETE /api/admin/users`
- `POST /api/admin/run-matching`
- `GET /health`

## Matching Notes

- Founder-founder room partner pairing is mandatory when founder count is even.
- Founder score prioritizes:
  - looking for + can help (highest weight)
  - then industry type, raised amount, stage/revenue, and other profile fields
- Founder-investor score includes industry, stage, revenue, and money raised alignment.

## Email Notes

- Founder emails include:
  - 1:1 room partner section
  - all founders table
  - all investors table
  - personalized why-connect and 3 tailored questions
  - LinkedIn URLs when present
- Investor emails include:
  - all founders table with score, why-invest, questions, LinkedIn URLs

## Demo Seed

Loads **20 founders** and **5 investors** with populated profiles:

```bash
npm run seed:demo
```

Users:
- `demo_founder_01` ... `demo_founder_20`
- `demo_investor_01` ... `demo_investor_05`
- password: `demo123456`
