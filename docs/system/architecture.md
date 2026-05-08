# Architecture

## Overview
Founder Match is split into two deployable services:
- `frontend`: Next.js UI only (pages and client-side state)
- `backend`: Node.js Express API (auth, profile, matching, email, Prisma)

This is Render-friendly: deploy frontend and backend separately, point frontend to backend via `NEXT_PUBLIC_API_BASE_URL`.

## Frontend
- Pages: `/register`, `/login`, `/dashboard`, `/admin`
- API client: `frontend/lib/api.ts`
- Auth state: JWT stored in browser localStorage and sent as `Authorization: Bearer <token>`

## Backend
- Server bootstrap: `backend/src/server.js`
- Routes: `backend/src/routes/api.js`
- Domain services:
  - Auth/hash/JWT: `backend/src/lib/auth.js`
  - Session middleware: `backend/src/lib/session.js`
  - Matching engine: `backend/src/lib/matching.js`
  - LLM service: `backend/src/lib/openai.js`
  - Email service: `backend/src/lib/email.js`
  - ORM client: `backend/src/lib/prisma.js`

## Security
- Username/password auth only (no OAuth, no email auth)
- Password hashing with bcrypt (cost 12)
- Role checks on admin routes (`401`/`403`)

## Matching + Email Trigger
`POST /api/admin/run-matching` executes:
1. regenerate all matches
2. send SMTP emails to all non-admin users
3. return email send summary `{sent, failed, skipped}`
