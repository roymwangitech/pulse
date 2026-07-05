# PulseChat

Full-stack real-time social app — text and emoji posts, threaded replies, reactions. Runs entirely on Vercel (Next.js + API Routes + Neon PostgreSQL).

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend + API | Next.js 15 App Router, TypeScript, Tailwind CSS, Zustand, TanStack Query, Framer Motion |
| Database | Neon PostgreSQL via Prisma |
| Deployment | Vercel (single deployment, no separate backend) |

## Features

- Username/password auth with JWT + refresh tokens
- Auto-generated DiceBear avatars
- Text + emoji posts, threaded replies (5 levels deep)
- Feed auto-refreshes every 15s — no WebSockets needed
- Emoji reactions with live counters
- Hashtag support with trending sidebar
- Date filtering, full-text search
- Admin dashboard (ban, analytics)
- Dark/light themes

## Project Structure

```
frontend/
├── prisma/              # Prisma schema and migrations
└── src/
    ├── app/
    │   ├── api/         # All backend logic as Next.js Route Handlers
    │   │   ├── auth/    # register, login, logout, refresh, me
    │   │   ├── posts/   # feed CRUD
    │   │   ├── threads/ # replies
    │   │   ├── reactions/
    │   │   ├── users/
    │   │   ├── search/
    │   │   └── admin/
    │   └── (pages)
    ├── components/
    ├── lib/
    │   ├── db.ts          # Prisma client singleton
    │   ├── auth-server.ts # JWT helpers (server-only)
    │   ├── posts-db.ts    # Post formatting + DB helpers
    │   └── api.ts         # Client-side fetch wrapper
    ├── stores/            # Zustand (auth, feed, theme)
    └── types/
```

## Getting Started

### 1. Clone and install

```bash
cd frontend && npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Neon connection string and JWT secrets:

```
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
JWT_ACCESS_SECRET=your-strong-secret
JWT_REFRESH_SECRET=your-strong-refresh-secret
```

### 3. Set up the database

```bash
npm run db:generate
npm run db:push
```

### 4. Run dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel — set **Root Directory** to `frontend`
3. Add environment variables:
   - `DATABASE_URL` — Neon connection string
   - `JWT_ACCESS_SECRET` — strong random string
   - `JWT_REFRESH_SECRET` — strong random string
4. Deploy — Vercel runs `prisma generate && next build` automatically via `vercel.json`

No separate backend service needed.
