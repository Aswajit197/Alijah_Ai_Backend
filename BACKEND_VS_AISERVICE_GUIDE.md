# Elijah AI — Master Architecture & Developer Boundary Guide

> **Official Developer Reference for Tek Chand & Full-Stack Engineers**  
> This master document defines the architectural boundary between **`backend/`** and **`AiService/`**, explains why they must remain independent peer services, details the `/internal/v1/*` microservice contract, and provides a clear decision matrix on where to write new code.

---

## 1. Quick Summary: The Difference in 30 Seconds

| Domain | `backend/` (Core Business Backend) | `AiService/` (AI & Voice Engine) |
| :--- | :--- | :--- |
| **Architectural Role** | **System of Record (ERP & CRM Engine)** | **System of Intelligence (Autonomous AI & Voice)** |
| **Tech Stack** | Node.js (v22), Express, TypeScript, Prisma ORM | Python (FastAPI), Node.js, Temporal, Retell AI, Redis |
| **Port** | `5000` (`http://localhost:5000/api/v1`) | `4002` (Voice), `4003` (AI/RAG), `4004` (Workflow) |
| **Runtime** | Local Node process (`npm run dev`) or production container | Docker Compose (`docker compose up -d`) microservices |
| **Data Owned** | **PostgreSQL (Prisma)**: Tenants, Staff/Users, Customers, Equipment, Work Orders, Invoices | **Voice/Temporal State**: Audio recordings, Retell turn transcripts, Temporal workflow state, Redis queues |
| **Who Calls It** | Frontends (`company-frontend:3000`, `superadmin:3001`) & `AiService` microservices | Telephony carriers (Twilio), Retell AI webhooks, browser WebRTC calls |

---

## 2. System Topology & Network Map

```text
                     ┌─────────────────────────────────────────────────────────┐
                     │               HOMEOWNER / CALLER                        │
                     └───────────────────┬─────────────────────────────────────┘
                                         │
                   Phone Call (Twilio)   │   Browser WebRTC Call / Form
                         │               │                 │
                         ▼               ▼                 ▼
              ┌─────────────────────┐       ┌────────────────────────────────┐
              │      Retell AI      │       │        company-frontend        │
              │   Voice Carrier     │       │       (Port 3000 / Next.js)    │
              └──────────┬──────────┘       └──────────────┬─────────────────┘
                         │ Ngrok (4040)                    │
                         ▼                                 │ REST API (/api/v1/*)
              ┌─────────────────────┐                      ▼
              │    voice-service    │◄───────────────►┌──────────────────────────┐
              │     (Port 4002)     │                 │       backend API        │
              └──────────┬──────────┘  /internal/v1/* │  (Port 5000 / Express)   │
                         │                            │                          │
          ┌──────────────┴──────────────┐             │ • Customer CRM           │
          ▼                             ▼             │ • Postgres (Prisma)      │
┌──────────────────┐          ┌───────────────────┐   │ • RBAC Permissions       │
│    ai-service    │          │ workflow-service  │◄──┤ • Dispatch & Jobs        │
│   (Port 4003)    │          │    (Port 4004)    │   │ • Email Alerts           │
│ LLM / Embeddings │          │ Temporal (8233)   │   │ • Customer SSE Tracker   │
└──────────────────┘          └───────────────────┘   └────────────┬─────────────┘
                                                                   │
                                                                   ▼
                                                      ┌──────────────────────────┐
                                                      │   superadmin-frontend    │
                                                      │  (Port 3001 / Next.js)   │
                                                      └──────────────────────────┘
```

---

## 3. Why `backend/` Must Remain at Root (NOT Nested in `AiService/`)

> [!IMPORTANT]
> **Architectural Decision:** Do **not** move `backend/` into `AiService/services/backend/`. They must remain clean peer directories at the repository root.

