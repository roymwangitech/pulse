# PulseChat

A full-stack real-time social app — text and emoji posts, threaded replies, live reactions.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Zustand, Socket.IO Client, Framer Motion, Emoji Picker, TanStack Query |
| Backend | Node.js, Express, TypeScript, Socket.IO, JWT, Prisma |
| Database | Supabase PostgreSQL |
| Deployment | Vercel (frontend) + Render (backend) |

## Features

- Username/password auth with JWT + refresh tokens
- Auto-generated DiceBear avatars
- Text + emoji posts (no image/file uploads)
- Real-time feed via Socket.IO (posts, reactions, replies, typing indicators)
- Threaded replies up to 5 levels deep
- Unicode emoji reactions with live counters
- Hashtag support with trending sidebar
- Date filtering (today, 7/30 days, year, custom range)
- Full-text search (users, hashtags, captions)
- Admin dashboard (users, posts, ban, analytics)
- Dark/light themes

## Project Structure

```
pulse/
├── backend/                 # Express API + Socket.IO
│   ├── prisma/              # Schema and migrations
│   └── src/
│       ├── config/          # Environment config
│       ├── lib/             # Auth, avatar, prisma
│       ├── middleware/      # Auth, validation, errors
│       ├── routes/          # REST API routes
│       └── sockets/         # Socket.IO handlers
├── frontend/                # Next.js 15 App Router
│   ├── vercel.json          # Rewrites /api/* → Render backend
│   └── src/
│       ├── app/             # Pages
│       ├── components/      # UI, layout, feed, auth
│       ├── stores/          # Zustand (auth, theme, feed)
│       ├── lib/             # API client, socket, utils
│       └── types/           # Shared TypeScript types
├── render.yaml              # Render deployment config
└── package.json             # npm workspaces monorepo
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` — get your Supabase connection strings from:
Project Settings → Database → Connection string (use "Transaction" pooler for `DATABASE_URL`, direct for `DIRECT_URL`)

```
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
JWT_ACCESS_SECRET=your-strong-secret
JWT_REFRESH_SECRET=your-strong-refresh-secret
CORS_ORIGIN=http://localhost:3000
```

Edit `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### 3. Set up the database

```bash
npm run db:push      # Push schema to Supabase
npm run db:generate  # Generate Prisma client
```

Optional full-text search index:

```bash
cd backend && npx prisma db execute --file prisma/migrations/fulltext.sql
```

### 4. Run development servers

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

---

## Deployment

### Backend → Render

1. Push to GitHub
2. Create a new Render **Web Service**, point it at the repo root
3. Render picks up `render.yaml` automatically
4. In Render's environment variables, set:
   - `DATABASE_URL` — Supabase transaction pooler URL
   - `DIRECT_URL` — Supabase direct URL
   - `CORS_ORIGIN` — your Vercel frontend URL (`https://your-app.vercel.app`)
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — strong random strings

### Frontend → Vercel

1. Import the repo into Vercel, set **Root Directory** to `frontend`
2. In Vercel's environment variables:
   - `NEXT_PUBLIC_SOCKET_URL` — your Render backend URL (`https://your-app.onrender.com`)
   - Leave `NEXT_PUBLIC_API_URL` **unset** — REST calls go through the `/api` rewrite
3. Edit `frontend/vercel.json` and replace `https://your-app.onrender.com` with your actual Render URL
4. Deploy

The Vercel rewrite in `frontend/vercel.json` proxies `/api/*` to Render, so the Render URL is never exposed in the browser for REST calls. Socket.IO connects directly to Render (required for WebSocket support).
