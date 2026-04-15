# Plinko Lab (Provably Fair)

Production-ready Plinko implementation using Next.js App Router, TypeScript, Prisma, and PostgreSQL.

## Submission Links

- GitHub: `ADD_GITHUB_URL_HERE`
- Live app: `ADD_LIVE_APP_URL_HERE`
- Verifier page: `ADD_LIVE_APP_URL_HERE/verify`
- Example round permalink: `ADD_LIVE_APP_URL_HERE/?roundId=ADD_ROUND_ID`

## 1) Folder Structure

```text
plinko-lab/
  prisma/
    schema.prisma
  src/
    app/
      api/
        rounds/
          commit/route.ts
          recent/route.ts
          [id]/route.ts
          [id]/start/route.ts
          [id]/reveal/route.ts
        verify/route.ts
      verify/page.tsx
      globals.css
      layout.tsx
      page.tsx
    components/
      plinko-board.tsx
    lib/
      db/
        prisma.ts
      engine/
        plinko.ts
        plinko.test.ts
      fairness/
        hashing.ts
        hashing.test.ts
      prng/
        xorshift32.ts
        xorshift32.test.ts
      services/
        round-service.ts
        verify-service.ts
  vitest.config.ts
  package.json
  .env.example
```

## 2) Prisma Schema + Setup

Configured for PostgreSQL only.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Round model

- Stores commit, seed lifecycle, deterministic output, and reveal status.
- `serverSeed` stays hidden from normal read flow until reveal.

### Setup commands

