# Connect Team

Staff operations and communications app for True To You Therapy. Staff use it on their phones; admins use it on laptops.

**Status:** MVP under review on GitHub. It will be deployed to AWS under the AWS Business Associate Addendum (BAA) once approved.

## What's in it

| Area | Staff | Admin / Owner |
| --- | --- | --- |
| **Time clock** | Clock in/out with service + kid, shift notes, manual entries (need approval), request changes to past shifts (staff can't edit their own times) | See and edit all hours, approve/deny manual entries, change requests and long shifts |
| **Pay** | | Base rate per staff member, rate per service (e.g. eval vs group), per-staff rate for a service; payroll CSV for QuickBooks |
| **Chat** | Direct messages, groups (anyone can create) | Same |
| **Updates** | Announcement feed; anyone can post | Admins can remove posts |
| **Directory** | Everyone, searchable, call or message in one tap; your groups | Same |
| **Time off** | Request from the menu, see the answer | Approve/deny |
| **People / kids** | | Owner adds people and sets roles; admins manage the kid list |

Roles: **Staff**, **Admin** (approvals, hours, export, kids), **Owner** (everything, plus rates and people).

Coming next: recognition & rewards, org chart (the "reports to" field is already captured), QuickBooks API, IntakeQ data migration.

## Run it locally

Requires Node 20+ and Docker.

```bash
cp .env.example .env
docker compose up -d          # local Postgres
npm install
npm run db:migrate            # create tables
npm run db:seed               # fictional demo people and kids
npm run dev                   # http://localhost:3000
```

Demo sign-ins (password `Password123!`): `owner@example.com`, `admin@example.com`, `staff@example.com`.

Checks: `npm run typecheck`, `npm test`, `npm run build`. CI runs all three on every pull request.

## Stack

Next.js 15 (React, TypeScript, server actions), PostgreSQL with Prisma, Tailwind CSS. Installable on phones as a web app. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the AWS plan and HIPAA/FERPA safeguards.