### 1. Inverted Hierarchy (The CRM is not an "AI Service")
`backend/` is the company's **System of Record**. It stores money, customer PII, staff roles, and the business operating system. `AiService` is an autonomous worker cluster for processing phone audio. Putting the entire business operating system inside an AI audio folder creates an architectural anti-pattern.

### 2. Symmetrical Project Structure
The two web applications (`company-frontend` and `superadmin-frontend`) sit at the root level. Having them talk to a backend buried inside `AiService/services/` would create an awkward, coupled dependency structure.

### 3. Developer Velocity & Instant Hot-Reload
- Running `backend/` natively with `npm run dev` gives **sub-second TypeScript recompilation**, instant file-save updates, and immediate access to `npx prisma db push` and `npx prisma studio`.
- Wrapping the primary API in Docker on Windows slows down database migrations, type checking, and test execution.

### 4. Independent Production Scaling
In production, `backend` (database connection pooling, transactional integrity) has strict, stable scaling requirements. `AiService` (voice streaming, WebSockets) needs rapid auto-scaling (e.g., spinning up 30 voice workers during peak heatwave call surges). They belong in separate deployment lifecycles.

---

## 4. Inside `backend/` (Core Business Server)

```text
backend/
├── prisma/
│   └── schema.prisma         # The single source of truth for the PostgreSQL database
├── src/
│   ├── config/               # Database connection (Prisma), environment variables
│   ├── constants/            # 30+ dynamic RBAC system permissions
│   ├── middleware/           # auth.ts (JWT), tenantContext.ts (multi-tenant isolation), checkPermission.ts
│   ├── modules/
│   │   ├── tenant-auth/      # Password hashing, JWT signing/refresh, 24h setup links
│   │   ├── customers/        # Customer CRM, service addresses, gate codes, equipment registry
│   │   ├── jobs/             # Work order lifecycle, scheduling swimlanes, SSE real-time tracking
│   │   ├── internal/         # Internal microservice API (/internal/v1/*) for voice & workflow services
│   │   │   ├── internal.routes.ts
│   │   │   ├── internal.controller.ts
│   │   │   ├── internal.service.ts
│   │   │   ├── internal.auth.ts
│   │   │   └── id-mapper.ts
│   │   ├── roles/            # Custom dynamic roles & permission assignments
│   │   ├── users/            # Technician profiles, dispatchers, company admins
│   │   └── super-admin/      # Platform-level tenant provisioning & telephony health
│   ├── services/
│   │   └── mail.service.ts   # SMTP notification engine (sends email briefs to assigned technicians)
│   ├── utils/
│   │   └── jobEvents.ts      # Server-Sent Events (SSE) broadcaster for live tracking
│   └── app.ts / server.ts    # Express application running on port 5000
```

### Key Responsibilities of `backend/`:
1. **Multi-Tenant Security:** Every SQL query is automatically scoped by `tenantId`. No company can ever read another company's records.
2. **Customer CRM:** Single source of truth for homeowners, commercial facilities, service addresses, gate/lockbox codes, and HVAC/electrical equipment warranties.
3. **Official Work Order Lifecycle:** Manages official jobs (`JOB-9001`) across status transitions:
   `UNSCHEDULED` ➔ `SCHEDULED` ➔ `DISPATCHED` ➔ `EN_ROUTE` ➔ `ON_SITE` ➔ `COMPLETED`.
4. **Technician Dispatch & Alerts:** Automatically notifies assigned technicians via email with full job details, customer contact info, and Google Maps navigation.
5. **Customer Live SSE Tracking:** Real-time event streaming (`/api/v1/jobs/:id/public-tracking`) showing technician status directly to the homeowner.

---

## 5. Inside `AiService/` (AI & Voice Microservices Cluster)

