# Developer Guide: Understanding `backend` vs `AiService`

> **Note for Tek Chand and Backend Developers:**  
> This document explains the exact boundary between the **`backend/`** folder and the **`AiService/`** folder. Read this to understand how both services communicate, which service owns which data, and where to add new features.

---

## 1. Quick Summary: The Difference in 30 Seconds

| Topic | `backend/` (Core Business Backend) | `AiService/` (AI & Voice Engine) |
| :--- | :--- | :--- |
| **What it is** | **System of Record (ERP & CRM)** | **System of Intelligence (AI & Voice)** |
| **Language & Framework** | Node.js (v22), Express, TypeScript, Prisma ORM | Python (FastAPI), Node.js, Temporal, Retell AI |
| **Port** | `5000` (`http://localhost:5000/api/v1`) | `4002` (Voice), `4003` (AI/RAG), `4004` (Workflow) |
| **How it runs** | Local Node process (`npm run dev`) | Docker containers (`cd ../AiService && docker compose up -d`) |
| **Database Owned** | **PostgreSQL** (`prisma/schema.prisma`) — Tenants, Users, Customers, Jobs, Equipment, Invoices | **Internal Voice/Workflow State** — Retell call logs, audio URLs, transcripts, Temporal workflows, Redis queues |
| **Who uses it** | Frontend apps (`company-frontend` port 3000, `superadmin-frontend` port 3001) | Inbound telephony carriers, Retell AI webhooks, browser WebRTC calls |

---

## 2. What Is Inside `backend/`?

The `backend/` folder is the **core commercial operating system** for the trade businesses (HVAC, Electrical, Plumbing). It manages real people, money, permissions, and official business records.

### Folder Structure
```
backend/
├── prisma/
│   └── schema.prisma         # The single source of truth for the business database
├── src/
│   ├── config/               # Database connection (Prisma Client), environment variables
│   ├── middleware/           # auth.ts (JWT), tenantContext.ts (multi-tenant isolation), checkPermission.ts (RBAC)
│   ├── modules/
│   │   ├── auth/             # Login, password hashing, JWT issue/refresh
│   │   ├── customers/        # Customer CRM, addresses, gate codes, installed equipment units
│   │   ├── jobs/             # Work orders, scheduling swimlanes, dispatching, voice call syncing
│   │   ├── internal/         # Internal microservice API (/internal/v1/*) for voice & workflow services
│   │   ├── roles/            # 30+ dynamic permissions & custom roles
│   │   ├── users/            # Technician profiles, dispatchers, business owners
│   │   └── superadmin/       # Platform-level tenant provisioning & audit logs
│   ├── services/
│   │   └── mail.service.ts   # Outbound email notifications (dispatches jobs to technicians)
│   └── server.ts             # Express server entry point on port 5000
```

### Key Responsibilities of `backend/`:
1. **Multi-Tenant Security:** Every SQL query is automatically scoped by `tenantId`. No company can ever see another company's customers or jobs.
2. **Customer CRM:** Stores homeowner and commercial client profiles, service addresses, gate codes, access notes, and equipment records (model, serial, warranty).
3. **Official Work Orders (`Job`):** Manages permanent jobs (`JOB-5001`, `JOB-9001`) through their business lifecycle:
   - `UNSCHEDULED` -> `SCHEDULED` -> `DISPATCHED` -> `EN_ROUTE` -> `ON_SITE` -> `COMPLETED`
4. **Technician Dispatch & Notification:** When a job is dispatched, `backend/` sends email briefs to technicians with customer info, equipment specs, and Google Maps directions.
5. **Real-time Customer SSE Tracker:** Serves the public live tracking link (`/api/v1/jobs/:id/public-tracking`) where homeowners watch technician arrival in real time.

---

## 3. What Is Inside `AiService/`?

The `AiService/` folder is an **autonomous microservices cluster** running in Docker. Its job is to talk to customers on the phone, answer questions using AI, and autonomously schedule appointments.

### Folder Structure
```
AiService/
├── docker-compose.yml        # Orchestrates the AI stack: Voice, AI, Workflow, Temporal, Redis
├── services/
│   ├── voice-service/        # Node.js (Port 4002): Retell AI telephony webhooks & browser WebRTC calls
│   ├── workflow-service/     # Python (Port 4004): Temporal workflow engine for autonomous dispatching
│   └── ai-service/           # Python (Port 4003): RAG vector search over company documents & pricing
└── packages/
    └── contracts/            # Shared OpenAPI schemas and TypeScript types
```

> **Cleaned Up & Retired Components:**  
> - **`simulators/core-service` (Port 4001):** **Retired & Removed.** Service area checks, availability windows, customer lookups, and job creation are now natively hosted directly inside `backend/` (`/internal/v1/*`).  
> - **`simulators/auth-service` (Port 4000):** Removed. Production authentication lives exclusively in `backend/` (`/api/v1/auth/login`).  
> - **`scripts/dev/test-ui` (Port 4010):** Removed. The official web interface is `company-frontend` (Port 3000).  
> - **`contracts/drafts/` & `diagrams/`:** Removed. Up-to-date documentation lives in this guide.

### Key Responsibilities of `AiService/`:
1. **Inbound Voice Telephony (`voice-service` on port 4002):**
   - Connects to Retell AI for phone calls or browser mic calls.
   - Converts customer voice speech to text and AI text back to speech.
   - Executes live tools during calls (e.g. checking whether a ZIP code is in service area, estimating diagnostic fees).
