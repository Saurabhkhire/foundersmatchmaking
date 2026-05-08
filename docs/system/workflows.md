# Workflows

## Registration and Login
1. User registers on `/register` with company name, email, username, password, role.
2. Frontend calls `POST /api/auth/register` on backend.
3. Backend creates user + empty founder/investor profile shell.
4. Backend returns JWT token.
5. Frontend stores token and routes user to `/dashboard` or `/admin`.
6. Existing users login via `POST /api/auth/login`.

## First-Time vs Returning Profile Flow
- First login/register: profile fields are empty, user fills role-specific fields.
- Returning user: same screen allows editing previously saved values.
- Save action calls `PUT /api/profile`.

## Founder/Investor Dashboard
- Frontend loads:
  - `GET /api/profile`
  - `GET /api/matches`
- Displays:
  - best founder match
  - best investor match
  - all founder/investor matches sorted by score

## Admin User Management
- `GET /api/admin/users`: list all users
- `DELETE /api/admin/users/:id`: delete one user
- `DELETE /api/admin/users`: delete all non-admin users

## Admin Matching + Email Workflow
1. Admin clicks Run Matching.
2. Frontend calls `POST /api/admin/run-matching`.
3. Backend recomputes all matches.
4. Backend sends SMTP emails to all non-admin users.
5. Response includes email delivery stats.

## Email Format Rules
### Founder recipient
- Include "1 v 1 founder match" section (if available)
- Include score
- Include AI reasoning (answers to questions)
- Include suggested questions
- Include all founder matches and all investor matches tables with scores and answers

### Investor recipient
- Do NOT include founder 1v1 section
- Include all founder matches and all investor matches tables with scores and answers
