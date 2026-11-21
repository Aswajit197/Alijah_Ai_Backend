# How to Run: Elijah AI Core Backend API

The **Backend** is an enterprise Node.js/Express + TypeScript REST API providing multi-tenant isolation, dynamic Role-Based Access Control (RBAC), Prisma ORM integration with PostgreSQL, automated voice call sync with Retell AI, technician scheduling, leads management, and customer CRM.

> 📚 **Developer Architecture Guides in `backend/`:**
> - [**`HOW_TO_RUN_ALL.md`**](file:///d:/PODS/ElijahAi/backend/HOW_TO_RUN_ALL.md) — Complete 4-Service Startup & Run Guide (Docker, Backend, Frontends).
> - [**`BACKEND_VS_AISERVICE_GUIDE.md`**](file:///d:/PODS/ElijahAi/backend/BACKEND_VS_AISERVICE_GUIDE.md) — Service Boundary, Database Ownership & Internal Contract.
> - [**`DISPATCH_MANUAL_VS_AUTOMATED_GUIDE.md`**](file:///d:/PODS/ElijahAi/backend/DISPATCH_MANUAL_VS_AUTOMATED_GUIDE.md) — Autonomous vs. Manual Dispatch, Rule 1, Acceptance Timers & Escalations.
> - [**`MULTI_TENANT_GUIDE.md`**](file:///d:/PODS/ElijahAi/backend/MULTI_TENANT_GUIDE.md) — Multi-Tenancy, Subdomains, Retell Telephony & WebRTC Booking.

---

## 1. Quick Specifications

- **Runtime:** Node.js (ES Modules, TypeScript via `tsx`)
- **Default Port:** `5000` (`http://localhost:5000`)
- **Database:** PostgreSQL 16+ (Prisma ORM)
- **Database Port:** `5432` (or `5434` if using the Docker container from `AiService`)
- **Visual DB Tool:** Prisma Studio on port `5555`

---

## 2. Prerequisites

1. **Node.js**: v18.17.0+ or v20+ installed.
2. **PostgreSQL**: A running PostgreSQL instance. You can either:
   - Run a local PostgreSQL server on port `5432`.
   - OR use the Docker PostgreSQL container in `AiService` (Port `5434` / `5432`).
   - OR use a cloud Postgres instance (Neon.tech / Supabase).

---

## 3. Environment Configuration

Check or create the file `backend/.env`:

```env
# PostgreSQL Database URL
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/elijah_db?schema=public"

# Node Environment & Port
NODE_ENV="development"
PORT=5000

# JWT Secrets
JWT_SECRET="super-secret-jwt-key-elijah-ai-2026-very-secure"
JWT_EXPIRES_IN="7d"

# Super Admin Initial Credentials (for seed script)
SUPERADMIN_EMAIL="superadmin@elijah.ai"
SUPERADMIN_PASSWORD="SuperSecretPassword123!"
SUPERADMIN_NAME="Platform SuperAdmin"

# Allowed CORS Origins
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"

# Company Frontend URL (used in generated links)
COMPANY_APP_URL="http://localhost:3000"

# Optional Voice Service connection
VOICE_SERVICE_URL="http://localhost:4002"
```

> [!TIP]
> If your local PostgreSQL password is `postgres`, update `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/elijah_db?schema=public"`.

---

## 4. Installation & Database Setup

Open a terminal in `d:\PODS\ElijahAi\backend`:

### Step 1: Install Dependencies
```powershell
# On Windows PowerShell:
npm.cmd install

# On macOS/Linux:
npm install
```

### Step 2: Push Prisma Schema to PostgreSQL
This creates or updates the database tables (tenants, users, roles, jobs, customers, voice calls, notes, etc.):
```powershell
npm.cmd run prisma:push
```

### Step 3: Seed Default Roles & Accounts
Seeds the platform permissions, the SuperAdmin account, and the demo tenant (*Vanguard Electric & Power* / *Desert Air*):
```powershell
npm.cmd run prisma:seed
```

---

## 5. Starting the Development Server

```powershell
# On Windows PowerShell:
npm.cmd run dev

# On macOS/Linux:
npm run dev
```

The API server will start at **`http://localhost:5000`**.

### Verify Server Health
Open a browser or run:
```powershell
curl http://localhost:5000/api/v1/auth/me
```

---

## 6. Visual Database Browser (Prisma Studio)

To inspect, query, or edit users, jobs, leads, and tenants directly in a web GUI:

```powershell
npm.cmd run prisma:studio
```

Opens automatically at **`http://localhost:5555`**.

---

## 7. Default Seeded Accounts

| Role | Email | Password | Scope |
|---|---|---|---|
| **Platform SuperAdmin** | `superadmin@elijah.ai` | `SuperSecretPassword123!` | Global (SuperAdmin Portal) |
| **Business Owner** | `owner@pashupat.cloud` | `password123` | Vanguard Electric & Power |
| **Administrator** | `admin@pashupat.cloud` | `password123` | Vanguard Electric & Power |
| **Office Manager** | `office@pashupat.cloud` | `password123` | Vanguard Electric & Power |
| **Dispatcher** | `dispatcher@pashupat.cloud` | `password123` | Vanguard Electric & Power |
| **Field Technician** | `technician@pashupat.cloud` | `password123` | Vanguard Electric & Power |

---

## 8. Common Troubleshooting

1. **`P1001: Can't reach database server at localhost:5432`**:
   - Check if PostgreSQL service is running in Windows Services or Docker.
   - Verify `DATABASE_URL` credentials in `backend/.env`.
2. **`Script execution disabled on this system`**:
   - In Windows PowerShell, use `npm.cmd` instead of `npm`, or run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
3. **Port 5000 already in use**:
   - Kill the existing process:
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
     ```