2. **Autonomous Dispatch State Machine (`workflow-service` on port 4004):**
   - Powered by Temporal (`localhost:8233`).
   - Automatically scores and picks the best technician based on proximity, zone, and trade.
   - Pages the technician with a countdown timer (e.g. 15 minutes to accept).
   - If the technician declines or doesn't answer in time, it automatically releases them and offers the job to the next technician.
   - If all technicians decline, it moves the job into the **"Needs Attention"** triage queue for a human dispatcher.
3. **Knowledge Retrieval / RAG (`ai-service` on port 4003):**
   - Stores tenant documents (pricing sheets, warranty policies, FAQs) to feed accurate facts to the voice receptionist.

---

## 4. How `backend/` and `AiService/` Talk to Each Other

```
                      [ Incoming Voice Call from Homeowner ]
                                      │
                                      ▼
                      1. voice-service (AiService: 4002)
                         • Retell answers call
                         • Takes down customer name, phone, address, issue
                         • Calls book_service tool
                                      │
                                      ▼
                      2. workflow-service (AiService: 4004)
                         • Starts Temporal autonomous dispatch workflow
                         • Selects best available technician (e.g. Michel Rod)
                         • Creates job number (e.g. JOB-5001)
                                      │
                                      ▼
                      3. backend/ (Port 5000)
                         • Ingests/syncs the call and job into PostgreSQL
                         • Finds or creates the Customer in Prisma DB
                         • Saves the Job record with real address & issue
                         • Notifies technician via MailService
                                      │
                                      ▼
                      4. company-frontend (Port 3000)
                         • Displays call transcript & recording in Unified Inbox
                         • Displays work order in Schedule Swimlanes
                         • Shows accepted job in Mobile Field Portal (/tech)
```

### How the Sync Works in Code:
Inside [job.service.ts](file:///d:/PODS/ElijahAi/backend/src/modules/jobs/job.service.ts), the method `syncAiWorkflowJobs()` queries `workflow-service` on port `4004`:
1. Reads all active requests.
2. Resolves caller details (`name`, `phone`, `address`) from voice call data or internal customer records.
3. Creates or updates the customer in Postgres.
4. Creates or updates the job in Postgres so it appears immediately on the frontend board.

---

## 5. Developer Guide: Where Should Tek Chand Add New Code?

When adding new features or fixing bugs, follow this checklist:

### A. Add to `backend/` if you are working on:
- **Database Schema Changes:** Adding columns to `User`, `Customer`, `Equipment`, `Job`, or creating new models like `Invoice`, `Payment`, `InventoryPart`.
- **Business REST Endpoints:** New routes under `/api/v1/...` for the dashboard or mobile apps.
- **Role Permissions:** Creating new permissions in `constants/permissions.ts` or modifying RBAC checks.
- **Customer CRM Operations:** Editing customer profiles, managing equipment tags, warranties, or gate codes.
- **Notifications:** Outbound technician dispatch emails, SMS alerts (Twilio), or webhook broadcasts.
- **Financial Features:** Calculating totals, processing payments, QuickBooks integration.

### B. Add to `AiService/` if you are working on:
- **Voice Agent Prompts & Tools:** Changing how the AI receptionist greets callers, handles emergency fee disclosures, or parses customer questions.
- **New Retell Tools:** Adding live tools in `AiService/services/voice-service/src/modules/retell-tools/` (e.g. looking up order status during a call).
- **Temporal Workflow Changes:** Changing autonomous dispatch rules, cascading timer durations (e.g. shortening 15-minute wait to 5 minutes), or quote approval state machines in `AiService/services/workflow-service/`.
- **Knowledge Base Ingestion:** Uploading company PDFs/manuals for vector embedding in `AiService/services/ai-service/`.

---

## 6. How to Run Both Services Locally

### Step 1: Start `AiService` (Docker)
In terminal #1:
```bash
cd d:\PODS\ElijahAi\AiService
docker compose up -d
```
*Verify:*
- `http://localhost:4002/health` -> Voice service healthy
- `http://localhost:4004/health` -> Workflow service healthy
- `http://localhost:8233` -> Temporal UI dashboard

### Step 2: Start `backend/` (Node.js)
In terminal #2:
```bash
cd d:\PODS\ElijahAi\backend
npm run dev
```
*Verify:*
- Server logs `Server running on port 5000`
- `http://localhost:5000/api/v1/jobs` -> Returns live jobs from PostgreSQL

### Step 3: Start `company-frontend/` (Next.js)
In terminal #3:
```bash
cd d:\PODS\ElijahAi\company-frontend
npm run dev
```
*Verify:*
- Open `http://localhost:3000` in browser.
- Login with technician `tek@pods365.com` or business owner `amohapatra@pods365.com` (password: `Password123!`).

---

## 7. Important Architecture Rules to Remember
1. **Never put business customer/job SQL tables in `AiService`:** `backend/` is the single source of truth for the company database.
2. **Never call Retell telephony directly from `backend`:** Always route voice telephony through `voice-service` on port 4002.
3. **Always use multi-tenant filtering in `backend`:** Every query in `backend/src/modules/*` must filter by `where: { tenantId }`.
4. **Both services can run side by side:** `AiService` runs in Docker, while `backend` runs as a standard Node.js process on port 5000.
