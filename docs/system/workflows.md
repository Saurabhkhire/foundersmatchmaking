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
- Founder role fields include:
  - LinkedIn URL
  - startup one-liner
  - industry type (dropdown)
  - ICP, GTM, bottleneck, looking for, can help
  - stage (dropdown), revenue (dropdown), money raised (dropdown)
  - team size, users count
  - editable pitch
- Investor role fields include LinkedIn URL plus sector/stage/traction/thesis fields.

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
3. Backend recomputes all matches:
   - founder-founder mandatory room pairing (disjoint pairs)
   - founder-investor and investor-investor scoring
4. Backend sends SMTP emails to all non-admin users.
5. Response includes email delivery stats.

## Email Format Rules
### Founder recipient
- Include "1 v 1 founder room partner" section
- Include score, personalized why-connect rationale, and 3 tailored questions
- Include all founder matches table (score, why connect, questions, LinkedIn)
- Include all investor matches table (score, why this investor, questions, LinkedIn)

### Investor recipient
- Include all founders table with score, why invest, diligence questions, and LinkedIn
- No founder room-partner section
