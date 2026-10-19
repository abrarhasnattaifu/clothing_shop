# MamaCloset free demo deployment

This setup is for a temporary demo only. Do not use it for real customer details, payments, or orders. Free hosting terms and limits can change; confirm the current plan limits with each provider before creating services.

## What the free demo needs

- A free static frontend host, such as Render Static Sites.
- A free Node.js web-service host, such as Render free web services.
- A separate MySQL-compatible database provider. Render's free database is PostgreSQL, which this project does not support.
- An email provider with an HTTPS API. Render free web services block outbound SMTP, so use Resend for registration verification and admin email notifications.

The application uses Vite's `@/` alias for frontend source imports. These imports resolve from `frontend/src` and do not depend on the local Windows folder or the server's filesystem layout.

## 1. Create a clean demo database

Create an empty MySQL-compatible database that allows connections from the backend host. If the provider supplies TLS connection details, use them and set `DB_SSL=true`.

Run `database/FreeDemoSchema.sql` once against the new database. This creates the application's current tables without copying local customer, order, or other database records. Do not run the older SQL and migration files on top of this fresh schema.

After registering the account that will administer the demo, promote it using the database console:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-admin-email@example.com';
```

## 2. Deploy the backend

Create a Node.js web service connected to this repository and set:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Configure the service environment variables using `backend/.env.example` as a reference:

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` from the database provider
- `DB_SSL=true` when required by the database provider; otherwise `false`
- `JWT_SECRET` as a new, long, random secret
- `CORS_ORIGIN` as the exact deployed frontend origin, with no trailing slash
- `RESEND_API_KEY` from Resend
- `EMAIL_FROM` as an address allowed by the Resend account; `MamaCloset <onboarding@resend.dev>` is for testing to the account owner's verified address only
- `ADMIN_EMAIL` for order and admin email notifications

The host supplies `PORT`; do not hard-code a public port. Set `CORS_ORIGIN` to the static site's assigned URL once it is available.

## 3. Deploy the frontend

Create a static site connected to this repository:

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Build environment variable: `VITE_API_URL=https://<your-backend-service>.onrender.com`

Set `VITE_API_URL` to the backend origin only; do not add `/api`. Vite embeds it at build time, so redeploy the frontend after changing it.

Configure a rewrite for single-page app routes in the static host dashboard: `/*` to `/index.html` with status `200`. Then set the backend's `CORS_ORIGIN` to the exact static-site URL and redeploy the backend.

## Free-host limitations

- The free backend may sleep after inactivity, making the first request slow while it wakes up.
- Its local filesystem is temporary. Product and profile images stored under `backend/uploads` can disappear after restart, redeploy, or sleep. Do not rely on locally uploaded images surviving.
- Keep the demo database separate from any real shop database, and use only dummy accounts, products, and orders.
- Resend's unverified test sender can only deliver to the account owner's verified address. For verification emails to other test users, verify a sender domain with Resend and configure `EMAIL_FROM`.
- Test order and payment flows with fake data only. Do not collect real payment credentials or claim real payment processing.

## Secrets and local deployment

Never commit real `.env` files or paste their values into logs or chat. Rotate any database password, email app password, or JWT secret previously exposed outside the private environment before deploying.

For a local build, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL` if needed. Backend configuration belongs in `backend/.env`, based on `backend/.env.example`. These values are deployment settings and do not require source-code edits.
