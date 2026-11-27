# Elijah AI — Database Configuration & Migration Guide

This guide explains how PostgreSQL and Prisma work in the Elijah AI backend, how to switch between local and cloud databases (Supabase, Neon, AWS, DigitalOcean), and how to initialize or migrate your data.

---

## 1. Quick Concept (For Developers Coming from MongoDB)

If you are used to MongoDB and Mongoose:

| Concept | MongoDB | PostgreSQL + Prisma (Elijah AI) |
|---|---|---|
| **Connection String** | `MONGO_URI="mongodb+srv://..."` | `DATABASE_URL="postgresql://..."` |
| **Configuration File** | `.env` | `backend/.env` |
| **Data Container** | Collection | Table (`customers`, `jobs`, `equipments`) |
| **Record** | Document (JSON/BSON) | Row |
| **Schema Definition** | Mongoose Schema files | `backend/prisma/schema.prisma` |
| **Visual Browser** | MongoDB Compass | **Prisma Studio** (`npx prisma studio`) or Cloud Web GUI |

In this project, **PostgreSQL** is the database engine that physically holds your data, and **Prisma** is the TypeScript ORM that handles queries, schema migrations, and type generation.

---

## 2. Cloud Provider Comparison: Which Option is Best?

| Feature | 🥇 Supabase (Recommended) | 🥈 Neon (Serverless) | 🥉 DigitalOcean / AWS RDS / Render |
|---|---|---|---|
| **Best For** | **Fast setup, web UI & production ready** | **Dev branching & serverless apps** | **Always-on dedicated VPS/production** |
| **Free Tier** | Free (500 MB storage, generous limits) | Free (0.5 GB storage, serverless) | Paid ($7–$15 / month) |
| **Cold Starts** | **None** on active projects | Auto-suspends compute after 5 min of inactivity (~1s wakeup) | **None** (always running dedicated server) |
| **Web Dashboard** | ⭐ Excellent (like MongoDB Atlas GUI) | Good (SQL editor & branching) | Basic cloud console |
| **Connection Pooler** | Built-in PgBouncer (Port 6543) | Built-in PgBouncer | Manual or cloud add-on |
| **Voice AI Suitability** | **High** (instant query response) | Medium (cold start may delay 1st call) | **Highest** (dedicated resources) |

### 🏆 Verdict & Recommendation:
* **Choose Supabase** if you want a **free, fast setup** with a powerful browser dashboard (to view/edit customers, jobs, and tables visually like MongoDB Atlas) and zero cold-start delay during phone calls.
* **Choose Neon** if you want serverless branching (branching databases like git branches).
* **Choose DigitalOcean or AWS RDS** if you want a dedicated production server that never pauses under any circumstance.

---

## 3. How to Connect to Each Cloud Provider

Open `backend/.env` and replace `DATABASE_URL`:

### Option A: Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In Project Settings -> **Database** -> **Connection string**, select **URI** and choose **Transaction Mode (Pooler)**:
```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
```
*(Use port `6543` with `?pgbouncer=true` for Prisma connection pooling).*

### Option B: Neon (Serverless Postgres)
1. Go to [neon.tech](https://neon.tech) and create a free project.
2. Copy the pooled connection string from your dashboard:
```env
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[ENDPOINT].us-east-2.aws.neon.tech/[DB_NAME]?sslmode=require"
```

### Option C: DigitalOcean / Render / AWS RDS
1. Create a Managed PostgreSQL instance.
2. Copy the connection string:
```env
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DB_NAME]?sslmode=require"
```

---

## 4. Step-by-Step: Initializing a Fresh Database

When you switch `DATABASE_URL` to a brand-new cloud database, it will be completely empty. Follow these 3 commands to set up all tables and initial data:

```bash
cd backend

# Step 1: Push all 15+ database tables (creates schema, foreign keys, and indexes)
npx prisma db push

# Step 2: Seed default system roles, SuperAdmin, and company accounts
npm run prisma:seed
```

Once completed, start your backend:
```bash
npm run dev
```

---

## 5. Visual Database Management (Prisma Studio)

If your database provider does not have a web UI, or if you want to inspect local data in your browser:
```bash
cd backend
npx prisma studio
```
This opens `http://localhost:5555` with a spreadsheet-like browser to search, filter, insert, and edit rows across all tables (`Customer`, `Job`, `Equipment`, `User`, `Tenant`, etc.).

---

## 6. How to Migrate Existing Local Data to Cloud

If you have test data in your local PostgreSQL that you want to transfer into your new cloud database:

### Export from Local Database:
```bash
pg_dump -U postgres -h localhost -p 5432 -d elijah_db -F c -b -v -f elijah_backup.dump
```

### Import into Cloud Database:
```bash
pg_restore -d "YOUR_NEW_DATABASE_URL" -v elijah_backup.dump
```
*(Or simply run `npx prisma db push` followed by `npm run prisma:seed` and `node scripts/seed-demo-crm.cjs` for a clean, verified seed).*
