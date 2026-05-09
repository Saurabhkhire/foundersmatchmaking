# Method IO Contracts

## Frontend

### `frontend/lib/api.ts`
- `apiUrl(path)` -> backend URL string
- `getToken()` -> JWT token from localStorage
- `apiFetch(path, init)` -> fetch with bearer auth header

### `frontend/app/register/page.tsx`
- submit register payload -> stores token/user -> redirects

### `frontend/app/login/page.tsx`
- submit login payload -> stores token/user -> redirects

### `frontend/app/dashboard/page.tsx`
- `loadProfile()` -> GET `/api/profile`
- `loadMatches()` -> GET `/api/matches`
- `saveProfile()` -> PUT `/api/profile`
- Founder form uses dropdown fields:
  - `industryType`
  - `stage`
  - `revenue`
  - `moneyRaised`
- Founder and investor form include `linkedinUrl`

### `frontend/app/admin/page.tsx`
- `loadUsers()` -> GET `/api/admin/users`
- `deleteUser(id)` -> DELETE `/api/admin/users/:id`
- `deleteAllUsers()` -> DELETE `/api/admin/users`
- `runMatching()` -> POST `/api/admin/run-matching`

## Backend routes (`backend/src/routes/api.js`)
- `POST /auth/register` -> `{ok, token, user}`
- `POST /auth/login` -> `{ok, token, user}`
- `GET /auth/me` -> `{user}`
- `GET /profile` -> `{user}`
- `PUT /profile` -> `{ok:true}`
- `POST /profile/generate-pitch` -> `{pitch}`
- `GET /matches` -> best and all matches
- `GET /admin/users` -> list users
- `DELETE /admin/users/:id` -> `{ok:true}`
- `DELETE /admin/users` -> `{ok:true, deletedCount}`
- `POST /admin/run-matching` -> `{ok:true, email:{sent,failed,skipped}}`

## Backend services

### `backend/src/lib/auth.js`
- hash/verify password
- sign/verify JWT

### `backend/src/lib/session.js`
- bearer parsing and role enforcement middleware

### `backend/src/lib/matching.js`
- founder-founder scoring (prioritizes lookingFor/canHelp; includes industryType/moneyRaised)
- founder-investor scoring (includes industry/stage/revenue/raised alignment)
- mandatory founder room pairing for even founder counts
- match regeneration and persistence

### `backend/src/lib/matchCopy.js`
- personalized why-connect / why-invest copy generation
- personalized question generation from form values

### `backend/src/lib/openai.js`
- LLM extraction/embedding/reasoning methods

### `backend/src/lib/email.js`
- send role-aware SMTP match summary emails to all non-admin users
- include LinkedIn URLs in email rows
