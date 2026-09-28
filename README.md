# Job Scraper — NestJS + Playwright + BullMQ + MongoDB

An automated job scraper that runs browser sessions in the background, scrapes job listings from Rozee.pk, and saves them to MongoDB. Built with production-grade patterns: session persistence, crash recovery, idempotent jobs, and scheduled runs.

## Tech Stack

- **NestJS 10** + TypeScript
- **Playwright** — browser automation
- **BullMQ** + ioredis — job queue with retry & crash recovery
- **MongoDB** + Mongoose — data storage with duplicate prevention
- **@nestjs/schedule** — cron-based scheduling (every 6 hours)

## Features

- Automated browser scraping using Playwright (headless Chromium)
- Session persistence across restarts (saves cookies/localStorage to disk)
- Dead session detection — if session is expired, deletes it and starts fresh
- BullMQ queue with automatic retries (3 attempts, exponential backoff)
- Idempotent jobs — if a job crashes and retries, no duplicate data is written
- Duplicate URL detection — same job posting never saved twice
- Scheduled scraping every 6 hours via cron
- Manual trigger via REST API
- Image/font blocking for faster scraping
- Multi-page scraping (page 1 + page 2)

## Project Structure

```
src/
├── app.module.ts                  # Root module
├── main.ts                        # Entry point
├── config/
│   └── config.module.ts           # Env loading
└── modules/
    ├── jobs/
    │   ├── job.schema.ts          # MongoDB schema
    │   ├── jobs.service.ts        # Save/query jobs
    │   ├── jobs.controller.ts     # REST API for jobs
    │   └── jobs.module.ts
    ├── session/
    │   ├── session.service.ts     # Session save/restore/validate
    │   └── session.module.ts
    ├── scraper/
    │   ├── scraper.service.ts     # Playwright browser logic
    │   └── scraper.module.ts
    └── queue/
        ├── queue.processor.ts     # BullMQ worker
        ├── queue.service.ts       # Add jobs + scheduler
        ├── queue.controller.ts    # Manual trigger API
        └── queue.module.ts
```

## How Session Management Works

When the scraper runs for the first time, it opens a fresh browser. After scraping, it saves the browser's cookies and localStorage to a `.json` file in the `./sessions/` folder.

On the next run, it loads that saved session — so no need to re-authenticate. If the session file is corrupted or the session has expired (detected by checking for a logged-in element on the page), it deletes the file and starts fresh automatically.

This means the scraper stays alive across:
- App restarts
- Server reboots
- Redeploys

## How Crash Recovery Works

Every scrape job goes through BullMQ queue. If the job crashes (network timeout, site down, etc.), BullMQ automatically retries it up to 3 times with exponential backoff:

- Attempt 1: immediate
- Attempt 2: wait 5 seconds
- Attempt 3: wait 25 seconds

Jobs are also idempotent — if a job runs twice (e.g. after a crash mid-run), MongoDB's `upsert` with `$setOnInsert` ensures no duplicate records are created.

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Start MongoDB + Redis + App
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Option 2: Local

**Prerequisites:** Node.js 18+, MongoDB running on 27017, Redis running on 6379

```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Copy env file and edit it
cp .env.example .env

# Start in dev mode
npm run start:dev
```

## Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/job-scraper
REDIS_HOST=localhost
REDIS_PORT=6379
SCRAPE_INTERVAL_HOURS=6
SESSION_FILE_PATH=./sessions
SEARCH_QUERIES=Node.js developer,NestJS developer,TypeScript developer
SEARCH_LOCATION=Pakistan
```

## API Endpoints

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | Get all scraped jobs |
| GET | `/jobs/stats` | Total jobs, breakdown by source & query |
| GET | `/jobs/by-query?q=Node.js` | Filter jobs by search query |

### Queue

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/queue/stats` | Waiting, active, completed, failed jobs |
| POST | `/queue/trigger` | Manually trigger scrape `{ "query": "React developer" }` |
| POST | `/queue/trigger-all` | Trigger all configured queries |

## Example API Responses

**GET /jobs/stats**
```json
{
  "success": true,
  "data": {
    "total": 142,
    "bySource": [{ "_id": "rozee.pk", "count": 142 }],
    "byQuery": [
      { "_id": "Node.js developer", "count": 58 },
      { "_id": "NestJS developer", "count": 47 },
      { "_id": "TypeScript developer", "count": 37 }
    ]
  }
}
```

**GET /queue/stats**
```json
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 1,
    "completed": 9,
    "failed": 0,
    "delayed": 0
  }
}
```

## Debugging Tips

- Session files are saved to `./sessions/` — check them if login issues occur
- Debug screenshots are saved to `./sessions/debug_*.png` after each scrape
- Queue failed jobs are kept in Redis for inspection (`removeOnFail: 100`)
- Run with `headless: false` in `scraper.service.ts` to watch the browser live

## License

MIT