```text
AiService/
├── docker-compose.yml        # Orchestrates the AI stack (Voice, AI, Workflow, Temporal, Redis)
├── services/
│   ├── voice-service/        # Node.js (Port 4002): Retell AI telephony webhooks & browser WebRTC calls
│   ├── workflow-service/     # Python (Port 4004): Temporal workflow engine for autonomous dispatching
│   └── ai-service/           # Python (Port 4003): RAG vector search over company documents & pricing
├── packages/
│   └── contracts/            # Shared OpenAPI schemas and TypeScript types
└── scripts/
    └── dev/                  # Retell setup scripts (setup-retell.sh, web-call.sh)
```

> **Cleaned Up & Retired Components (Zero Simulators Left):**  
> - **`simulators/core-service` (Port 4001):** **Retired & Removed.** Service-area checks, availability slots, customer lookups, and job creation are now natively hosted directly inside `backend/` (`/internal/v1/*`).  
> - **`simulators/auth-service` (Port 4000):** **Retired & Removed.** Production authentication lives exclusively in `backend/` (`/api/v1/auth/login`).  
> - **`scripts/dev/test-ui` (Port 4010):** **Removed.** The official web interface is `company-frontend` (Port 3000).  
> - **`contracts/drafts/` & `diagrams/`:** **Removed.** Consolidated into this guide.

### Key Responsibilities of `AiService/`:
1. **Telephony & Audio Streaming (`voice-service` on port 4002):** Connects to Retell AI for phone calls or browser mic calls, converting voice to text and AI speech back to the caller.
2. **Autonomous Dispatch State Machine (`workflow-service` on port 4004):** Powered by Temporal (`localhost:8233`). Evaluates candidate technicians, handles paging timeouts, automatically cascades to backup technicians if a tech declines, and escalates to human attention if needed.
3. **Knowledge Retrieval / RAG (`ai-service` on port 4003):** Vector embeddings over tenant company manuals, warranty policies, and pricing sheets to supply factual answers to the receptionist.

---

## 6. The Internal Microservice API Contract (`/internal/v1/*`)

`voice-service` and `workflow-service` in Docker communicate with `backend` on `http://host.docker.internal:5000` via the following endpoints:

| Endpoint | Method | Header | Description |
| :--- | :--- | :--- | :--- |
| `/internal/v1/health` | `GET` | — | Internal service healthcheck. |
| `/internal/v1/tenants/by-phone/:e164` | `GET` | `x-service-token` | Discovers which tenant owns the dialed inbound phone number. |
| `/internal/v1/service-areas/check` | `GET` | `x-service-token`, `x-tenant-id` | Validates if a ZIP code is within service coverage (`isServed: true/false`). |
| `/internal/v1/availability` | `GET` | `x-service-token`, `x-tenant-id` | Returns open 2-hour appointment windows based on active technician capacity minus booked jobs. |
| `/internal/v1/customers/by-phone/:phone` | `GET` | `x-service-token`, `x-tenant-id` | Identifies returning callers by caller ID. |
| `/internal/v1/customers` | `POST` | `x-service-token`, `x-tenant-id` | Upserts customer record directly into PostgreSQL. |
| `/internal/v1/jobs` | `POST` | `x-service-token`, `x-tenant-id` | Creates an official work order (`JOB-XXXX`) and broadcasts live SSE updates. |
| `/internal/v1/technicians` | `GET` | `x-service-token`, `x-tenant-id` | Lists active technicians with trade skills and on-call order. |
| `/internal/v1/jobs/:id/technician-recommendations` | `GET` | `x-service-token`, `x-tenant-id` | Recommends technicians based on proximity and current day workload. |
| `/internal/v1/jobs/:id/assignment` | `PUT` | `x-service-token`, `x-tenant-id` | Assigns technician, sends email alert via `MailService`, and broadcasts SSE. |
| `/internal/v1/jobs/:id/assignment` | `DELETE` | `x-service-token`, `x-tenant-id` | Unassigns technician if declined. |
| `/internal/v1/jobs/:id/status` | `POST` | `x-service-token`, `x-tenant-id` | Updates job status (`DISPATCHED`, `ON_SITE`, `COMPLETED`). |
| `/internal/v1/estimates` | `GET` | `x-service-token`, `x-tenant-id` | Returns diagnostic fees and typical repair pricing for receptionist script. |
| `/internal/v1/messages` | `POST` | `x-service-token`, `x-tenant-id` | Logs or dispatches SMS/email notifications. |

