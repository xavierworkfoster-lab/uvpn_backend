# UVPN Backend

Production-oriented modular monolith for the UVPN Windows VPN client. It provides account authentication, plan and subscription authority, crypto checkout, device registration, server discovery, and VPN session authorization. VPN packets never pass through this API; the client connects directly to its selected VPN server.

## Stack

- Node.js 24, NestJS 12, TypeScript
- PostgreSQL 17 and Prisma ORM 7
- JWT access tokens, rotating hashed refresh tokens, Argon2id
- NOWPayments hosted invoices and signed IPN callbacks
- Docker Compose, Jest, Swagger

## Requirements

- Node.js 24 LTS and npm
- Docker Desktop with Docker Compose
- A PostgreSQL database for local runs (Compose provides one)
- NOWPayments API key and IPN secret for payment flows

## Configure

Copy `.env.example` to `.env`. Set distinct random JWT secrets of at least 32 characters. Set `PUBLIC_API_URL` to a public HTTPS base URL before accepting real provider callbacks. Keep `.env` and all real credentials out of source control.

## Local development

```bash
Copy-Item .env.example .env
npm ci
docker compose up -d postgres
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

For the full containerized stack:

```bash
docker compose up --build
```

The API listens on `http://localhost:3000`; PostgreSQL is bound to localhost only. `GET /api/v1/health` checks the API and database. Swagger is available at `/api/docs` in development.

## Database changes

Create and apply a local migration after editing `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name describe_change
npx prisma generate
```

Deploy committed migrations with:

```bash
npx prisma migrate deploy
```

Prisma 7 configuration and the database URL are in `prisma7.config.ts` and `.env`.

## API overview

All API routes use `/api/v1`.

| Area | Routes |
|---|---|
| Authentication | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` |
| Account | `GET /account`, `/account/subscription`, `/account/devices` |
| Devices | `POST /account/devices`, `DELETE /account/devices/:id` |
| Plans | `GET /plans` |
| Payments | `POST /payments`, `GET /payments/:id`, `/payments/history` |
| Webhooks | `POST /webhooks/nowpayments` |
| VPN | `GET /vpn/servers`, `/vpn/sessions`; `POST /vpn/sessions`; `DELETE /vpn/sessions/:id` |
| Admin | `/admin/users`, `/admin/payments`, `/admin/subscriptions`, plan/server management |

Register and login return an access token and a raw refresh token. Refresh tokens are stored only as SHA-256 hashes, rotated on use, and revoked at logout. Protected endpoints require `Authorization: Bearer <accessToken>`. Request DTOs reject extra fields.

An administrator must provision plans and VPN servers through the admin endpoints. To bootstrap the first administrator, register the account and promote it once using a trusted database operator, for example:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'operator@example.com';
```

Do this only through a secured database connection; never expose an admin promotion endpoint to clients.

## Payments and subscriptions

Payment creation accepts only a plan UUID. The backend loads the active plan and price from PostgreSQL, records the order, and creates a NOWPayments hosted invoice. The API returns the invoice URL for the desktop client to open. Set `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_API_URL`, and `PUBLIC_API_URL` in the server environment.

The IPN handler verifies the `x-nowpayments-sig` HMAC-SHA512 signature, checks order, currency, amount, and payment identity, stores each event, and processes successful payments inside a database transaction. Event and payment state guards prevent duplicate notifications from extending a subscription more than once. The client cannot set payment or subscription state.

## Security and deployment

- Serve the API behind HTTPS in production; set a narrowly scoped `CORS_ORIGIN` if browser clients are added.
- Keep PostgreSQL on a private network and use a least-privilege database role.
- Store secrets in a deployment secret manager; `.env.example` contains placeholders only.
- The API container runs as the unprivileged `node` user. Docker Compose publishes local development ports on loopback.
- Run `npx prisma migrate deploy` as a release/migration step before deploying the runtime image.
- Configure NOWPayments with the exact public webhook URL and IPN secret.
- No VPN traffic is proxied through NestJS. VPN credentials/configuration issuance remains server-architecture-specific and is intentionally not faked.

## Checks

```bash
npm run build
npm test -- --runInBand
npm run start:dev
```

The API requires PostgreSQL and valid environment configuration at startup. Payment and VPN flows also require configured records and provider/server infrastructure.

