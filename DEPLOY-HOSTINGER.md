# Deploying Andeverywhere on a Hostinger VPS

This guide runs the app on a **Hostinger VPS (KVM)** and serves it at
**http://YOUR_VPS_IP:3000**. It uses Docker for PostgreSQL and PM2 to keep the
Next.js server running (and restart it on reboot).

> This app is a Node.js server + PostgreSQL. It requires a **VPS** — it cannot
> run on Hostinger shared "Web Hosting" or "Cloud Hosting" (PHP/MySQL only).

Assumes a fresh **Ubuntu 22.04/24.04** VPS. Commands are run as `root` (or with
`sudo`). Replace `YOUR_VPS_IP` with your server's IP throughout.

---

## 1. Create the VPS in hPanel

1. In hPanel → **VPS** → pick your KVM plan.
2. Choose OS **Ubuntu 24.04** (a plain Ubuntu template, not a control-panel one).
3. Set a root password and note the **IP address**.

## 2. Connect over SSH

From your own computer:

```bash
ssh root@YOUR_VPS_IP
```

## 3. Install the tools (Node.js, Docker, Git)

```bash
apt update && apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# Docker (for the PostgreSQL database)
curl -fsSL https://get.docker.com | sh

# PM2 process manager (keeps the app running)
npm install -g pm2

# Verify
node -v && docker --version && pm2 -v
```

## 4. (Recommended) Add swap so the build doesn't run out of memory

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 5. Get the code

```bash
cd /opt
git clone YOUR_REPO_URL andeverywhere
cd andeverywhere
git checkout claude/sleepy-planck-34rxfq
```

## 6. Create the environment file

```bash
cp .env.example .env
nano .env
```

Set these values:

- `DATABASE_URL` — keep the default (matches the Docker database).
  For better security, change the password here **and** in `docker-compose.yml`
  so they match, e.g.
  `postgresql://voyage:SOME_STRONG_PASSWORD@localhost:5432/voyage?schema=public`.
- `AUTH_SECRET` — **required.** Generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `AUTH_INSECURE_COOKIE` — **set to `"true"`.** You're accessing the app over
  plain `http://` at an IP address, so the session cookie must not be
  `Secure` or login will fail. (When you later add a domain + HTTPS, remove
  this.)
- `ANTHROPIC_API_KEY` — optional (blank = AI itineraries use a mock).

Save and exit (in nano: `Ctrl+O`, `Enter`, `Ctrl+X`).

## 7. Start the database

```bash
docker compose up -d
docker ps        # voyage-db should be "healthy"
```

The database port is bound to `127.0.0.1` only, so it is **not** reachable from
the internet.

## 8. Install, create schema, seed the admin

```bash
npm install
npm run db:push
npm run db:seed          # prints your admin login
# optional: npm run db:seed:demo     # sample employees
# optional: npm run db:import        # load the supplied rate sheets
```

The admin login printed by `db:seed`:

- **Email:** `admin@andeverywhere.co`
- **Password:** `Andeverywhere@2026` (you'll change it on first sign-in)

## 9. Build the app

```bash
npm run build
```

## 10. Run it with PM2 (stays up + restarts on reboot)

```bash
pm2 start "npm run start" --name andeverywhere
pm2 save
pm2 startup        # then run the command it prints, to enable boot startup
```

Useful later: `pm2 logs andeverywhere`, `pm2 restart andeverywhere`,
`pm2 status`.

## 11. Open the firewall for port 3000

Two layers to check:

**On the server (ufw), if enabled:**
```bash
ufw allow 22/tcp
ufw allow 3000/tcp
ufw --force enable
```

**In hPanel:** VPS → your server → **Firewall**. Make sure inbound TCP **3000**
(and **22** for SSH) are allowed. If Hostinger's firewall is set to block by
default, add an accept rule for port 3000.

## 12. Open the app

Visit **http://YOUR_VPS_IP:3000** and sign in with the admin credentials. You'll
be prompted to change the password on first login.

---

## Updating the app later

```bash
cd /opt/andeverywhere
git pull
npm install
npm run db:push        # only if the schema changed
npm run build
pm2 restart andeverywhere
```

## Notes

- **Uploaded photos** live in `public/uploads/` on the VPS — they persist as
  long as you don't delete the folder. `git pull` won't touch it.
- **Database data** persists in the Docker volume `voyage-db-data` across
  restarts and redeploys.
- **Backups:** dump the DB with
  `docker exec voyage-db pg_dump -U voyage voyage > backup.sql`.
- **Port 80 instead of :3000 / adding a domain + HTTPS:** put Nginx in front as
  a reverse proxy and use Certbot for a free SSL cert, then remove
  `AUTH_INSECURE_COOKIE` from `.env`. Ask and I'll add those steps.
- **Security:** change the default Postgres password (step 6) and the admin
  password (first login). Consider creating a non-root SSH user.
