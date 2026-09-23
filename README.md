# DSSSB TGT S.St Practice

A mobile-first MCQ practice app for the DSSSB TGT Social Studies exam — Geography,
History, Economics, Political Science, Mathematics, Reasoning, Hindi, English, and
Current Affairs. Google sign-in, per-user progress tracking, difficulty/PYQ filters,
show-answer, and per-topic reset.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma 7 · PostgreSQL ·
Auth.js (Google OAuth) · Azure App Service.

## 1. Local development

### Prerequisites
- Node.js 20+
- Docker Desktop (for local Postgres) — or point `DATABASE_URL` at any Postgres instance

### Setup
```bash
npm install
docker compose up -d          # starts local Postgres on :5432
cp .env.example .env          # already done for you locally; fill in Google creds
npx prisma migrate dev        # creates tables
npm run db:seed               # loads sample subjects/topics/questions
npm run dev                   # http://localhost:3000
```

Until you add real Google OAuth credentials (step 2), sign-in will fail — you can still
inspect the schema/data with `npm run db:studio`.

## 2. Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → OAuth consent screen** → configure (External, add your email as a
   test user while in testing mode).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://<your-domain>/api/auth/callback/google` (prod)
5. Copy the Client ID/Secret into `.env` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
6. Generate `AUTH_SECRET`: `npx auth secret` (or `openssl rand -base64 32`).

## 3. Data model

- `Subject` → `Topic` → `Question` (options stored as JSON `[{id, text}]`, plus
  `correctOption`, `explanation`, `difficulty`, `isPYQ`/`pyqYear`).
- `UserProgress` — one row per (user, question): `status` (`ATTEMPTED` or `REVEALED`),
  `selectedOption`, `isCorrect`. Deleting a user's rows for a topic is how "clear my
  answers for this topic" resets it to fresh.
- The correct answer and explanation are **never sent to the browser** for a question
  the user hasn't answered or revealed yet — `src/lib/queries.ts` strips them server-side.

Edit `prisma/schema.prisma` and run `npx prisma migrate dev --name <change>` for schema
changes. Add real questions either directly via `npm run db:studio` (Prisma's GUI) or by
extending `prisma/seed.ts` and re-running `npm run db:seed` (seeding is idempotent —
it upserts by subject/topic slug and question text).

## 4. Deploying to Azure

### One-time resource setup (Azure CLI)
```bash
az login
RG=dsssb-rg
LOCATION=centralindia

az group create -n $RG -l $LOCATION

# Postgres Flexible Server (burstable, cheapest tier)
az postgres flexible-server create \
  -g $RG -n dsssb-pg --location $LOCATION \
  --admin-user dsssbadmin --admin-password "<STRONG_PASSWORD>" \
  --sku-name Standard_B1ms --tier Burstable --storage-size 32 \
  --version 16 --public-access 0.0.0.0

az postgres flexible-server db create -g $RG -s dsssb-pg -d dsssb

# App Service (Linux, Node 20)
az appservice plan create -g $RG -n dsssb-plan --is-linux --sku B1
az webapp create -g $RG -p dsssb-plan -n dsssb-tgt-practice --runtime "NODE:20-lts"

az webapp config appsettings set -g $RG -n dsssb-tgt-practice --settings \
  DATABASE_URL="postgresql://dsssbadmin:<STRONG_PASSWORD>@dsssb-pg.postgres.database.azure.com/dsssb?sslmode=require" \
  AUTH_SECRET="<generated secret>" \
  AUTH_GOOGLE_ID="<client id>" \
  AUTH_GOOGLE_SECRET="<client secret>" \
  NEXTAUTH_URL="https://dsssb-tgt-practice.azurewebsites.net" \
  WEBSITE_NODE_DEFAULT_VERSION="~20"

az webapp config set -g $RG -n dsssb-tgt-practice --startup-file "node server.js"
```

Allow the app service to reach the database:
```bash
az postgres flexible-server firewall-rule create -g $RG -s dsssb-pg \
  --rule-name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

### CI/CD (GitHub Actions)
`.github/workflows/deploy.yml` builds the app and deploys on every push to `main`. Add
these repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Download from Azure Portal → your App Service → *Get publish profile*, paste the whole XML |
| `DATABASE_URL` | Same connection string as above |
| `AUTH_SECRET` | Same as App Service setting |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Same as App Service settings |
| `NEXTAUTH_URL` | `https://dsssb-tgt-practice.azurewebsites.net` |

Push to `main` and the workflow will run migrations against production and deploy.

### Custom domain / HTTPS
Azure App Service gives you a free `*.azurewebsites.net` HTTPS domain out of the box.
For a custom domain, add it under **App Service → Custom domains** and Azure provisions
a free managed certificate — then update `NEXTAUTH_URL` and the Google OAuth redirect
URI to match.

## 5. Later improvements (not built yet, by design for v1)
- Admin UI for adding/editing questions (right now: Prisma Studio or the seed file).
- Azure Cache for Redis in front of the question-list queries if traffic grows.
- Azure Blob Storage if questions need diagrams/images.
