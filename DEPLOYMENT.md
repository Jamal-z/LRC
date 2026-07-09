# Deployment Guide — LRC Volunteer Management System

## What this app is

- **Frontend:** Vite 8 + React 19 + TypeScript — a **static single-page app**. There is no
  Node backend to run; `vite build` produces static files in `dist/`.
- **Backend:** **Supabase** (hosted Postgres + Auth + Storage). The browser talks to
  Supabase directly using two build-time variables.
- **Served in production by:** `vite preview` (serves `dist/` with SPA routing),
  supervised by **systemd**, on a **configurable, non-default port** so it never
  collides with other services on the box.

Two environment variables are **baked into the JavaScript at build time**:

| Variable                 | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL                      |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key (RLS-protected)  |

Because they are inlined at build time, **the build must run on the server after
`.env.production` exists** — `deploy.sh` handles this ordering for you.

Runtime knobs (used by systemd + `vite.config.ts`):

| Variable   | Default       | Meaning                                                        |
| ---------- | ------------- | -------------------------------------------------------------- |
| `APP_HOST` | `127.0.0.1`   | Bind address. `127.0.0.1` = behind a proxy; `0.0.0.0` = direct |
| `APP_PORT` | `8137`        | Listen port — pick one not used by anything else               |

---

## One-time server setup (Ubuntu)

Do this **once** per server.

1. **Install prerequisites** (Node.js 20 LTS, git, curl):

   ```bash
   sudo apt update
   sudo apt install -y git curl
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. **Get `deploy.sh` onto the server and clone the app.** The script deploys in
   place when run from inside the checkout, so the simplest path is to clone once:

   ```bash
   mkdir -p ~/apps
   git clone https://github.com/Jamal-z/LRC.git ~/apps/LRC
   cd ~/apps/LRC
   ```

   > `deploy.sh` can also clone for you: copy just the script out, set `APP_DIR`,
   > and run it — if the directory is missing it runs `git clone` automatically.

3. **Create the production env file** and fill in real values:

   ```bash
   cp .env.production.example .env.production
   nano .env.production        # set VITE_SUPABASE_* and choose an APP_PORT
   ```

4. **Set up the Supabase database (out-of-band, once).** The SQL in
   `supabase/migrations/` targets your hosted Supabase project — apply it either by
   pasting `supabase/combined_setup.sql` into the **Supabase Dashboard → SQL Editor**,
   or with the Supabase CLI / `psql`. See "Database migrations" below.

5. **Run the first deploy:**

   ```bash
   ./deploy.sh
   ```

   Enter your sudo password if prompted — it installs and enables the
   `lrc.service` systemd unit and starts the app.

6. **(Recommended) Put a reverse proxy + TLS in front** if `APP_HOST=127.0.0.1`.
   Example Nginx site:

   ```nginx
   server {
       server_name lrc.example.com;
       location / {
           proxy_pass http://127.0.0.1:8137;   # match APP_PORT
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Then `sudo certbot --nginx -d lrc.example.com`. If instead you set
   `APP_HOST=0.0.0.0`, open the firewall for `APP_PORT` (`sudo ufw allow 8137/tcp`).

---

## Subsequent deployments

Your workflow, every time you ship:

1. Push code to GitHub (`git push origin main`).
2. SSH into the server.
3. Run the deploy:

   ```bash
   cd ~/apps/LRC
   ./deploy.sh
   ```

`deploy.sh` will, in order:

- pull the latest `main` (hard-resets to `origin/main`),
- install deps **only if `package-lock.json` changed**,
- rebuild **only if the code, deps, or Supabase URL changed**,
- gracefully restart the single systemd-managed instance (old one stopped first),
- **verify HTTP 200** on `APP_HOST:APP_PORT` before reporting success, and
- exit non-zero (with recent logs) if anything fails.

It is **idempotent** — running it again with no new commits is a safe no-op that
still confirms the app is healthy.

---

## Database migrations

The migrations run against your **hosted Supabase** database, not a local one, and
several are not idempotent (`create type`, `create table` without guards). So they
are **not** part of the normal deploy.

- **Fresh database (typical):** paste `supabase/combined_setup.sql` into the
  Supabase SQL Editor once, or run the files in `supabase/migrations/` in order.
- **Automated (opt-in):** set in `.env.production`:

  ```bash
  RUN_MIGRATIONS=true
  SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres
  ```

  and install `psql` (`sudo apt install -y postgresql-client`). `deploy.sh` will
  then apply `supabase/migrations/*.sql` in order. Use this against a **fresh** DB
  only; leave `RUN_MIGRATIONS=false` for routine deploys.

---

## Configuration reference

Override any of these as environment variables when calling `deploy.sh`
(e.g. `SERVICE_NAME=lrc-staging APP_PORT=8231 ./deploy.sh`):

| Variable         | Default                                | Purpose                                  |
| ---------------- | -------------------------------------- | ---------------------------------------- |
| `REPO_URL`       | `https://github.com/Jamal-z/LRC.git`   | Git remote to clone                      |
| `BRANCH`         | `main`                                 | Branch to deploy                         |
| `APP_DIR`        | in-place, else `~/apps/LRC`            | Checkout location                        |
| `SERVICE_NAME`   | `lrc`                                  | systemd unit name (run multiple copies)  |
| `RUN_USER`       | current user                           | Linux user the service runs as           |
| `APP_HOST`       | `127.0.0.1`                            | Bind address                             |
| `APP_PORT`       | `8137`                                 | Listen port                              |
| `HEALTH_TIMEOUT` | `60`                                   | Seconds to wait for HTTP 200             |
| `RUN_MIGRATIONS` | `false`                                | Apply Supabase SQL on deploy (opt-in)    |

---

## Operating the service

```bash
sudo systemctl status lrc      # current state
sudo systemctl restart lrc     # manual restart
sudo systemctl stop lrc        # stop
journalctl -u lrc -f           # live logs
```

Because the app is a single systemd unit bound to one port with `strictPort`,
there is **never more than one instance** running.

---

## Troubleshooting

- **"`.env.production` not found"** — you skipped step 3 of the one-time setup.
- **Health check fails / "This host is not allowed"** — already handled
  (`allowedHosts: true` in `vite.config.ts`); check `journalctl -u lrc` for the
  real error (usually a wrong `APP_PORT` already in use, or missing Supabase vars).
- **Blank page / "Missing Supabase env vars"** — `VITE_SUPABASE_*` were empty at
  build time. Fix `.env.production` and redeploy (the build re-runs when the URL
  changes; otherwise `rm -rf dist && ./deploy.sh` to force a rebuild).
- **Port already in use** — change `APP_PORT` in `.env.production` and redeploy.