```bash
npm install
cp .env.example .env
# set DATABASE_URL in .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

## 3) PRNG Implementation

File: src/lib/prng/xorshift32.ts

- Implements xorshift32.
- `seed` is initialized from first 4 bytes of `combinedSeed` (big-endian).
- Exposes:
  - `nextUint32()`
  - `rand()` returning float in `[0, 1)`

## 4) Engine Logic

File: src/lib/engine/plinko.ts

- Rows fixed to `12`.
- Deterministic order:
  1. Generate peg map first.
  2. Then consume PRNG for path decisions.
- Peg generation:
  - `leftBias = 0.5 + (rand() - 0.5) * 0.2`
  - rounded to 6 decimals.
- `pegMapHash = SHA256(JSON.stringify(pegMap))`
- Path logic:
  - `adj = (dropColumn - 6) * 0.01`
  - `bias = clamp(leftBias + adj, 0, 1)`
  - `rand() < bias => LEFT`, else RIGHT and `pos++`
- `binIndex = pos`
- Symmetric payout array included and persisted per round.

## 5) API Routes

All routes are thin and call service layer logic.

### POST `/api/rounds/commit`
- Creates committed round.
- Generates `serverSeed`, `nonce`, and `commitHex`.
- Returns `{ roundId, commitHex, nonce }`.

### POST `/api/rounds/[id]/start`
- Input: `clientSeed`, `betCents`, `dropColumn`
- Computes `combinedSeed`, peg map, path, payout.
- Stores deterministic result in DB.
- Returns round output including `pegMapHash`.

### POST `/api/rounds/[id]/reveal`
- Sets status `REVEALED`
- Returns `serverSeed`.

### GET `/api/rounds/[id]`
- Returns full round record.
- `serverSeed` hidden unless round is revealed.

### GET `/api/verify`
- Query: `serverSeed`, `clientSeed`, `nonce`, `dropColumn`
- Recomputes deterministic outcome.
- Returns `commitHex`, `combinedSeed`, `pegMapHash`, `binIndex`, `payoutMultiplier`, `path`.

### GET `/api/rounds/recent`
- Bonus API for recent rounds list.

## 6) Frontend UI

### Game page `/`

Includes:
- Div-based responsive board
- Column selector (0-12)
- Bet input
- Drop button
- Ball animation (step-by-step deterministic playback)
- Confetti effect on stronger wins
- Sound toggle
- Keyboard controls:
  - Left/Right: move column
  - Enter/Space: drop
- Bonus toggles:
  - Debug grid
  - Tilt mode
  - Golden ball
- Recent rounds table
- Reveal action to expose server seed for the latest round

## 7) Verifier page `/verify`

- Inputs: `serverSeed`, `clientSeed`, `nonce`, `dropColumn`
- Calls `/api/verify` and displays:
  - `commitHex`
  - `combinedSeed`
  - `pegMapHash`
  - `binIndex`
- Optional stored round comparison by `roundId`
- Displays ✅ / ❌ checks for matching computed vs stored values.

## 8) Tests

Vitest tests included:

1. SHA256 correctness (`hashing.test.ts`)
2. PRNG deterministic sequence test vector (`xorshift32.test.ts`)
3. Deterministic replay (`plinko.test.ts`)

Run:

```bash
npm run test
```

## 9) Fairness / Commit-Reveal

Round lifecycle:

1. Server generates `serverSeed` + `nonce`
2. Server publishes commitment only:
   - `commitHex = SHA256(serverSeed + ":" + nonce)`
3. Client sends `clientSeed`
4. Server computes:
   - `combinedSeed = SHA256(serverSeed + ":" + clientSeed + ":" + nonce)`
5. Engine uses seed deterministically (xorshift32)
6. After play, user can reveal `serverSeed`
7. Anyone can verify with `/verify`

## Clean Architecture Notes

- `src/lib/fairness`: hashing + seed derivation
- `src/lib/prng`: xorshift32 implementation
- `src/lib/engine`: deterministic game simulation
- `src/lib/db`: Prisma singleton client
- `src/lib/services`: business logic orchestration
- API routes only validate input and call services

## Vercel Deployment (Neon)

1. Create Neon database and copy connection string.
2. In Vercel project settings, add environment variable:
   - `DATABASE_URL`
3. Build command (default):
   - `next build`
4. Ensure Prisma client is generated during build (already handled through package scripts/dependencies).
5. Run migrations against production database:

```bash
npm run prisma:migrate -- --name init
```

### Serverless-safe checklist

- No local filesystem writes
- Deterministic logic is pure and stateless
- DB access uses Prisma singleton pattern
- API routes are request-scoped thin handlers

## AI Usage Disclosure

AI assistance was used to accelerate scaffolding, architectural organization, and test boilerplate generation. Final implementation decisions, fairness flow alignment, and security constraints were validated and adjusted for this project requirements set.

## Architecture Overview

Request flow:

1. Frontend sends API request (`/api/rounds/commit`, `/start`, `/reveal`, `/verify`)
2. API routes validate and delegate to service layer
3. Service layer orchestrates fairness logic + deterministic engine + persistence
4. Prisma writes/reads `Round` records in PostgreSQL
5. Frontend renders deterministic path and verification artifacts

Core modules:

- `src/lib/fairness`: SHA256 hashing, commit/combined seed generation, seed extraction
- `src/lib/prng`: xorshift32 deterministic PRNG
- `src/lib/engine`: peg map generation + deterministic path simulation
- `src/lib/services`: business orchestration and validation boundaries
- `src/lib/db`: Prisma singleton client for serverless-safe usage

## Assignment Test Vector Coverage

Reference vector assertions are implemented in:

- `src/lib/engine/assignment-vector.test.ts`

Covered checks:

1. `commitHex` exact match
2. `combinedSeed` exact match
3. xorshift32 first 5 `rand()` values
4. first peg-map rows
5. center drop outcome (`binIndex = 6`)

## AI Usage (Detailed)

Where AI helped most:

1. Initial scaffolding of Next.js + Prisma structure and route boilerplate
2. Drafting deterministic engine and verifier UX baseline
3. Generating and refining unit test scaffolding
4. Iterating on frontend layout and alignment adjustments

What was manually reviewed/changed after AI drafts:

1. Commit-reveal ordering and server-seed exposure rules
2. Deterministic PRNG stream order (peg map first, then decisions)
3. Prisma compatibility/version pinning for required schema format
4. Database migration and runtime error handling
5. Visual alignment and responsiveness refinements for board geometry

## Time Log (Approx)

- Project bootstrap and architecture layout: 1.2h
- Fairness protocol + deterministic engine + services: 2.2h
- API + DB wiring + Prisma validation: 1.4h
- Frontend interactions/animation/responsive polish: 1.6h
- Verifier UX and replay improvements: 0.8h
- Testing + vector checks + docs: 1.0h

Total focused time: ~8.2h

