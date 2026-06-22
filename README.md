# PulseChat

A production-ready full-stack social web application that combines the simplicity of Twitter/X with the feel of a real-time group chat.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, ShadCN-style UI, Zustand, Socket.IO Client, Framer Motion, Emoji Picker, TanStack Query |
| Backend | Node.js, Express, TypeScript, Socket.IO, JWT, Prisma |
| Database | Neon PostgreSQL |

## Features

- **Username/password auth** with JWT + refresh tokens (no email)
- **Auto-generated DiceBear avatars** with regeneration
- **Image, GIF, and sticker posts** (no text-only posts)
- **Real-time feed** via Socket.IO (posts, reactions, replies, typing indicators)
- **Threaded replies** up to 5 levels deep
- **Unicode emoji reactions** with live counters
- **Hashtag support** with trending sidebar
- **Date filtering** (today, 7/30 days, year, custom range)
- **Full-text search** (users, hashtags, captions)
- **Admin dashboard** (users, posts, ban, analytics)
- **Dark/light themes** (Twitter-inspired design)
- **Local file storage** with abstraction for S3/R2/Supabase migration

## Project Structure

```
pulse/
├── backend/                 # Express API + Socket.IO
│   ├── prisma/              # Schema, migrations, seed
│   └── src/
│       ├── config/          # Environment config
│       ├── lib/             # Auth, storage, avatar, prisma
│       ├── middleware/      # Auth, validation, errors
│       ├── routes/          # REST API routes
│       └── sockets/         # Socket.IO handlers
├── frontend/                # Next.js 15 App Router
│   └── src/
│       ├── app/             # Pages (home, explore, threads, profile, admin)
│       ├── components/      # UI, layout, feed, auth
│       ├── stores/          # Zustand (auth, theme, feed)
│       ├── lib/             # API client, socket, utils
│       └── types/           # Shared TypeScript types
└── package.json             # npm workspaces monorepo
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database (or any PostgreSQL instance)

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` with your Neon connection string:

```
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/pulsechat?sslmode=require"
JWT_ACCESS_SECRET=your-strong-secret
JWT_REFRESH_SECRET=your-strong-refresh-secret
```

### 3. Set up the database

```bash
npm run db:push      # Push schema to Neon
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed sticker data
```

Optional: run full-text search index:

```bash
cd backend && npx prisma db execute --file prisma/migrations/fulltext.sql
```

### 4. Run development servers

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Health check: http://localhost:4000/health

### 5. Create an admin user

Register normally, then promote via Prisma Studio or SQL:

```bash
npm run db:studio -w backend
```

Set `role` to `ADMIN` on your user record.

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Register with username + password |
| `POST /api/auth/login` | Login |
| `POST /api/auth/refresh` | Refresh access token |
| `GET /api/posts` | Paginated feed with date filters |
| `POST /api/posts` | Create image/sticker post |
| `GET /api/threads/:postId` | Get thread replies |
| `POST /api/threads/:postId` | Reply to thread |
| `POST /api/reactions/posts/:id` | Toggle reaction |
| `GET /api/search` | Search users, hashtags, captions |
| `GET /api/admin/*` | Admin dashboard (ADMIN role) |

## Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `post:new` | Server → Client | New post in feed |
| `reaction:added/removed` | Server → Client | Reaction updates |
| `reply:new` | Server → Client | New thread reply |
| `users:online` | Server → Client | Online user count |
| `typing:start/stop` | Bidirectional | Typing indicators |
| `thread:join/leave` | Client → Server | Join thread room |

## Storage Migration

The storage layer (`backend/src/lib/storage.ts`) uses a provider pattern. To migrate to cloud storage:

1. Set `STORAGE_PROVIDER=s3` (or `r2`, `supabase`)
2. Configure AWS/cloud credentials in `.env`
3. Implement the `S3StorageProvider` upload/delete methods

## Security

- bcrypt password hashing (12 rounds)
- Helmet, CORS, rate limiting
- Zod input validation
- Prisma parameterized queries (SQL injection protection)
- HttpOnly cookies for tokens
- JWT access (15m) + refresh (7d) token rotation

## License

MIT
