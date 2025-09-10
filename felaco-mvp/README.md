# Felaco MVP

From idea to online — with Felaco.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React (TypeScript)
- **Site Editor**: GrapesJS
- **Backend**: Node.js 20 + Express (TypeScript)
- **Database**: PostgreSQL
- **Cache/Sessions**: Redis
- **Authentication**: JWT + refresh tokens
- **AI Content**: OpenAI API
- **Containerization**: Docker Compose
- **Reverse Proxy**: Nginx

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+
- pnpm (recommended) or npm

### Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and update the values
3. Start the services:
   ```bash
   docker-compose up -d postgres redis
   ```
4. Install dependencies:
   ```bash
   cd backend && pnpm install
   cd ../frontend && pnpm install
   ```
5. Start the development servers:
   - Backend: `cd backend && pnpm dev`
   - Frontend: `cd frontend && pnpm dev`

## Project Structure

```
felaco-mvp/
├── frontend/      # Next.js application
├── backend/       # Express/NestJS server
├── templates/     # Seed templates (HTML/CSS)
├── infra/         # Infrastructure configs
│   ├── nginx/     # Nginx config
│   └── Dockerfile # Production Dockerfile
├── scripts/       # Utility scripts
└── .env.example  # Environment variables example
```

## Environment Variables

Copy `.env.example` to `.env` and update the values:

```env
# App
PORT=4000
DOMAIN_BASE=demo.felaco.local

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=felaco
DATABASE_URL=postgres://postgres:postgres@postgres:5432/felaco

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=replace_this
JWT_REFRESH_SECRET=replace_this_too

# OpenAI
OPENAI_API_KEY=sk-xxx

# Admin
ADMIN_EMAIL=admin@felaco.local
ADMIN_PASSWORD=changeme
```

## License

MIT
