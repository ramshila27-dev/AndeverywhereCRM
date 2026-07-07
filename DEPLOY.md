# Running Andeverywhere on your local machine

This is a Next.js app backed by PostgreSQL (via Prisma). The steps below get it
running at **http://localhost:3000** on your own computer.

## 1. Prerequisites

Install these once:

- **Node.js 20 or newer** — https://nodejs.org (LTS). Check with `node -v`.
- **Docker Desktop** — https://www.docker.com/products/docker-desktop
  (used to run PostgreSQL). Check with `docker --version`.
- **Git** — to clone the repository.

> Prefer your own Postgres instead of Docker? Skip step 4 and just point
> `DATABASE_URL` at your database in step 3.

## 2. Get the code

```bash
git clone <your-repo-url> andeverywhere
cd andeverywhere
git checkout claude/sleepy-planck-34rxfq   # the branch with these features
```

## 3. Create your environment file

Copy the template and fill in the values:

```bash
cp .env.example .env
```

Open `.env` and set:

- `DATABASE_URL` — leave the default if you use the bundled Docker Postgres.
- `AUTH_SECRET` — **required.** Generate a strong random value:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
  Paste the output between the quotes.
- `ANTHROPIC_API_KEY` — optional. Without it, AI itineraries use a built-in
  mock so everything else still works. Get a key at
  https://console.anthropic.com/ if you want real AI generation.

## 4. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL (container `voyage-db`) on port 5432 and keeps your data
in a Docker volume between restarts. Check it's healthy with `docker ps`.

## 5. Install dependencies

```bash
npm install
```

## 6. Create the database schema

```bash
npm run db:push
```

This creates all the tables (users, queries, quotes, rate catalog, …).

## 7. Create your admin login

```bash
npm run db:seed
```

This prints the initial admin credentials:

- **Email:** `admin@andeverywhere.co`
- **Password:** `Andeverywhere@2026`

You'll be asked to change the password on first sign-in. To use different
credentials: `node scripts/seed-admin.mjs you@example.com "YourPassword"`.

Optional — add sample employees so the Users list isn't empty:

```bash
npm run db:seed:demo
```

## 8. Load your rates (optional but recommended)

Either import the supplied rate sheets from the command line:

```bash
npm run db:import
```

…or start the app (next step) and upload the XLS files from
**Rates → Upload Prices (XLS)**, and set hotel/activity/transfer photos there.

## 9. Build and run

**For a production-style run (recommended for “deploying”):**

```bash
npm run build
npm run start
```

**For development (auto-reload while editing):**

```bash
npm run dev
```

Then open **http://localhost:3000** and sign in with the admin credentials
from step 7.

---

## Everyday commands

| Task                        | Command                       |
| --------------------------- | ----------------------------- |
| Start the database          | `docker compose up -d`        |
| Stop the database           | `docker compose down`         |
| Run the app (prod)          | `npm run build && npm run start` |
| Run the app (dev)           | `npm run dev`                 |
| Reset/create admin          | `npm run db:seed`             |
| Browse the DB visually      | `npm run db:studio`           |

## Notes & troubleshooting

- **Uploaded images** are stored in `public/uploads/`. Keep that folder (it is
  git-ignored) so hotel/activity photos survive restarts.
- **Login fails from another device on your network** (e.g.
  `http://192.168.1.20:3000`): the session cookie is marked `Secure` in
  production and needs HTTPS. For plain-HTTP LAN access, set
  `AUTH_INSECURE_COOKIE="true"` in `.env` and restart. `http://localhost:3000`
  on the same machine always works.
- **Port 3000 in use:** run on another port with `npm run start -- -p 3001`.
- **Database won't connect:** make sure Docker is running and
  `docker ps` shows `voyage-db` as healthy; the app reads `DATABASE_URL`.
- **Changed the schema:** re-run `npm run db:push`.
