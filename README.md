# TTHub

Personal table tennis management application for organizing teams, players and tournaments.

## Tech Stack

- TanStack Start
- Prisma ORM with SQLite
- Tailwind CSS with DaisyUI
- TanStack Form
- Vitest + Playwright
- Biome
- Sentry
- Docker + Fly.io

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env.local` file with the following variables:

```env
DATABASE_URL="file:./prisma/dev.db"
SESSION_SECRET="your-secret-key"
SENTRY_DSN="your-sentry-dsn" # Optional
VITE_SENTRY_HOST="sentry-host-address"
VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
```

Generate VAPID keys for web push notifications:

```bash
npm run generateVapidKeys
```

### Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed

# Open Prisma Studio to view/edit data
npm run db:studio
```

## Contributing

This is a personal project. Feel free to fork and adapt to your needs.