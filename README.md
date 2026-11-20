# Elijah AI — Multi-Tenant Core Backend API

Enterprise Multi-Tenant backend engine for Elijah AI with Dynamic Role-Based Access Control (RBAC), permission gating, financial approval thresholds, and strict tenant isolation.

👉 **Quick Step-by-Step Guide: [HOW_TO_RUN.md](HOW_TO_RUN.md)**

---

## 1. Quick Start

### Step 1: Start PostgreSQL via Docker
Run the included `docker-compose.yml` to start PostgreSQL 16 (with pgvector) and Redis:
```bash
docker-compose up -d
```
*(If running on a cloud database like Neon.tech or Supabase, simply paste your `DATABASE_URL` into `.env`).*

### Step 2: Push Database Schema
Sync your PostgreSQL database with the Prisma schema:
```bash
npm run prisma:push
```

### Step 3: Seed Default Roles & Demo Accounts
Populate the 30+ system permissions, the platform SuperAdmin, and the Desert Air HVAC demo tenant:
```bash
npm run prisma:seed
```

### Step 4: Run the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

---

## 2. Visual Database Browser (Prisma Studio)
To visually inspect or edit tenants, roles, and users in your browser:
```bash
npm run prisma:studio
```
Opens at `http://localhost:5555`.

---

## 3. Core API Endpoints

### Super Admin (Platform Level)
* `POST /api/v1/super/auth/login` — SuperAdmin login
* `GET  /api/v1/super/tenants` — List all registered tenants (companies)
* `POST /api/v1/super/tenants` — Create a new tenant (auto-seeds default Owner & Admin roles)
* `PATCH /api/v1/super/tenants/:id/status` — Suspend / activate tenant

### Company / Tenant Auth
* `POST /api/v1/auth/login` — Staff & Owner login (returns JWT with `tenantId` & `role`)
* `GET  /api/v1/auth/me` — Load active user profile and permission list

### Dynamic Roles & Permissions
* `GET    /api/v1/roles/permissions` — List all 30+ selectable platform permissions
* `GET    /api/v1/roles` — List all roles created for this tenant
* `POST   /api/v1/roles` — Create a custom dynamic role with custom permissions & approval limits
* `PUT    /api/v1/roles/:id` — Update dynamic role (default roles are protected)
* `DELETE /api/v1/roles/:id` — Delete dynamic role (prevented if users are assigned)

### Team Management
* `GET   /api/v1/users` — List company users and their assigned roles
* `POST  /api/v1/users` — Invite new team member and assign a role
* `PATCH /api/v1/users/:id/role` — Reassign user to a different role
* `PATCH /api/v1/users/:id/status` — Activate / deactivate team member

---

## 4. Default Seeded Credentials

| Account | Email | Password | Role |
|---|---|---|---|
| **SuperAdmin** | `superadmin@elijah.ai` | `SuperSecretPassword123!` | Platform SuperAdmin |
| **Owner** | `owner@pashupat.cloud` | `password123` | Business Owner (Unlimited approval) |
| **Admin** | `admin@pashupat.cloud` | `password123` | Administrator |
| **Office Manager** | `office@pashupat.cloud` | `password123` | Office Manager ($1,000 limit) |
| **Dispatcher** | `dispatcher@pashupat.cloud` | `password123` | Dispatcher ($0 limit) |
| **Sales** | `sales@pashupat.cloud` | `password123` | Sales Manager ($15,000 limit) |
| **Technician** | `technician@pashupat.cloud` | `password123` | Field Technician (`tech_app`) |
| **Finance** | `finance@pashupat.cloud` | `password123` | Finance / AR ($5,000 limit) |

