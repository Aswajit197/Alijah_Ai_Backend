# Elijah AI — Complete System Startup & Run Guide

This master guide explains how to start, orchestrate, and test all 4 components of the **Elijah AI** ecosystem:

1. **`AiService`** — Docker microservices stack (Voice Receptionist, AI Knowledge, Temporal Workflows, Redis, Postgres, Ngrok).
2. **`backend`** — Core REST API (Node.js/Express, TypeScript, Prisma ORM, Multi-Tenant RBAC, PostgreSQL).
3. **`company-frontend`** — Contractor Operations Web App (Next.js 14, Unified AI Inbox, Leads Pipeline, Schedule & Dispatch, CRM, Public Booking WebRTC).
4. **`superadmin-frontend`** — Platform Operations Console (Next.js 14, Multi-Tenant Provisioning, Dynamic RBAC, Telephony Health).

> 💡 **Confused about what belongs in `backend/` vs `AiService/`?** Check out the architecture breakdown in [backend/BACKEND_VS_AISERVICE_GUIDE.md](file:///d:/PODS/ElijahAi/backend/BACKEND_VS_AISERVICE_GUIDE.md).

---

## 1. System Architecture & Network Map

```
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
                         ▼                                 │ REST API
              ┌─────────────────────┐                      ▼
              │    voice-service    │◄───────────────►┌──────────────────────────┐
              │     (Port 4002)     │                 │       backend API        │
              └──────────┬──────────┘                 │  (Port 5000 / Express)   │
                         │                            └────────────┬─────────────┘
          ┌──────────────┴──────────────┐                          │
          ▼                             ▼                          │
┌──────────────────┐          ┌───────────────────┐                │
│    ai-service    │          │ workflow-service  │                │
│   (Port 4003)    │          │    (Port 4004)    │                │
│ LLM / Embeddings │          │ Temporal (8233)   │                │
└──────────────────┘          └───────────────────┘                │
                                                                   ▼
                                                      ┌──────────────────────────┐
                                                      │   superadmin-frontend    │
                                                      │  (Port 3001 / Next.js)   │
                                                      └──────────────────────────┘
```

---

## 2. Port & Service Summary

| Subsystem | Port | Tech Stack | Purpose |
|---|---|---|---|
| **company-frontend** | `3000` | Next.js 14 / React 18 | Contractor web app & customer public booking page. |
| **superadmin-frontend**| `3001` | Next.js 14 / React 18 | Platform superadmin management console. |
| **backend** | `5000` | Node.js / Express / Prisma | Core multi-tenant backend API. |
| **Prisma Studio** | `5555` | Prisma Studio Web | Visual database GUI for PostgreSQL. |
| **voice-service** | `4002` | Node.js / TypeScript | Retell webhook handler & WebRTC token issuer. |
| **ai-service** | `4003` | Python / FastAPI | AI reasoning, LLM prompt engineering, RAG search. |
| **workflow-service** | `4004` | Python / FastAPI | Temporal state machine workflows & worker. |
| **core-simulator** | `4001` | Python / FastAPI | Standalone ERP/FSM simulator. |
| **Temporal UI** | `8233` | Temporal Web | Workflow visualizer & state inspection. |
| **Microservice DB** | `5434` | PostgreSQL 17 + pgvector| Database used by `AiService` microservices. |
| **Redis** | `6381` | Redis 7 Alpine | Event queue & pub/sub for voice events. |
| **Core PostgreSQL** | `5432` | PostgreSQL 16+ | Primary database for backend & multi-tenant data. |

---

## 3. Recommended Startup Order

To avoid dependency errors, start the components in this exact order:

```
[1. AiService Docker Stack] ──► [2. Core Backend API] ──► [3. Company Frontend] ──► [4. SuperAdmin Frontend]
```

---

### Step 1: Start `AiService` (Docker Microservices)

Open **Terminal 1**:

```powershell
cd d:\PODS\ElijahAi\AiService

# Start all containers in the background
docker compose up -d

# Verify all services are healthy
docker compose ps
```

### Live Telephony & Webhook Tunnel (ngrok)
When testing live voice calls via Retell AI / WebRTC, start the ngrok tunnel so Retell can deliver event webhooks (`call_started`, `call_ended`, `call_analyzed`):
```powershell
cd d:\PODS\ElijahAi\AiService
docker compose --profile webhooks up -d ngrok
```
- **Ngrok Web Inspector:** [http://localhost:4040](http://localhost:4040) (view live incoming payloads and HTTP status in real time).
- **Automatic Fallback:** Even if ngrok is offline, the backend auto-syncs with Retell's REST API whenever calls are listed or opened in the Unified Inbox.

---

### Step 2: Start `backend` (Express REST API)

Open **Terminal 2**:

```powershell
cd d:\PODS\ElijahAi\backend

# Install dependencies (Windows PowerShell uses npm.cmd)
npm.cmd install

# Push schema to database
npm.cmd run prisma:push

# Seed roles, permissions, and demo users (run once or after DB reset)
npm.cmd run prisma:seed

# Start backend development server
npm.cmd run dev
```
> The API will be running at **`http://localhost:5000`**.

---

### Step 3: Start `company-frontend` (Contractor Web App)

Open **Terminal 3**:

```powershell
cd d:\PODS\ElijahAi\company-frontend

# Install dependencies
npm.cmd install

# Start Next.js development server
npm.cmd run dev
```
> The Contractor Portal will be running at **`http://localhost:3000`**.

---

### Step 4: Start `superadmin-frontend` (Platform Operations)

Open **Terminal 4**:

```powershell
cd d:\PODS\ElijahAi\superadmin-frontend

# Install dependencies
npm.cmd install

# Start Next.js development server
npm.cmd run dev
```
> The SuperAdmin Console will be running at **`http://localhost:3001`**.

---

## 4. Default Seeded Credentials

### Platform SuperAdmin Portal (`http://localhost:3001/login`)
- **Email:** `superadmin@elijah.ai`
- **Password:** `SuperSecretPassword123!`
- **Role:** SuperAdmin (Global platform management)

### Contractor Portal (`http://localhost:3000/login`)
Tenant: **Vanguard Electric & Power** (Slug: `vanguard-electric`)

| Role | Email | Password | Access Capabilities |
|---|---|---|---|
| **Business Owner** | `owner@pashupat.cloud` | `password123` | Full company access, financial approvals, team settings. |
| **Dispatcher** | `dispatcher@pashupat.cloud` | `password123` | Leads pipeline, schedule swimlanes, technician dispatching. |
| **Field Technician** | `technician@pashupat.cloud` | `password123` | Assigned jobs, status updates, mobile field portal. |
| **Office Manager** | `office@pashupat.cloud` | `password123` | Customer CRM, appointments, billing invoices up to $1,000. |

---

## 5. End-to-End Verification Walkthrough

Follow these steps to test the entire system in under 3 minutes:

1. **Simulate a Customer Call:**
   - Open Chrome or Edge to: `http://localhost:3000/book/vanguard-electric`
   - Click **"Talk to AI Receptionist (Live Call)"** and grant microphone permissions.
   - Say: *"Hi, my circuit breaker tripped and half my house has no power. My name is Alex, address is 250 North 1st Ave, Phoenix. Can someone come tomorrow at 2 PM?"*
   - Elijah AI answers, checks the schedule, confirms diagnostic fees, and issues a booking reference (`JOB-XXXX`).
2. **Review Unified AI Inbox:**
   - Log in at `http://localhost:3000/login` as `dispatcher@pashupat.cloud`.
   - Go to `http://localhost:3000/inbox`.
   - Click the new conversation:
     - Listen to the full audio recording with playback speed controls (1x, 1.25x, 1.5x).
     - Read the AI triage summary and sentiment analysis.
     - Review customer CRM details in the right sidebar.
     - Type a quick SMS message to the customer in the reply bar.
3. **Verify Leads & Opportunity Pipeline:**
   - Go to `http://localhost:3000/leads`.
   - See the caller automatically qualified and marked as **Booked**.
4. **Dispatch on the Schedule Board:**
   - Go to `http://localhost:3000/schedule`.
   - Navigate to tomorrow's date.
   - See the appointment in the technician's swimlane with arrival window and address.
   - Notice the early dispatch safety indicator (`📅 Scheduled (Tomorrow)`).
5. **Inspect in SuperAdmin Console:**
   - Open `http://localhost:3001` and log in as `superadmin@elijah.ai`.
   - View updated tenant analytics, call minutes, and subscription status.

---

## 6. Common Windows PowerShell Tips & Troubleshooting

- **`ExecutionPolicy` Error:** If PowerShell complains that scripts cannot be executed, use `npm.cmd` instead of `npm`, or execute:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```
- **Port Conflict (e.g. Port 3000 or 5000 busy):**
  Check which process is listening on the port:
  ```powershell
  Get-NetTCPConnection -LocalPort 5000 | Select-Object LocalAddress, LocalPort, OwningProcess
  ```
  Kill the blocking process:
  ```powershell
  Stop-Process -Id <OwningProcessId> -Force
  ```
- **Resetting Demo Data:**
  If you want to wipe test calls and start fresh:
  ```powershell
  cd d:\PODS\ElijahAi\AiService
  docker compose stop core-simulator workflow-service temporal
  docker volume rm aiservice_temporal-data aiservice_core-data
  docker compose up -d
  ```

---

## 7. Individual Service Documentation Links

- [Company Frontend Run Guide](company-frontend/HOW_TO_RUN.md)
- [SuperAdmin Frontend Run Guide](superadmin-frontend/HOW_TO_RUN.md)
- [Backend API Run Guide](backend/HOW_TO_RUN.md)
- [AI & Voice Microservices Run Guide](AiService/HOW_TO_RUN.md)
