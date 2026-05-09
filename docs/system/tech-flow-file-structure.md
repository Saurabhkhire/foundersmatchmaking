# Technical Flow and File Structure

## Repository layout
- `frontend/` UI only
- `backend/` Node.js API, Prisma, matching, LLM, SMTP
- `docs/system/` technical docs and test plans

## Frontend key files
- `frontend/app/register/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/admin/page.tsx`
- `frontend/lib/api.ts`
- `frontend/components/AutoGrowTextarea.tsx`

## Backend key files
- `backend/src/server.js`
- `backend/src/routes/api.js`
- `backend/src/lib/auth.js`
- `backend/src/lib/session.js`
- `backend/src/lib/prisma.js`
- `backend/src/lib/openai.js`
- `backend/src/lib/matching.js`
- `backend/src/lib/matchCopy.js`
- `backend/src/lib/email.js`
- `backend/prisma/schema.prisma`
- `backend/scripts/seed-demo.mjs`

## End-to-end request flow
1. Frontend action triggers `apiFetch()`.
2. Request goes to backend `/api/*`.
3. Backend validates bearer token and role.
4. Backend reads/writes Prisma models.
5. For matching run, backend executes:
   - mandatory founder room pairing
   - founder/investor scoring
   - optional AI reasoning generation
   - role-aware email dispatch
6. Frontend renders response and status.