---

## 7. Developer Decision Matrix: Where Should You Add New Code?

When adding new features or fixing bugs, use this checklist:

| If you are working on... | Put it in | Reason |
| :--- | :--- | :--- |
| **New fields on Customers, Jobs, Equipment, Invoices** | `backend/` | Belongs in the core Prisma PostgreSQL database schema. |
| **New REST APIs for frontend screens** | `backend/` | Express REST controllers serve data to `company-frontend` and `superadmin-frontend`. |
| **Role Permissions & Security Checks** | `backend/` | Managed in `backend/src/constants/permissions.ts` and evaluated by `checkPermission.ts`. |
| **Technician notifications (Email/SMS)** | `backend/` | Outbound alerts live in `backend/src/services/mail.service.ts`. |
| **Frontend UI pages, forms, or swimlanes** | `company-frontend/` | Next.js 14 client applications consume backend REST APIs. |
| **AI Receptionist Prompts or Voice Responses** | `AiService/services/voice-service/` | Prompting logic, Retell agent configurations, and audio handling live here. |
| **Live Call Tools (e.g. looking up something mid-call)** | `AiService/services/voice-service/` | Implemented in `src/modules/retell-tools/` and proxies to `backend/internal/v1/*`. |
| **Autonomous Dispatch Rules & Timing** | `AiService/services/workflow-service/` | Temporal workflows for technician acceptance timeouts and escalation queues. |
| **Uploading company manuals for AI retrieval** | `AiService/services/ai-service/` | Vector database embeddings and RAG search. |

---

## 8. How to Run the Entire System Locally

### Step 1: Start `AiService` (Docker Stack)
```bash
cd d:\PODS\ElijahAi\AiService
docker compose up -d
```
*Health verification:*
- `http://localhost:4002/health` ➔ Voice service healthy
- `http://localhost:4004/health` ➔ Workflow service healthy
- `http://localhost:8233` ➔ Temporal UI dashboard

### Step 2: Start `backend/` (Node.js API)
```bash
cd d:\PODS\ElijahAi\backend
npm run dev
```
*Health verification:*
- Server logs `Server running on port 5000`
- `http://localhost:5000/api/v1/health` ➔ `{"status": "ok"}`
- `http://localhost:5000/internal/v1/health` ➔ `{"status": "ok"}`

### Step 3: Start `company-frontend/` (Contractor Operations App)
```bash
cd d:\PODS\ElijahAi\company-frontend
npm run dev
```
*Access:* `http://localhost:3000` (Log in with `tek@pods365.com` or `amohapatra@pods365.com`, password `Password123!`).

### Step 4: Start `superadmin-frontend/` (Platform Console - Optional)
```bash
cd d:\PODS\ElijahAi\superadmin-frontend
npm run dev
```
*Access:* `http://localhost:3001` (Log in with `superadmin@elijah.ai`, password `SuperSecretPassword123!`).

---

## 9. Core Engineering Rules to Remember
1. **`backend/` is the single source of truth:** Never create separate SQL tables in `AiService` for business data (customers, jobs, users).
2. **Always enforce multi-tenant isolation:** Every query in `backend/src/modules/*` must filter by `where: { tenantId }`.
3. **Internal microservice calls use service tokens:** All calls between `AiService` and `backend` must pass `x-service-token` and `x-tenant-id`.
4. **Clean repository structure:** All 4 projects (`backend`, `company-frontend`, `superadmin-frontend`, `AiService`) maintain their own isolated dependencies.
