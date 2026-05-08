# Test Cases API and UI

## API Test Cases

### POST /api/auth/register
- Positive: valid founder/investor/admin payload -> `200`, returns `{ok, token, user}`
- Negative: invalid payload -> `400`
- Negative: duplicate username -> `409`
- Negative: duplicate email -> `409`

### POST /api/auth/login
- Positive: valid credentials -> `200` with token and user
- Negative: invalid credentials -> `401`
- Negative: invalid payload -> `400`

### GET /api/profile
- Positive: valid bearer token -> `200` with profile
- Negative: missing/invalid token -> `401`

### PUT /api/profile
- Positive: founder updates founder fields -> `200 {ok:true}`
- Positive: investor updates investor fields -> `200 {ok:true}`
- Negative: missing/invalid token -> `401`

### GET /api/matches
- Positive: authenticated user -> `200` with best + all matches
- Negative: missing/invalid token -> `401`

### GET /api/admin/users
- Positive: admin token -> `200` user list
- Negative: no token -> `401`
- Negative: non-admin token -> `403`

### DELETE /api/admin/users/:id
- Positive: admin deletes specific user -> `200 {ok:true}`
- Negative: no token -> `401`
- Negative: non-admin -> `403`

### DELETE /api/admin/users
- Positive: admin deletes all non-admin users -> `200 {ok:true, deletedCount}`
- Negative: no token -> `401`
- Negative: non-admin -> `403`

### POST /api/admin/run-matching
- Positive: admin trigger -> `200 {ok:true, email:{sent,failed,skipped}}`
- Negative: no token -> `401`
- Negative: non-admin -> `403`

### GET /health
- Positive: backend running -> `200 {ok:true, service}`
- Negative: backend down -> connection error

## UI Test Cases

### Register Page
- Positive: register founder/investor/admin -> redirect by role
- Negative: empty/invalid fields -> error message
- Negative: duplicate username/email -> API error shown

### Login Page
- Positive: valid login -> redirect to dashboard/admin
- Negative: invalid credentials -> error shown

### Dashboard (Founder/Investor)
- Positive: first-time user can fill empty profile and save
- Positive: returning user can edit existing profile and save
- Positive: matches render sorted with score and reasoning
- Negative: missing/invalid token -> redirect to `/login`

### Admin Page
- Positive: admin sees all users
- Positive: delete one user works and list refreshes
- Positive: delete all non-admin users works and status updates
- Positive: run matching returns and displays email stats
- Negative: unauthorized -> redirected to login (API 401/403)

## Email Content Validation

### Founder email should contain
- 1v1 founder match section
- score
- AI reasoning/answers
- suggested questions
- all founder and investor match tables

### Investor email should contain
- no founder 1v1 section
- all founder and investor match tables
- scores and AI reasoning/answers
