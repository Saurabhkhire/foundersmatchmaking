# Database Structure

## Runtime DB ownership
Database access is owned by backend service using Prisma (`backend/prisma/schema.prisma`).

## Provider options
- Neon Postgres (default for hosting)
- SQLite (local testing)

Select provider in backend:
- `npm run db:use:neon`
- `npm run db:use:sqlite`

## Models

### User
- id, companyName, email (unique), username (unique), passwordHash, role, createdAt
- Relations: founderProfile?, investorProfile?, matchesA, matchesB

### FounderProfile
- startupOneLiner, icp, gtm, biggestBottleneck, lookingFor, canHelp
- stage, revenue, teamSize, usersCount
- embedding, extractedData
- status, currentlyMatched, lastMatchedAt

### InvestorProfile
- preferredSector, preferredStage, tractionExpectation
- investmentInterest, redFlags, usersPreference
- embedding, extractedData

### Match
- userAId, userBId, matchType, score, aiReason, aiQuestions, createdAt
- unique: `(userAId, userBId, matchType)`
- indexes on score queries
